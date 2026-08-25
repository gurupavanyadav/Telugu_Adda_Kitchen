import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, describe, test } from 'node:test';
import { createClient } from '@supabase/supabase-js';

const url = process.env.API_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  throw new Error('API_URL/SERVICE_ROLE_KEY are required for the Auth profile trigger test.');
}

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const suffix = `${Date.now()}-${randomUUID().slice(0, 8)}`;
const fixture = {
  email: `profile-trigger-${suffix}@example.test`,
  userId: null,
};

after(async () => {
  if (fixture.userId) {
    const { error } = await admin.auth.admin.deleteUser(fixture.userId);
    assert.ifError(error);
  }
});

describe('Auth profile trigger boundary', () => {
  test('creates the default customer profile through the internal Auth trigger', async () => {
    const created = await admin.auth.admin.createUser({
      email: fixture.email,
      password: `ProfileTrigger-${suffix}-safe-password`,
      email_confirm: true,
    });
    assert.ifError(created.error);
    assert.ok(created.data.user?.id);
    fixture.userId = created.data.user.id;

    const profile = await admin
      .from('profiles')
      .select('id,role')
      .eq('id', fixture.userId)
      .single();
    assert.ifError(profile.error);
    assert.equal(profile.data.id, fixture.userId);
    assert.equal(profile.data.role, 'customer');
  });
});
