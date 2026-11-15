const { test, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const { User } = require('../dist/models/User');
const { SecurityBlock } = require('../dist/models/SecurityBlock');
const realtime = require('../dist/services/realtime');
const { parseDeviceSecurity, securityKey, recordVpnDetection, assertNoSecurityBlock, checkVpnLogin, preserveVpnBlocks } = require('../dist/services/vpnSecurity');
const { moderateIp } = require('../dist/controllers/vpnSecurityController');
const { moderateUser } = require('../dist/controllers/userSecurityController');
const { UserDevice } = require('../dist/models/UserDevice');
const { UserNetwork } = require('../dist/models/UserNetwork');
const userId = '64b000000000000000000002';
const installationId = '7108b55c-89f6-465c-a97a-4165a1b1d011';
const report = n => ({ installationId, vpn: true, source: 'android_network', incidentId: `7108b55c-89f6-465c-a97a-4165a1b1d0${String(n).padStart(2, '0')}` });
afterEach(() => mock.restoreAll());
function database({ count = 0, writeFailure = false } = {}) {
  const user = { _id: userId, role: 'user', email: 'user@example.test', vpnDetectionCount: count, sessionVersion: 1, activeLoginSessionId: 'current', blocked: false, vpnHistory: [], vpnInstallationKeys: [] };
  const events = [];
  mock.method(User, 'findById', id => ({ select: async () => { assert.equal(id, userId); return structuredClone(user); } }));
  mock.method(User, 'findOneAndUpdate', async (filter, update) => {
    if (writeFailure) throw new Error('storage error');
    if (filter.$or[0].sessionVersion !== user.sessionVersion) return null;
    for (const [key, value] of Object.entries(update.$inc || {})) user[key] = (user[key] || 0) + value;
    Object.assign(user, update.$set); for (const key of Object.keys(update.$unset || {})) delete user[key];
    if (update.$addToSet) user.vpnInstallationKeys = [...new Set([...user.vpnInstallationKeys, update.$addToSet.vpnInstallationKeys])];
    if (update.$push?.vpnHistory) user.vpnHistory.push(...update.$push.vpnHistory.$each);
    return structuredClone(user);
  });
  mock.method(SecurityBlock, 'updateOne', () => assert.fail('automatic IP blocks or secondary writes are not needed'));
  mock.method(realtime, 'emitUserSecurityChanged', id => events.push(id));
  return { user, events, get incidents() { return user.vpnHistory; } };
}
test('invalid or unsupported evidence cannot be counted as a VPN incident', () => {
  assert.equal(parseDeviceSecurity(undefined), undefined);
  assert.equal(parseDeviceSecurity({ installationId, vpn: null, source: 'unavailable' }).vpn, null);
  for (const value of [null, {}, { ...report(1), source: 'unavailable' }, { ...report(1), incidentId: 'bad' }, { ...report(1), vpn: 'true' }]) assert.throws(() => parseDeviceSecurity(value), { statusCode: 400 });
});
test('the fifth separate incident revokes and permanently bans the account, installation and email, never the shared IP', async () => {
  const db = database();
  for (let n = 1; n <= 5; n++) {
    db.user.vpnLastDetectedAt = new Date(0);
    const result = await recordVpnDetection(userId, report(n), '8.8.8.8');
    assert.equal(result.count, n); assert.equal(result.banned, n === 5);
  }
  assert.equal(db.user.blocked, true); assert.equal(db.user.activeLoginSessionId, undefined);
  assert.equal(db.incidents.length, 5); assert.equal(db.events.length, 5);
  assert.deepEqual(db.user.vpnInstallationKeys, [securityKey('installation', installationId)]);
  assert.equal(db.user.email, 'user@example.test');
});
test('retry, reconnection and concurrent duplicate reports count once', async () => {
  const db = database();
  await Promise.all([recordVpnDetection(userId, report(1)), recordVpnDetection(userId, report(1))]);
  assert.equal(db.user.vpnDetectionCount, 1); assert.equal(db.incidents.length, 1);
  await recordVpnDetection(userId, report(2)); assert.equal(db.user.vpnDetectionCount, 1);
  db.user.vpnLastDetectedAt = new Date(0);
  await recordVpnDetection(userId, report(1)); assert.equal(db.user.vpnDetectionCount, 1);
});
test('failed atomic account writes leave the incident and counter unchanged without announcing success', async () => {
  const db = database({ count: 4, writeFailure: true });
  await assert.rejects(recordVpnDetection(userId, report(5)), /storage error/);
  assert.equal(db.user.vpnDetectionCount, 4); assert.equal(db.user.blocked, false);
  assert.equal(db.incidents.length, 0); assert.equal(db.events.length, 0);
});
test('block checks enforce installation/email/manual IP restrictions and ignore private addresses', async () => {
  mock.method(User, 'exists', async () => null);
  mock.method(SecurityBlock, 'exists', async filter => {
    assert.equal(filter.active, true); assert.deepEqual(filter.$or.map(item => item.kind), ['installation', 'email']); return { _id: 'block' };
  });
  await assert.rejects(assertNoSecurityBlock('installation-key', '192.168.1.1', 'User@example.test'), { statusCode: 403 });
});
test('admin login is exempt from customer VPN restrictions', async () => {
  mock.method(SecurityBlock, 'exists', () => assert.fail('no customer check for admin'));
  assert.equal(await checkVpnLogin({ role: 'admin' }, report(1), '8.8.8.8'), undefined);
});
test('manual IP ban cannot target an arbitrary unreported address', async () => {
  mock.method(User, 'findOne', async () => ({ _id: userId }));
  mock.method(UserDevice, 'exists', async () => false); mock.method(UserNetwork, 'exists', async () => false);
  mock.method(SecurityBlock, 'updateOne', () => assert.fail('must not block arbitrary IP'));
  let error;
  await moderateIp({ params: { id: userId }, user: { _id: 'admin' }, body: { action: 'ban', ip: '8.8.8.8', reason: 'reviewed' } }, {}, value => { error = value; });
  assert.equal(error.statusCode, 400);
});
test('admin unban resets strikes and releases only installation/email restrictions, leaving IP review separate', async () => {
  mock.method(User, 'findById', () => ({ select: async () => ({ _id: userId, role: 'user', sessionVersion: 1 }) }));
  mock.method(User, 'findOneAndUpdate', async (_filter, update) => { assert.equal(update.$set.vpnDetectionCount, 0); return { _id: userId, blocked: false }; });
  mock.method(SecurityBlock, 'updateMany', async (filter, update) => { assert.deepEqual(filter.kind.$in, ['installation', 'email']); assert.equal(update.$set.active, false); });
  mock.method(realtime, 'emitUserSecurityChanged', () => {});
  await moderateUser({ params: { id: userId }, user: { _id: 'admin' }, body: { action: 'unban', reason: 'Appeal approved' } }, { json() {} }, error => { throw error; });
});

test('the atomic account ban blocks a fresh email on the same installation without a secondary block write', async () => {
  mock.method(User, 'exists', async filter => { assert.equal(filter.blocked, true); assert.equal(filter.vpnDetectionCount.$gte, 5); assert.equal(filter.$or[0].vpnInstallationKeys, 'key'); return { _id: userId }; });
  mock.method(SecurityBlock, 'exists', () => assert.fail('account record already enforces the ban'));
  await assert.rejects(assertNoSecurityBlock('key', undefined, 'another@example.test'), { statusCode: 403 });
});
test('account deletion preserves active hashed installation and email bans before removing identifiers', async () => {
  const blocks = [];
  mock.method(SecurityBlock, 'updateOne', async (filter, update) => blocks.push({ ...filter, ...update.$set }));
  await preserveVpnBlocks({ _id: userId, blocked: true, vpnDetectionCount: 5, vpnInstallationKeys: ['key'], email: 'user@example.test' });
  assert.deepEqual(blocks.map(item => item.kind), ['installation', 'email']);
  assert.equal(blocks[1].key, securityKey('email', 'user@example.test'));
});
