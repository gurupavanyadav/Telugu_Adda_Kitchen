import assert from 'node:assert/strict';
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
const password = `Address-${suffix}-safe-password`;
const fixture = {
  customerAEmail: `address-a-${suffix}@example.test`,
  customerBEmail: `address-b-${suffix}@example.test`,
  vendorEmail: `address-vendor-${suffix}@example.test`,
  adminEmail: `address-admin-${suffix}@example.test`,
  customerAId: null,
  customerBId: null,
  vendorId: null,
  adminId: null,
  addressAId: null,
  addressBId: null,
  adminAddressId: null,
};

let customerA;
let customerB;
let vendor;
let canonicalAdmin;

function assertNoError(label, result) {
  assert.ifError(result.error);
  assert.ok(result.data !== undefined, `${label}: expected a response`);
}

function assertDenied(label, result) {
  assert.ok(result.error || result.data === null || result.data?.length === 0, `${label}: expected denial or no rows`);
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

before(async () => {
  fixture.customerAId = await createUser(fixture.customerAEmail);
  fixture.customerBId = await createUser(fixture.customerBEmail);
  fixture.vendorId = await createUser(fixture.vendorEmail);
  fixture.adminId = await createUser(fixture.adminEmail);

  // Simulate a stale legacy admin flag. NRL-01 must remain closed even if this
  // column exists in an older database snapshot.
  const legacyAdmin = await admin
    .from('profiles')
    .update({ role: 'admin' })
    .eq('id', fixture.customerAId);
  assertNoError('legacy profile fixture', legacyAdmin);

  const vendorRole = await admin.from('user_roles').insert({
    user_id: fixture.vendorId,
    role: 'vendor',
  });
  assertNoError('vendor role fixture', vendorRole);

  const adminRole = await admin.from('user_roles').insert({
    user_id: fixture.adminId,
    role: 'admin',
  });
  assertNoError('canonical admin role fixture', adminRole);

  const addressA = await admin.from('addresses').insert({
    user_id: fixture.customerAId,
    label: 'A home',
    hostel_name: 'Tenant A Hostel',
    room_number: 'A-1',
    phone: '0000000000',
  }).select('id').single();
  assertNoError('customer A address fixture', addressA);
  fixture.addressAId = addressA.data.id;

  const adminAddress = await admin.from('addresses').insert({
    user_id: fixture.adminId,
    label: 'Admin home',
    hostel_name: 'Admin Hostel',
    room_number: 'ADM-1',
    phone: '9999999999',
  }).select('id').single();
  assertNoError('canonical admin address fixture', adminAddress);
  fixture.adminAddressId = adminAddress.data.id;

  const addressB = await admin.from('addresses').insert({
    user_id: fixture.customerBId,
    label: 'B home',
    hostel_name: 'Tenant B Hostel',
    room_number: 'B-1',
    phone: '1111111111',
  }).select('id').single();
  assertNoError('customer B address fixture', addressB);
  fixture.addressBId = addressB.data.id;

  customerA = await signIn(fixture.customerAEmail);
  customerB = await signIn(fixture.customerBEmail);
  vendor = await signIn(fixture.vendorEmail);
  canonicalAdmin = await signIn(fixture.adminEmail);
});

after(async () => {
  for (const id of [fixture.addressAId, fixture.addressBId, fixture.adminAddressId].filter(Boolean)) {
    await admin.from('addresses').delete().eq('id', id);
  }
  for (const userId of [fixture.vendorId, fixture.adminId].filter(Boolean)) {
    await admin.from('user_roles').delete().eq('user_id', userId);
  }
  for (const userId of [fixture.vendorId, fixture.adminId, fixture.customerBId, fixture.customerAId].filter(Boolean)) {
    await admin.auth.admin.deleteUser(userId);
  }
});

describe('addresses RLS', () => {
  test('a customer can read and update only their own address', async () => {
    const own = await customerA.from('addresses').select('*').eq('id', fixture.addressAId).single();
    assertNoError('customer own address read', own);
    assert.equal(own.data.user_id, fixture.customerAId);

    const update = await customerA
      .from('addresses')
      .update({ label: 'A updated' })
      .eq('id', fixture.addressAId)
      .select('label')
      .single();
    assertNoError('customer own address update', update);
    assert.equal(update.data.label, 'A updated');
  });

  test('a customer cannot read, update, delete, or reassign another customer’s address', async () => {
    const crossRead = await customerA.from('addresses').select('*').eq('id', fixture.addressBId);
    assertNoError('cross-user address read', crossRead);
    assert.equal(crossRead.data.length, 0);

    const crossUpdate = await customerA
      .from('addresses')
      .update({ label: 'stolen', user_id: fixture.customerAId })
      .eq('id', fixture.addressBId)
      .select('id');
    assertDenied('cross-user address update', crossUpdate);

    const crossDelete = await customerA
      .from('addresses')
      .delete()
      .eq('id', fixture.addressBId)
      .select('id');
    assertDenied('cross-user address delete', crossDelete);

    const preserved = await customerB.from('addresses').select('label,user_id').eq('id', fixture.addressBId).single();
    assertNoError('cross-user address preservation', preserved);
    assert.equal(preserved.data.label, 'B home');
    assert.equal(preserved.data.user_id, fixture.customerBId);
  });

  test('a customer cannot insert an address for another user', async () => {
    const result = await customerA.from('addresses').insert({
      user_id: fixture.customerBId,
      label: 'forged',
      hostel_name: 'Forged Hostel',
      room_number: 'F-1',
      phone: '2222222222',
    });
    assertDenied('cross-user address insert', result);
  });

  test('a legacy admin profile does not bypass address isolation', async () => {
    const result = await customerA.from('addresses').select('*').eq('id', fixture.addressBId);
    assertNoError('legacy-admin address read', result);
    assert.equal(result.data.length, 0);
  });

  test('canonical vendor and admin roles remain owner-scoped for addresses', async () => {
    const vendorResult = await vendor.from('addresses').select('*').eq('id', fixture.addressAId);
    assertNoError('vendor cross-user address read', vendorResult);
    assert.equal(vendorResult.data.length, 0);

    const adminOwn = await canonicalAdmin.from('addresses').select('*').eq('id', fixture.adminAddressId).single();
    assertNoError('canonical admin own address read', adminOwn);
    assert.equal(adminOwn.data.user_id, fixture.adminId);

    const adminCross = await canonicalAdmin.from('addresses').select('*').eq('id', fixture.addressBId);
    assertNoError('canonical admin cross-user address read', adminCross);
    assert.equal(adminCross.data.length, 0);
  });

  test('anonymous users cannot read or write addresses', async () => {
    const anonymous = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const read = await anonymous.from('addresses').select('*').eq('id', fixture.addressAId);
    assertDenied('anonymous address read', read);

    const write = await anonymous.from('addresses').insert({
      user_id: fixture.customerAId,
      label: 'anonymous',
      hostel_name: 'Anonymous Hostel',
      room_number: 'N-1',
      phone: '3333333333',
    });
    assertDenied('anonymous address write', write);
  });
});
