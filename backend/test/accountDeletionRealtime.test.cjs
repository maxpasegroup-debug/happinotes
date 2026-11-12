const { test, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { User } = require('../dist/models');
const { AccountDeletionRequest } = require('../dist/models/AccountDeletionRequest');
const { AccountDeletionReauth } = require('../dist/models/AccountDeletionReauth');
const auth = require('../dist/middleware/auth');
const controller = require('../dist/controllers/accountDeletionController');
const service = require('../dist/services/accountDeletion');
const realtime = require('../dist/services/realtime');
const { authorizeAdminRealtime } = require('../dist/services/adminRealtime');

afterEach(() => { mock.restoreAll(); realtime.registerRealtimeServer(null); });
const id = '64b000000000000000000001';
function authMocks({ existing = false, version = 1, tokenVersion = 1, blocked = false, state = 'active', role = 'user' } = {}) {
  mock.method(jwt, 'verify', () => ({ id, sessionVersion: tokenVersion }));
  mock.method(User, 'findById', async () => ({ _id: id, role, sessionVersion: version, blocked, deletionState: state }));
  mock.method(AccountDeletionRequest, 'exists', async () => existing);
}
function request() { return { headers: { authorization: 'Bearer test-token' } }; }
function response() { return { payload: null, statusCode: 200, setHeader() {}, status(code) { this.statusCode = code; return this; }, json(value) { this.payload = value; return this; } }; }

test('first-time deletion and empty status checks accept a valid active session', async () => {
  authMocks();
  const req = request();
  let error;
  await auth.authenticateDeletionFlow(req, {}, (e) => { error = e; });
  assert.equal(error, undefined);
  assert.equal(req.user._id, id);
  mock.method(AccountDeletionRequest, 'findOne', () => ({ sort: async () => null }));
  await controller.getDeletionStatus(req, response(), (e) => { error = e; });
  assert.equal(error.message, 'Deletion request not found');
  assert.equal(error.statusCode, 404);
});

test('first-time deletion does not accept revoked sessions', async () => {
  authMocks({ version: 2, tokenVersion: 1 });
  const req = request();
  let error;
  await auth.authenticateDeletionFlow(req, {}, (e) => { error = e; });
  assert.equal(error.statusCode, 401);
  assert.equal(req.user, undefined);
});

test('existing pending deletion remains readable after session revocation', async () => {
  authMocks({ existing: true, version: 2, tokenVersion: 1, state: 'pending' });
  const req = request();
  let error;
  await auth.authenticateDeletionFlow(req, {}, (e) => { error = e; });
  assert.equal(error, undefined);
  assert.equal(req.user._id, id);
});

test('blocked accounts are denied even with an existing deletion request', async () => {
  authMocks({ existing: true, blocked: true });
  let error;
  await auth.authenticateDeletionFlow(request(), {}, (e) => { error = e; });
  assert.equal(error.statusCode, 401);
});

test('confirmed first deletion reaches the creation service and appears in the admin response', async () => {
  authMocks();
  const req = { ...request(), body: { proof: 'verified-proof-value-123456789', idempotencyKey: 'unique-request-key-123456789' } };
  await auth.authenticateDeletionFlow(req, {}, (e) => { if (e) throw e; });
  mock.method(service, 'findActiveDeletionRequest', async () => null);
  mock.method(AccountDeletionReauth, 'findOneAndUpdate', async () => ({ usedAt: new Date() }));
  let saved;
  mock.method(service, 'requestAccountDeletion', async (userId, key) => {
    assert.equal(userId, id);
    assert.equal(key, req.body.idempotencyKey);
    saved = { _id: id, userId: { name: 'Test listener' }, status: 'requested', publicReference: 'HN-DEL-01234567890123456789', requestedAt: new Date(), source: 'in_app', processingHistory: [] };
    return saved;
  });
  const submitted = response();
  await controller.requestDeletion(req, submitted, (e) => { throw e; });
  assert.equal(submitted.statusCode, 202);
  assert.equal(submitted.payload.reference, saved.publicReference);
  mock.method(AccountDeletionRequest, 'find', () => ({ sort() { return this; }, limit() { return this; }, populate: async () => [saved] }));
  const admin = response();
  await controller.getAdminDeletionRequests({}, admin, (e) => { throw e; });
  assert.equal(admin.payload.requests[0].reference, submitted.payload.reference);
  assert.equal(admin.payload.requests[0].status, 'REQUEST_RECEIVED');
});

test('invalid deletion proof cannot create a request', async () => {
  mock.method(service, 'findActiveDeletionRequest', async () => null);
  mock.method(AccountDeletionReauth, 'findOneAndUpdate', async () => null);
  const create = mock.method(service, 'requestAccountDeletion', async () => assert.fail('must not create'));
  let error;
  await controller.requestDeletion({ user: { _id: id }, body: { proof: 'invalid-proof-value-123456789', idempotencyKey: 'unique-request-key-123456789' } }, response(), (e) => { error = e; });
  assert.equal(error.statusCode, 401);
  assert.equal(create.mock.callCount(), 0);
});

for (const [role, allowed] of [['user', false], ['admin', true]]) {
  test(`admin realtime ${allowed ? 'accepts' : 'rejects'} ${role}`, async () => {
    authMocks({ role });
    let error;
    await authorizeAdminRealtime({ handshake: { auth: { token: 'test-token' } } }, (e) => { error = e; });
    assert.equal(Boolean(error), !allowed);
  });
}

test('admin realtime denies guests and revoked admin sessions', async () => {
  let error;
  await authorizeAdminRealtime({ handshake: { auth: {} } }, (e) => { error = e; });
  assert.ok(error);
  authMocks({ role: 'admin', version: 2, tokenVersion: 1 });
  await authorizeAdminRealtime({ handshake: { auth: { token: 'test-token' } } }, (e) => { error = e; });
  assert.ok(error);
});

test('deletion events are admin-only invalidations without personal or status-token data', () => {
  let namespace, event, payload;
  realtime.registerRealtimeServer({ of(value) { namespace = value; return { emit(name, data) { event = name; payload = data; } }; }, emit() { assert.fail('must not broadcast publicly'); } });
  realtime.emitAccountDeletionsChanged();
  assert.equal(namespace, '/admin');
  assert.equal(event, 'account-deletions:changed');
  assert.deepEqual(Object.keys(payload), ['occurredAt']);
});
