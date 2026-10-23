const { test, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { User } = require('../dist/models');
const { env } = require('../dist/config/env');
const { ensureAdminUser, normalizeAdminEmail } = require('../dist/config/ensureAdmin');

const originalAdminEmail = env.ADMIN_EMAIL;
const originalBootstrapPassword = env.ADMIN_BOOTSTRAP_PASSWORD;

afterEach(() => {
  mock.restoreAll();
  env.ADMIN_EMAIL = originalAdminEmail;
  env.ADMIN_BOOTSTRAP_PASSWORD = originalBootstrapPassword;
});

function configure(email = ' Owner@Example.Test ', password) {
  env.ADMIN_EMAIL = email;
  env.ADMIN_BOOTSTRAP_PASSWORD = password;
}

function findOneReturning(value) {
  mock.method(User, 'findOne', () => ({ select: async () => value }));
}

test('configured admin remains unchanged across repeated startup', async () => {
  configure(undefined);
  const existing = { role: 'admin', save: mock.fn(async () => {}) };
  findOneReturning(existing);
  await ensureAdminUser();
  await ensureAdminUser();
  assert.equal(existing.role, 'admin');
  assert.equal(existing.save.mock.calls.length, 0);
});

test('configured email cannot silently promote an existing non-admin', async () => {
  configure(undefined);
  const existing = { role: 'user', save: mock.fn(async () => {}) };
  findOneReturning(existing);
  await assert.rejects(ensureAdminUser(), /existing non-admin account/);
  assert.equal(existing.role, 'user');
  assert.equal(existing.save.mock.calls.length, 0);
});

test('missing or malformed administrator email fails before database access', async () => {
  env.ADMIN_EMAIL = undefined;
  await assert.rejects(ensureAdminUser(), /ADMIN_EMAIL.*valid email/);
  env.ADMIN_EMAIL = 'not-an-email';
  await assert.rejects(ensureAdminUser(), /ADMIN_EMAIL.*valid email/);
  assert.throws(() => normalizeAdminEmail('bad'), /valid email/);
});

test('missing configured admin fails closed without a bootstrap secret', async () => {
  configure(undefined, undefined);
  findOneReturning(null);
  const create = mock.method(User, 'create', async () => { throw new Error('must not create'); });
  await assert.rejects(ensureAdminUser(), /ADMIN_BOOTSTRAP_PASSWORD/);
  assert.equal(create.mock.calls.length, 0);
});

test('one-time bootstrap hashes the supplied secret and creates only the configured admin', async () => {
  configure(undefined, 'local-test-bootstrap-value');
  findOneReturning(null);
  let created;
  mock.method(User, 'create', async (document) => { created = document; return document; });
  await ensureAdminUser();
  assert.equal(created.email, 'owner@example.test');
  assert.equal(created.role, 'admin');
  assert.notEqual(created.password, 'local-test-bootstrap-value');
  assert.equal(await bcrypt.compare('local-test-bootstrap-value', created.password), true);
});

test('concurrent first startup accepts only a concurrently-created admin', async () => {
  configure(undefined, 'local-test-bootstrap-value');
  let lookups = 0;
  mock.method(User, 'findOne', () => ({
    select: async () => (++lookups > 2 ? { role: 'admin' } : null),
  }));
  let creates = 0;
  mock.method(User, 'create', async () => {
    creates += 1;
    if (creates === 1) return { role: 'admin' };
    throw Object.assign(new Error('duplicate'), { code: 11000 });
  });
  await Promise.all([ensureAdminUser(), ensureAdminUser()]);
  assert.equal(creates, 2);
});

test('a duplicate bootstrap race with a non-admin still fails closed', async () => {
  configure(undefined, 'local-test-bootstrap-value');
  let lookup = 0;
  mock.method(User, 'findOne', () => ({
    select: async () => (++lookup === 1 ? null : { role: 'user' }),
  }));
  mock.method(User, 'create', async () => { throw Object.assign(new Error('duplicate'), { code: 11000 }); });
  await assert.rejects(ensureAdminUser(), /existing non-admin account/);
});
