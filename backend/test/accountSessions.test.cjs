const { test, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { User } = require('../dist/models/User');
const { UserDevice } = require('../dist/models/UserDevice');
const { AccountDeletionRequest } = require('../dist/models/AccountDeletionRequest');
const { env } = require('../dist/config/env');
const { startAccountSession, sessionHistory } = require('../dist/services/accountSessions');
const { authenticate } = require('../dist/middleware/auth');
const { login, logout } = require('../dist/controllers/authController');
const { recordNetwork } = require('../dist/controllers/userSecurityController');
const deletion = require('../dist/services/accountDeletion');
const realtime = require('../dist/services/realtime');
const userId = '64b000000000000000000002';
const response = () => ({ headersSent: false, status() { return this; }, json(body) { this.body = body; this.headersSent = true; } });
afterEach(() => mock.restoreAll());
function state() {
  const user = { _id: userId, role: 'user', password: 'verified-hash', sessionVersion: 0, blocked: false, deletionState: 'active', loginHistory: [] };
  const notifications = [];
  mock.method(realtime, 'emitUserSecurityChanged', id => notifications.push(id));
  mock.method(User, 'findOneAndUpdate', async (filter, update) => {
    assert.equal(filter._id, userId); assert.equal(filter.role, 'user');
    assert.equal(filter.password, 'verified-hash'); assert.equal(filter.blocked.$ne, true);
    user.sessionVersion += update.$inc.sessionVersion;
    Object.assign(user, update.$set);
    user.loginHistory.push(...update.$push.loginHistory.$each);
    user.loginHistory = user.loginHistory.slice(-50);
    return { ...user };
  });
  mock.method(User, 'findById', async () => user);
  mock.method(AccountDeletionRequest, 'exists', async () => false);
  return { user, notifications };
}
async function auth(token) {
  const req = { headers: { authorization: `Bearer ${token}` } };
  let error; await authenticate(req, {}, value => { error = value; });
  return { req, error };
}
test('second successful login revokes the old token and retains both login records', async () => {
  const { user, notifications } = state();
  const old = await startAccountSession(user);
  assert.equal((await auth(old)).error, undefined);
  const current = await startAccountSession(user);
  assert.equal((await auth(old)).error.statusCode, 401);
  assert.equal((await auth(current)).error, undefined);
  assert.equal(user.loginHistory.length, 2);
  assert.deepEqual(sessionHistory(user).map(item => item.status), ['current', 'replaced']);
  assert.equal(notifications.length, 2);
  assert.notEqual(jwt.decode(old).loginSessionId, jwt.decode(current).loginSessionId);
});
test('concurrent logins yield one valid session and bounded history without lost entries', async () => {
  const { user } = state();
  const tokens = await Promise.all(Array.from({ length: 55 }, () => startAccountSession(user)));
  const results = await Promise.all(tokens.map(auth));
  assert.equal(results.filter(result => !result.error).length, 1);
  assert.equal(user.loginHistory.length, 50); assert.equal(new Set(user.loginHistory.map(item => item.sessionId)).size, 50);
});
test('failed credentials do not replace an existing session', async () => {
  const { user } = state(); const token = await startAccountSession(user);
  mock.method(User, 'findOne', () => ({ select: async () => user }));
  mock.method(bcrypt, 'compare', async () => false);
  let error; await login({ body: { email: 'user@example.test', password: 'wrong' } }, response(), value => { error = value; });
  assert.equal(error.statusCode, 401); assert.equal((await auth(token)).error, undefined); assert.equal(user.loginHistory.length, 1);
});
test('phone PIN login follows the same single-session rule', async () => {
  const { user } = state(); const old = await startAccountSession(user);
  mock.method(User, 'findOne', () => ({ select: async () => user }));
  mock.method(bcrypt, 'compare', async () => true);
  mock.method(deletion, 'isAccountWritable', async () => true);
  const res = response(); await login({ body: { phoneNumber: '+919876543210', pin: '123456' } }, res, error => { throw error; });
  assert.equal((await auth(old)).error.statusCode, 401); assert.equal((await auth(res.body.token)).error, undefined);
});
test('a delayed old logout cannot revoke the newer login; current logout records its end', async () => {
  const { user } = state(); const old = await startAccountSession(user), oldRequest = (await auth(old)).req;
  // Real Mongoose request documents are independent snapshots.
  oldRequest.user = { ...oldRequest.user };
  const current = await startAccountSession(user);
  mock.method(User, 'updateOne', async (filter, update) => {
    if (filter.sessionVersion !== user.sessionVersion || filter.activeLoginSessionId !== user.activeLoginSessionId) return { matchedCount: 0 };
    const entry = user.loginHistory.find(item => item.sessionId === filter.activeLoginSessionId);
    entry.endedAt = update.$set['loginHistory.$.endedAt']; user.sessionVersion++; delete user.activeLoginSessionId;
    return { matchedCount: 1 };
  });
  await logout(oldRequest, response(), error => { throw error; });
  assert.equal((await auth(current)).error, undefined);
  await logout((await auth(current)).req, response(), error => { throw error; });
  assert.equal((await auth(current)).error.statusCode, 401);
  assert.equal(sessionHistory(user)[0].status, 'signed_out');
});
test('administrator logins retain existing behavior and create no customer history', async () => {
  const { user } = state();
  const token = await startAccountSession({ ...user, role: 'admin' });
  assert.equal(jwt.decode(token).sessionVersion, 0); assert.equal(user.loginHistory.length, 0);
});
test('expiry and revoked accounts never appear as a current session', () => {
  const entry = { sessionId: 'session', startedAt: new Date(0), expiresAt: new Date(1000) };
  assert.equal(sessionHistory({ loginHistory: [entry], activeLoginSessionId: 'session' }, 2000)[0].status, 'expired');
  assert.equal(sessionHistory({ loginHistory: [entry], activeLoginSessionId: 'session', blocked: true }, 500)[0].status, 'revoked');
});
test('legacy clients reporting without an installation ID keep separate session device records', async () => {
  const records = new Map(), sessions = new Map();
  mock.method(UserDevice, 'findOne', filter => ({ select() { return this; }, lean: async () => records.get(filter.installationId) }));
  mock.method(UserDevice, 'updateOne', async (filter, update) => { records.set(filter.installationId, { _id: filter.installationId, ...records.get(filter.installationId), ...update.$set, geo: { status: 'approximate', checkedAt: new Date() } }); });
  mock.method(User, 'updateOne', async (filter, update) => sessions.set(filter['loginHistory.sessionId'], update.$set));
  const ids = ['7108b55c-89f6-465c-a97a-4165a1b1d011', '7108b55c-89f6-465c-a97a-4165a1b1d012'];
  for (const [i, id] of ids.entries()) await recordNetwork({ user: { _id: userId }, authSessionId: id, ip: '8.8.8.8', body: { networkType: 'wifi', deviceModel: `Phone ${i}` } }, response(), error => { throw error; });
  assert.equal(records.size, 2); assert.equal(sessions.size, 2);
  assert.equal(sessions.get(ids[0])['loginHistory.$.deviceModel'], 'Phone 0');
  assert.equal(sessions.get(ids[1])['loginHistory.$.deviceModel'], 'Phone 1');
});
