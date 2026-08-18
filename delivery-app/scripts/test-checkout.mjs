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
const password = `Checkout-${suffix}-safe-password`;
const fixture = {
  customerAEmail: `checkout-a-${suffix}@example.test`,
  customerBEmail: `checkout-b-${suffix}@example.test`,
  customerAId: null,
  customerBId: null,
  dishId: randomUUID(),
  orderIds: [],
  addressBId: null,
};

let customerA;

function assertAllowed(label, result) {
  assert.ifError(result.error);
  assert.ok(result.data !== null && result.data !== undefined, `${label}: expected data`);
}

function assertRejected(label, result) {
  assert.ok(result.error, `${label}: expected the RPC to reject the request`);
}

async function createUser(email) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  assert.ifError(error);
  assert.ok(data.user?.id);
  return data.user.id;
}

async function signIn(email) {
  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  assert.ifError(error);
  return client;
}

async function createOrder(
  client,
  orderNumber,
  items,
  addressId = null,
  fulfillmentType = 'pickup',
  idempotencyKey = randomUUID(),
) {
  return client.rpc('create_order', {
    p_order_number: orderNumber,
    p_fulfillment_type: fulfillmentType,
    p_address_id: addressId,
    p_notes: null,
    p_items: items,
    p_idempotency_key: idempotencyKey,
  });
}

before(async () => {
  fixture.customerAId = await createUser(fixture.customerAEmail);
  fixture.customerBId = await createUser(fixture.customerBEmail);

  const dish = await admin.from('dishes').insert({
    id: fixture.dishId,
    name: `Checkout test dish ${suffix}`,
    cuisine: 'Test',
    meal_type: 'Lunch',
    price: 10,
    is_veg: true,
    is_available: true,
    customizations: [{ label: 'Extra', price: 5 }],
  }).select('id').single();
  assertAllowed('checkout dish fixture', dish);

  const address = await admin.from('addresses').insert({
    user_id: fixture.customerBId,
    label: 'B only',
    hostel_name: 'Tenant B Hostel',
    room_number: 'B-1',
    phone: '0000000000',
  }).select('id').single();
  assertAllowed('cross-user address fixture', address);
  fixture.addressBId = address.data.id;

  customerA = await signIn(fixture.customerAEmail);
});

after(async () => {
  if (fixture.orderIds.length > 0) await admin.from('orders').delete().in('id', fixture.orderIds);
  if (fixture.addressBId) await admin.from('addresses').delete().eq('id', fixture.addressBId);
  await admin.from('dishes').delete().eq('id', fixture.dishId);

  for (const userId of [fixture.customerBId, fixture.customerAId].filter(Boolean)) {
    await admin.auth.admin.deleteUser(userId);
  }
});

describe('secure checkout RPC', () => {
  test('derives authoritative names, customization prices, and totals', async () => {
    const result = await createOrder(customerA, `CHECKOUT-${suffix}`, [{
      dish_id: fixture.dishId,
      dish_name: 'forged client name',
      quantity: 2,
      customizations: [{ label: 'Extra', price: 0 }],
    }]);
    assertAllowed('server-calculated order', result);
    fixture.orderIds.push(result.data);

    const order = await customerA
      .from('orders')
      .select('items_total,delivery_fee,grand_total,status')
      .eq('id', result.data)
      .single();
    assertAllowed('authoritative order summary', order);
    assert.equal(Number(order.data.items_total), 30);
    assert.equal(Number(order.data.delivery_fee), 0);
    assert.equal(Number(order.data.grand_total), 30);
    assert.equal(order.data.status, 'received');

    const item = await customerA
      .from('order_items')
      .select('dish_name,dish_price,customizations,line_total')
      .eq('order_id', result.data)
      .single();
    assertAllowed('authoritative order item', item);
    assert.equal(item.data.dish_name, `Checkout test dish ${suffix}`);
    assert.equal(Number(item.data.dish_price), 15);
    assert.deepEqual(item.data.customizations, [{ label: 'Extra', price: 5 }]);
    assert.equal(Number(item.data.line_total), 30);
  });

  test('replays the original order when a retry uses the same idempotency key and intent', async () => {
    const idempotencyKey = randomUUID();
    const orderNumber = `CHECKOUT-REPLAY-${suffix}`;
    const items = [{ dish_id: fixture.dishId, quantity: 1, customizations: [{ label: 'Extra', price: 0 }] }];

    const first = await createOrder(customerA, orderNumber, items, null, 'pickup', idempotencyKey);
    assertAllowed('first idempotent order', first);
    fixture.orderIds.push(first.data);

    const replay = await createOrder(customerA, orderNumber, items, null, 'pickup', idempotencyKey);
    assertAllowed('idempotent replay', replay);
    assert.equal(replay.data, first.data);

    const matchingOrders = await admin
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', fixture.customerAId)
      .eq('idempotency_key', idempotencyKey);
    assert.ifError(matchingOrders.error);
    assert.equal(matchingOrders.count, 1);
  });

  test('rejects reuse of an idempotency key with different order intent', async () => {
    const idempotencyKey = randomUUID();
    const orderNumber = `CHECKOUT-CONFLICT-${suffix}`;

    const first = await createOrder(
      customerA,
      orderNumber,
      [{ dish_id: fixture.dishId, quantity: 1, customizations: [] }],
      null,
      'pickup',
      idempotencyKey,
    );
    assertAllowed('initial idempotency request', first);
    fixture.orderIds.push(first.data);

    const conflict = await createOrder(
      customerA,
      orderNumber,
      [{ dish_id: fixture.dishId, quantity: 2, customizations: [] }],
      null,
      'pickup',
      idempotencyKey,
    );
    assertRejected('conflicting idempotency key reuse', conflict);
    assert.match(conflict.error.message, /idempotency key/i);
  });

  test('collapses concurrent duplicate submissions into one order', async () => {
    const idempotencyKey = randomUUID();
    const orderNumber = `CHECKOUT-CONCURRENT-${suffix}`;
    const items = [{ dish_id: fixture.dishId, quantity: 1, customizations: [] }];

    const [first, second] = await Promise.all([
      createOrder(customerA, orderNumber, items, null, 'pickup', idempotencyKey),
      createOrder(customerA, orderNumber, items, null, 'pickup', idempotencyKey),
    ]);
    assertAllowed('first concurrent checkout request', first);
    assertAllowed('second concurrent checkout request', second);
    assert.equal(first.data, second.data);
    fixture.orderIds.push(first.data);

    const matchingOrders = await admin
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', fixture.customerAId)
      .eq('idempotency_key', idempotencyKey);
    assert.ifError(matchingOrders.error);
    assert.equal(matchingOrders.count, 1);
  });

  test('rejects a delivery address owned by another customer', async () => {
    const result = await createOrder(
      customerA,
      `CHECKOUT-CROSS-ADDRESS-${suffix}`,
      [{ dish_id: fixture.dishId, quantity: 1, customizations: [] }],
      fixture.addressBId,
      'delivery',
    );
    assertRejected('cross-user delivery address', result);
  });

  test('rejects oversized customization arrays before catalog iteration', async () => {
    const tooMany = Array.from({ length: 21 }, (_, index) => ({
      label: `Extra ${index}`,
      price: 0,
    }));
    const result = await createOrder(
      customerA,
      `CHECKOUT-TOO-MANY-CUSTOMIZATIONS-${suffix}`,
      [{ dish_id: fixture.dishId, quantity: 1, customizations: tooMany }],
    );
    assertRejected('customization-array size limit', result);
  });
});
