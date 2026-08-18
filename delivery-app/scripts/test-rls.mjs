import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, test } from 'node:test';
import { createClient } from '@supabase/supabase-js';

const url = process.env.API_URL || process.env.SUPABASE_URL;
const anonKey = process.env.ANON_KEY || process.env.SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceRoleKey) {
  throw new Error('API_URL/ANON_KEY/SERVICE_ROLE_KEY are required. Run `supabase status -o env` first.');
}

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const password = `RlsTest-${suffix}-safe-password`;
const fixture = {
  customerAEmail: `rls-customer-a-${suffix}@example.test`,
  customerBEmail: `rls-customer-b-${suffix}@example.test`,
  vendorEmail: `rls-vendor-${suffix}@example.test`,
  customerAId: null,
  customerBId: null,
  vendorId: null,
  dishId: randomUUID(),
  orderAId: null,
  orderBId: null,
  orderItemId: null,
};

let customerA;
let customerB;
let vendor;

function publicClient() {
  return createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function createUser(email) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  assert.ifError(error);
  assert.ok(data.user?.id, `User ${email} was not created`);
  return data.user.id;
}

async function signIn(email) {
  const client = publicClient();
  const { error } = await client.auth.signInWithPassword({ email, password });
  assert.ifError(error);
  return client;
}

function assertAllowed(label, result) {
  assert.ifError(result.error);
  assert.notEqual(result.data, undefined, `${label}: expected a response payload`);
}

function assertDenied(label, result) {
  if (result.error) return;

  // PostgREST can return no error for an RLS-filtered UPDATE/DELETE. Using
  // .select() at each call site makes an empty array the expected denial result.
  const noRows = result.data === null || (Array.isArray(result.data) && result.data.length === 0);
  assert.ok(noRows, `${label}: operation unexpectedly succeeded`);
}

async function rpcCreateOrder(client, orderNumber, items = [{
  dish_id: fixture.dishId,
  dish_name: 'client-supplied name must not become authoritative',
  quantity: 1,
  customizations: [],
}]) {
  const result = await client.rpc('create_order', {
    p_order_number: orderNumber,
    p_fulfillment_type: 'pickup',
    p_address_id: null,
    p_notes: null,
    p_items: items,
    p_idempotency_key: randomUUID(),
  });
  assertAllowed('create_order RPC', result);
  assert.ok(result.data, 'create_order RPC did not return an order ID');
  return result.data;
}

before(async () => {
  fixture.customerAId = await createUser(fixture.customerAEmail);
  fixture.customerBId = await createUser(fixture.customerBEmail);
  fixture.vendorId = await createUser(fixture.vendorEmail);

  const roleResult = await admin.from('user_roles').insert({
    user_id: fixture.vendorId,
    role: 'vendor',
  });
  assertAllowed('vendor role fixture', roleResult);

  const dishResult = await admin.from('dishes').insert({
    id: fixture.dishId,
    name: `RLS test dish ${suffix}`,
    cuisine: 'Test',
    meal_type: 'Lunch',
    price: 10,
    is_veg: true,
    is_available: true,
    customizations: [{ label: 'Extra', price: 5 }],
  });
  assertAllowed('dish fixture', dishResult);

  customerA = await signIn(fixture.customerAEmail);
  customerB = await signIn(fixture.customerBEmail);
  vendor = await signIn(fixture.vendorEmail);

  fixture.orderAId = await rpcCreateOrder(customerA, `RLS-A-${suffix}`);
  fixture.orderBId = await rpcCreateOrder(customerB, `RLS-B-${suffix}`);

  const itemResult = await customerA
    .from('order_items')
    .select('id')
    .eq('order_id', fixture.orderAId)
    .single();
  assertAllowed('order item fixture lookup', itemResult);
  fixture.orderItemId = itemResult.data.id;
});

after(async () => {
  const orderIds = [fixture.orderAId, fixture.orderBId].filter(Boolean);
  if (orderIds.length) await admin.from('orders').delete().in('id', orderIds);
  await admin.from('dishes').delete().eq('id', fixture.dishId);

  for (const userId of [fixture.vendorId, fixture.customerBId, fixture.customerAId].filter(Boolean)) {
    await admin.auth.admin.deleteUser(userId);
  }
});

describe('RLS isolation', () => {
  test('customers can read only their own orders', async () => {
    const own = await customerA
      .from('orders')
      .select('id,user_id')
      .eq('id', fixture.orderAId)
      .maybeSingle();
    assertAllowed('customer A own order read', own);
    assert.equal(own.data?.user_id, fixture.customerAId);

    const other = await customerA
      .from('orders')
      .select('id')
      .eq('id', fixture.orderBId)
      .maybeSingle();
    assert.equal(other.error, null);
    assert.equal(other.data, null, 'customer A can read customer B order');

    const vendorDirectRead = await vendor
      .from('orders')
      .select('id,user_id,grand_total')
      .eq('id', fixture.orderAId)
      .maybeSingle();
    assert.equal(vendorDirectRead.error, null);
    assert.equal(vendorDirectRead.data, null, 'vendor can read the raw orders table');

    const vendorItemsDirectRead = await vendor
      .from('order_items')
      .select('id,dish_price,line_total')
      .eq('order_id', fixture.orderAId);
    assert.equal(vendorItemsDirectRead.error, null);
    assert.deepEqual(vendorItemsDirectRead.data, [], 'vendor can read raw order-item pricing');

    const fulfillment = await vendor.rpc('list_vendor_fulfillment_orders');
    assertAllowed('vendor fulfillment-order RPC', fulfillment);
    const vendorOrder = fulfillment.data.find((order) => order.id === fixture.orderAId);
    assert.ok(vendorOrder, 'vendor fulfillment RPC omitted an active restaurant order');
    assert.equal('user_id' in vendorOrder, false);
    assert.equal('items_total' in vendorOrder, false);
    assert.equal('delivery_fee' in vendorOrder, false);
    assert.equal('grand_total' in vendorOrder, false);
    assert.equal(vendorOrder.fulfillment_items[0].dish_name, `RLS test dish ${suffix}`);
    assert.equal('dish_price' in vendorOrder.fulfillment_items[0], false);
    assert.equal('line_total' in vendorOrder.fulfillment_items[0], false);
  });

  test('customers cannot read or mutate another customer\'s order', async () => {
    const customerARead = await customerA
      .from('orders')
      .select('id,user_id')
      .eq('id', fixture.orderBId)
      .maybeSingle();
    assert.equal(customerARead.error, null);
    assert.equal(customerARead.data, null, 'customer A can read customer B order');

    const customerBRead = await customerB
      .from('orders')
      .select('id,user_id')
      .eq('id', fixture.orderAId)
      .maybeSingle();
    assert.equal(customerBRead.error, null);
    assert.equal(customerBRead.data, null, 'customer B can read customer A order');

    const crossTenantUpdate = await customerA
      .from('orders')
      .update({ notes: 'cross-tenant write attempt' })
      .eq('id', fixture.orderBId)
      .select('id');
    assertDenied('customer A cross-tenant order update', crossTenantUpdate);

    const crossTenantDelete = await customerA
      .from('orders')
      .delete()
      .eq('id', fixture.orderBId)
      .select('id');
    assertDenied('customer A cross-tenant order delete', crossTenantDelete);

    const ownerStillPresent = await customerB
      .from('orders')
      .select('id,user_id,notes')
      .eq('id', fixture.orderBId)
      .single();
    assertAllowed('customer B order remains intact', ownerStillPresent);
    assert.equal(ownerStillPresent.data.user_id, fixture.customerBId);
    assert.notEqual(ownerStillPresent.data.notes, 'cross-tenant write attempt');
  });

  test('customers cannot escalate their role', async () => {
    const result = await customerA.from('user_roles').insert({
      user_id: fixture.customerAId,
      role: 'vendor',
    });
    assertDenied('customer role escalation', result);
  });
});

describe('SEC-01: direct customer writes are denied', () => {
  test('customer cannot insert an order directly', async () => {
    const result = await customerA.from('orders').insert({
      user_id: fixture.customerAId,
      order_number: `DIRECT-${suffix}`,
      fulfillment_type: 'pickup',
      items_total: 1,
      delivery_fee: 0,
      grand_total: 1,
      status: 'received',
    });
    assertDenied('customer direct order insert', result);
  });

  test('customer cannot update or delete an order directly', async () => {
    const update = await customerA
      .from('orders')
      .update({ grand_total: 0 })
      .eq('id', fixture.orderAId)
      .select('id');
    assertDenied('customer direct order update', update);

    const remove = await customerA
      .from('orders')
      .delete()
      .eq('id', fixture.orderAId)
      .select('id');
    assertDenied('customer direct order delete', remove);
  });

  test('customer cannot escalate their own order status', async () => {
    for (const status of ['delivered', 'out_for_delivery', 'preparing']) {
      const result = await customerA
        .from('orders')
        .update({ status })
        .eq('id', fixture.orderAId)
        .select('id,status');
      assertDenied(`customer status escalation to ${status}`, result);
    }

    const current = await customerA
      .from('orders')
      .select('status')
      .eq('id', fixture.orderAId)
      .single();
    assertAllowed('customer order status remains unchanged', current);
    assert.equal(current.data.status, 'received');
  });

  test('customer cannot tamper with protected fields on their own order', async () => {
    for (const [label, change] of [
      ['customer ownership tampering', { user_id: fixture.vendorId }],
      ['customer delivery-fee tampering', { delivery_fee: 0 }],
      ['customer address tampering', { delivery_address: { forged: true } }],
      ['customer order-number tampering', { order_number: `FORGED-CUSTOMER-${suffix}` }],
    ]) {
      const result = await customerA
        .from('orders')
        .update(change)
        .eq('id', fixture.orderAId)
        .select('id');
      assertDenied(label, result);
    }
  });

  test('customer cannot insert, update, or delete order items directly', async () => {
    const insert = await customerA.from('order_items').insert({
      order_id: fixture.orderAId,
      dish_id: fixture.dishId,
      dish_name: 'forged item',
      dish_price: 0,
      quantity: 1,
      customizations: [],
      line_total: 0,
    });
    assertDenied('customer direct order-item insert', insert);

    const update = await customerA
      .from('order_items')
      .update({ line_total: 0 })
      .eq('id', fixture.orderItemId)
      .select('id');
    assertDenied('customer direct order-item update', update);

    const remove = await customerA
      .from('order_items')
      .delete()
      .eq('id', fixture.orderItemId)
      .select('id');
    assertDenied('customer direct order-item delete', remove);
  });

  test('trusted RPC derives catalog snapshots and totals', async () => {
    const orderId = await rpcCreateOrder(customerA, `RLS-RPC-${suffix}`, [{
      dish_id: fixture.dishId,
      dish_name: 'forged client name',
      quantity: 2,
      customizations: [{ label: 'Extra', price: 0 }],
    }]);

    const order = await customerA
      .from('orders')
      .select('items_total,delivery_fee,grand_total')
      .eq('id', orderId)
      .single();
    assertAllowed('RPC-created order read', order);
    assert.equal(Number(order.data.items_total), 30);
    assert.equal(Number(order.data.delivery_fee), 0);
    assert.equal(Number(order.data.grand_total), 30);

    const item = await customerA
      .from('order_items')
      .select('dish_name,dish_price,quantity,customizations,line_total')
      .eq('order_id', orderId)
      .single();
    assertAllowed('RPC-created item read', item);
    assert.equal(item.data.dish_name, `RLS test dish ${suffix}`);
    assert.equal(Number(item.data.dish_price), 15);
    assert.equal(item.data.quantity, 2);
    assert.deepEqual(item.data.customizations, [{ label: 'Extra', price: 5 }]);
    assert.equal(Number(item.data.line_total), 30);

    await admin.from('orders').delete().eq('id', orderId);
  });
});

describe('SEC-03: vendor order updates are constrained', () => {
  test('vendor can advance through valid operational statuses', async () => {
    const preparing = await vendor.rpc('update_vendor_order_fulfillment', {
      p_order_id: fixture.orderAId,
      p_status: 'preparing',
      p_notes: 'Kitchen accepted',
    });
    assertAllowed('received to preparing', preparing);
    assert.equal(preparing.data[0].status, 'preparing');

    const outForDelivery = await vendor.rpc('update_vendor_order_fulfillment', {
      p_order_id: fixture.orderAId,
      p_status: 'out_for_delivery',
      p_notes: 'Kitchen accepted',
    });
    assertAllowed('preparing to out_for_delivery', outForDelivery);
    assert.equal(outForDelivery.data[0].status, 'out_for_delivery');

    const delivered = await vendor.rpc('update_vendor_order_fulfillment', {
      p_order_id: fixture.orderAId,
      p_status: 'delivered',
      p_notes: 'Kitchen accepted',
    });
    assertAllowed('out_for_delivery to delivered', delivered);
    assert.equal(delivered.data[0].status, 'delivered');
  });

  test('vendor cannot make invalid backward or skipped transitions', async () => {
    const skipped = await vendor.rpc('update_vendor_order_fulfillment', {
      p_order_id: fixture.orderBId,
      p_status: 'delivered',
      p_notes: null,
    });
    assertDenied('received to delivered skip', skipped);

    const backward = await vendor.rpc('update_vendor_order_fulfillment', {
      p_order_id: fixture.orderAId,
      p_status: 'received',
      p_notes: 'Kitchen accepted',
    });
    assertDenied('delivered to received backward transition', backward);

    const cancelled = await vendor.rpc('update_vendor_order_fulfillment', {
      p_order_id: fixture.orderBId,
      p_status: 'cancelled',
      p_notes: null,
    });
    assertAllowed('received to cancelled', cancelled);
    assert.equal(cancelled.data[0].status, 'cancelled');
  });

  test('vendor cannot modify protected order fields or update orders directly', async () => {
    for (const [label, change] of [
      ['vendor total tampering', { grand_total: 0 }],
      ['vendor ownership tampering', { user_id: fixture.vendorId }],
      ['vendor address tampering', { delivery_address: { forged: true } }],
      ['vendor order-number tampering', { order_number: `FORGED-${suffix}` }],
    ]) {
      const result = await vendor
        .from('orders')
        .update(change)
        .eq('id', fixture.orderAId)
        .select('id');
      assertDenied(label, result);
    }

    const directStatusUpdate = await vendor
      .from('orders')
      .update({ status: 'cancelled' })
      .eq('id', fixture.orderBId)
      .select('id');
    assertDenied('vendor direct status update', directStatusUpdate);
  });
});

describe('vendor menu boundary', () => {
  test('vendor may manage dish availability while customers cannot', async () => {
    const customerAttempt = await customerA
      .from('dishes')
      .update({ is_available: false })
      .eq('id', fixture.dishId)
      .select('id');
    assertDenied('customer dish mutation', customerAttempt);

    const vendorUpdate = await vendor
      .from('dishes')
      .update({ is_available: false })
      .eq('id', fixture.dishId)
      .select('id,is_available')
      .single();
    assertAllowed('vendor dish mutation', vendorUpdate);
    assert.equal(vendorUpdate.data.is_available, false);
  });
});
