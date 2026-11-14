const { test, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const { User } = require('../dist/models/User');
const { UserNetwork } = require('../dist/models/UserNetwork');
const { AccountDeletionRequest } = require('../dist/models/AccountDeletionRequest');
const moderation = require('../dist/services/accountModeration');
const network = require('../dist/services/userNetwork');
const controller = require('../dist/controllers/userSecurityController');
const realtime = require('../dist/services/realtime');
const deletion = require('../dist/services/accountDeletion');
const { registerAdminRealtime } = require('../dist/services/adminRealtime');
const jwt = require('jsonwebtoken');
const adminId = '64b000000000000000000001', userId = '64b000000000000000000002';
afterEach(() => { mock.restoreAll(); realtime.registerRealtimeServer(null); });
const response = () => ({ headersSent: false, statusCode: 200, setHeader() {}, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; this.headersSent = true; } });

test('temporary expiry, permanent bans and deletion status are distinct', () => {
  assert.equal(moderation.moderationStatus({ blocked: true }).status, 'permanent_ban');
  assert.equal(moderation.moderationStatus({ blocked: true, banExpiresAt: new Date(2000) }, 1000).status, 'temporary_ban');
  assert.equal(moderation.moderationStatus({ blocked: true, banExpiresAt: new Date(2000) }, 2000).status, 'active');
  assert.equal(moderation.moderationStatus({ blocked: true, deletionState: 'pending' }).status, 'deletion_pending');
});
test('ban input requires a reason and a future valid expiry', () => {
  for (const input of [{}, { action: 'temporary', reason: 'abuse', expiresAt: 'bad' }, { action: 'temporary', reason: 'abuse', expiresAt: new Date(0).toISOString() }, { action: 'permanent' }]) assert.throws(() => moderation.parseBan(input));
  assert.equal(moderation.parseBan({ action: 'permanent', reason: 'Repeated abuse' }).expiry, null);
});
test('ban expiry cannot clear a newer permanent ban', async () => {
  const expiry = new Date(0);
  const user = { _id: userId, blocked: true, banExpiresAt: expiry };
  mock.method(User, 'updateOne', async filter => { assert.equal(filter.banExpiresAt, expiry); return { matchedCount: 0 }; });
  mock.method(User, 'findById', () => ({ select: async () => ({ blocked: true, banExpiresAt: null, banReason: 'New ban', sessionVersion: 2 }) }));
  await moderation.releaseExpiredBan(user);
  assert.equal(user.blocked, true);
  assert.equal(user.banReason, 'New ban');
});
test('admin accounts cannot be banned or deleted', async () => {
  mock.method(User, 'findById', () => ({ select: async () => ({ _id: adminId, role: 'admin' }) }));
  for (const fn of [controller.moderateUser, controller.deleteUserAccount]) {
    let error;
    await fn({ params: { id: adminId }, user: { _id: adminId }, body: { action: 'permanent', reason: 'reason', confirmation: 'DELETE' } }, response(), value => { error = value; });
    assert.equal(error.statusCode, 403);
  }
});
test('moderation revokes sessions, guards against concurrent changes and records its actor', async () => {
  mock.method(User, 'findById', () => ({ select: async () => ({ _id: userId, role: 'user', sessionVersion: 3, deletionState: 'active' }) }));
  mock.method(User, 'findOneAndUpdate', async (filter, update) => {
    assert.equal(filter.role, 'user'); assert.ok(JSON.stringify(filter).includes('sessionVersion'));
    assert.equal(update.$inc.sessionVersion, 1); assert.equal(update.$set.blocked, true);
    assert.equal(update.$push.moderationHistory.$each[0].actorId, adminId);
    return { _id: userId, blocked: true, banReason: update.$set.banReason };
  });
  let emitted;
  mock.method(realtime, 'emitUserSecurityChanged', id => { emitted = id; });
  const res = response();
  await controller.moderateUser({ params: { id: userId }, user: { _id: adminId }, body: { action: 'permanent', reason: 'Abuse' } }, res, error => { throw error; });
  assert.equal(res.body.status, 'permanent_ban'); assert.equal(emitted, userId);
});
test('deletion queues existing cleanup for banned users and never directly removes their account', async () => {
  mock.method(User, 'findById', () => ({ select: async () => ({ _id: userId, role: 'user' }) }));
  mock.method(deletion, 'requestAccountDeletion', async (id, key, source, actor) => {
    assert.equal(id, userId); assert.equal(source, 'admin'); assert.equal(actor, adminId); assert.match(key, /admin-delete/);
    return { publicReference: 'HN-DEL-test' };
  });
  mock.method(User, 'updateOne', async () => ({}));
  mock.method(User, 'deleteOne', () => { throw new Error('must not bypass cleanup'); });
  const res = response();
  await controller.deleteUserAccount({ params: { id: userId }, user: { _id: adminId }, body: { confirmation: 'DELETE', reason: 'Malicious account' } }, res, error => { throw error; });
  assert.equal(res.statusCode, 202); assert.equal(res.body.status, 'deletion_pending');
});
test('telemetry ignores spoofed public IP and uses the server-resolved request address', async () => {
  const updates = [];
  mock.method(UserNetwork, 'findOne', () => ({ lean: async () => null }));
  mock.method(UserNetwork, 'updateOne', async (filter, update) => { updates.push({ filter, update }); });
  mock.method(network, 'lookupNetwork', async ip => { assert.equal(ip, '8.8.8.8'); return { status: 'unavailable' }; });
  await controller.recordNetwork({ ip: '::ffff:8.8.8.8', user: { _id: userId }, body: { networkType: 'wifi', publicIp: '1.1.1.1', deviceIp: '192.168.1.2' } }, response(), error => { throw error; });
  assert.equal(updates[0].update.$set.publicIp, '8.8.8.8'); assert.equal(updates[0].update.$set.deviceIp, '192.168.1.2');
});
test('private/invalid IPs are not geolocated and device-reported fields are bounded', async () => {
  for (const ip of ['127.0.0.1', '192.168.1.1', '10.1.2.3', '::1', 'fd00::1', '100.64.0.1', 'https://evil.test']) assert.equal(network.publicAddress(ip), undefined);
  assert.equal(network.parseNetwork({ networkType: 'wifi', carrier: 'x'.repeat(1000) }).carrier.length, 80);
  assert.throws(() => network.parseNetwork({ networkType: 'anything' }));
});
test('network lookup is disabled until explicitly configured', async () => {
  const before = process.env.SECURITY_GEOIP_PROVIDER;
  delete process.env.SECURITY_GEOIP_PROVIDER;
  try {
    mock.method(globalThis, 'fetch', () => { throw new Error('must not call an unconfigured provider'); });
    assert.equal((await network.lookupNetwork('8.8.8.8')).status, 'not_configured');
  } finally { if (before === undefined) delete process.env.SECURITY_GEOIP_PROVIDER; else process.env.SECURITY_GEOIP_PROVIDER = before; }
});
test('account socket room is derived from a verified token, never the supplied user ID', async () => {
  const namespaces = {};
  const server = { of(name) { return namespaces[name] ||= { use(fn) { this.auth = fn; return this; }, on(name, fn) { this[name] = fn; return this; } }; } };
  registerAdminRealtime(server);
  mock.method(jwt, 'verify', () => ({ id: userId, sessionVersion: 0 }));
  mock.method(User, 'findById', async () => ({ _id: userId, role: 'user', sessionVersion: 0, blocked: false, deletionState: 'active' }));
  mock.method(AccountDeletionRequest, 'exists', async () => false);
  let joined;
  const socket = { handshake: { auth: { token: 'valid', userId: adminId } }, data: {}, join(room) { joined = room; } };
  await new Promise((resolve, reject) => namespaces['/account'].auth(socket, error => error ? reject(error) : resolve()));
  namespaces['/account'].connection(socket);
  assert.equal(joined, `account:${userId}`);
});

test('Mongo changes notify only the affected account room and admin invalidation stream', () => {
  const { EventEmitter } = require('node:events');
  const stream = new EventEmitter();
  stream.close = async () => {};
  let pipeline;
  mock.method(User, 'watch', value => { pipeline = value; return stream; });
  const sent = [];
  realtime.registerRealtimeServer({ of: namespace => ({ to: room => ({ emit: event => sent.push({ namespace, room, event }) }), emit: event => sent.push({ namespace, event }) }) });
  const stop = realtime.watchUserSecurityChanges();
  stream.emit('change', { operationType: 'update', documentKey: { _id: userId } });
  assert.ok(JSON.stringify(pipeline).includes('sessionVersion'));
  assert.deepEqual(sent, [{ namespace: '/account', room: `account:${userId}`, event: 'account:changed' }, { namespace: '/admin', event: 'users:changed' }]);
  stop();
});
