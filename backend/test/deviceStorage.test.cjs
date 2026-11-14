const { test, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const { User } = require('../dist/models/User');
const { UserNetwork } = require('../dist/models/UserNetwork');
const { UserDevice } = require('../dist/models/UserDevice');
const { DeviceReferenceCache } = require('../dist/models/DeviceReferenceCache');
const controller = require('../dist/controllers/userSecurityController');
const network = require('../dist/services/userNetwork');
const { validateDeviceReference, referenceTtl } = require('../dist/services/deviceReferenceCache');
const userId = '64b000000000000000000002', deviceId = '64b000000000000000000003';
const uuidA = '7108b55c-89f6-465c-a97a-4165a1b1d011', uuidB = '7108b55c-89f6-465c-a97a-4165a1b1d012';
const response = () => ({ headersSent: false, setHeader() {}, json(body) { this.body = body; this.headersSent = true; } });
const next = error => { throw error; };
afterEach(() => mock.restoreAll());

test('identity bootstrap returns a random UUID without creating an account or device', () => {
  const a = response(), b = response();
  controller.createDeviceIdentity({}, a); controller.createDeviceIdentity({}, b);
  assert.match(a.body.installationId, /^[a-f0-9-]{36}$/); assert.notEqual(a.body.installationId, b.body.installationId);
});
test('separate phones of the same model are upserted per account and installation, while repeat reports reuse the record', async () => {
  const records = new Map();
  mock.method(UserNetwork, 'updateOne', () => assert.fail('new clients must not overwrite the legacy snapshot'));
  mock.method(UserDevice, 'findOne', filter => ({ lean: async () => records.get(`${filter.userId}:${filter.installationId}`) || null }));
  mock.method(UserDevice, 'updateOne', async (filter, update, options) => {
    const key = `${filter.userId}:${filter.installationId}`;
    const previous = records.get(key);
    if (options?.upsert) assert.equal(options.runValidators, true);
    records.set(key, { ...(previous || update.$setOnInsert), ...previous, ...update.$set });
    return { matchedCount: 1 };
  });
  mock.method(network, 'lookupNetwork', async () => ({ status: 'not_configured', checkedAt: new Date() }));
  for (const installationId of [uuidA, uuidB, uuidA]) await controller.recordNetwork({ ip: '8.8.8.8', user: { _id: userId }, body: { networkType: 'wifi', deviceModel: 'moto g45 5G', installationId, userId: 'spoofed' } }, response(), next);
  assert.equal(records.size, 2); assert.ok(records.get(`${userId}:${uuidA}`).firstSeen);
  assert.ok(records.get(`${userId}:${uuidB}`).lastSeen);
  assert.ok(UserDevice.schema.indexes().some(([fields, options]) => fields.userId === 1 && fields.installationId === 1 && options.unique));
  assert.equal(UserDevice.schema.path('installationId').options.select, false);
});
test('invalid installation identifiers cannot create device records', async () => {
  mock.method(UserDevice, 'updateOne', () => assert.fail('no writes'));
  for (const installationId of ['', { $ne: null }, 'same-device', 'x'.repeat(1000)]) {
    let caught;
    await controller.recordNetwork({ ip: '8.8.8.8', user: { _id: userId }, body: { networkType: 'wifi', installationId } }, response(), error => { caught = error; });
    assert.equal(caught.statusCode, 400);
  }
});
test('concurrent first reports retry an upsert duplicate without inventing another device', async () => {
  mock.method(UserDevice, 'findOne', () => ({ lean: async () => ({ publicIp: '8.8.8.8', geo: { status: 'approximate', checkedAt: new Date() } }) }));
  let writes = 0;
  mock.method(UserDevice, 'updateOne', async (filter, update, options) => {
    assert.equal(filter.installationId, uuidA);
    writes++;
    if (writes === 1) throw Object.assign(new Error('duplicate'), { code: 11000 });
    assert.equal(options.upsert, undefined);
  });
  await controller.recordNetwork({ ip: '8.8.8.8', user: { _id: userId }, body: { networkType: 'wifi', installationId: uuidA } }, response(), next);
  assert.equal(writes, 2);
});
test('one user row contains all its devices, newest first, without changing account pagination', async () => {
  const devices = [{ _id: deviceId, userId, deviceModel: 'newest' }, { _id: '64b000000000000000000004', userId, deviceModel: 'older' }];
  const query = { select() { return this; }, sort() { return this; }, skip() { return this; }, limit() { return this; }, lean: async () => [{ _id: userId, name: 'User' }] };
  mock.method(User, 'find', () => query); mock.method(User, 'countDocuments', async () => 1);
  mock.method(UserNetwork, 'find', () => ({ lean: async () => [{ userId, deviceModel: 'legacy' }] }));
  mock.method(UserDevice, 'find', () => ({ select(fields) { assert.equal(fields, '-installationId'); return this; }, sort(order) { assert.equal(order.lastSeen, -1); return this; }, lean: async () => devices }));
  const res = response(); await controller.listUserSecurity({ query: {} }, res, next);
  assert.equal(res.body.users.length, 1); assert.equal(res.body.total, 1);
  assert.equal(res.body.users[0].devices.length, 2); assert.equal(res.body.users[0].network.deviceModel, 'newest');
});
const photo = { model: 'moto g45 5G', status: 'found', provider: 'serper', imageUrl: 'https://www.motorola.in/phone.jpg', sourceUrl: 'https://www.motorola.in/phone', modelSourceUrl: 'https://www.motorola.in/phone', searchTitle: 'Motorola G45 5G', userId: 'must-not-store', publicIp: '8.8.8.8' };
function savedDevice() {
  mock.method(User, 'findById', () => ({ select: async () => ({ role: 'user' }) }));
  mock.method(UserDevice, 'findOne', filter => { assert.equal(filter.userId, userId); assert.equal(filter._id, deviceId); return { lean: async () => ({ deviceModel: 'moto g45 5G' }) }; });
}
test('device cache writes shared model data only, with bounded TTL and no account/IP fields', async () => {
  savedDevice();
  mock.method(DeviceReferenceCache, 'updateOne', async (filter, update, options) => {
    assert.deepEqual(filter, { modelKey: 'moto g45 5g' });
    assert.equal(update.$set.photo.userId, undefined); assert.equal(update.$set.photo.publicIp, undefined);
    assert.equal(update.$set.expiresAt - update.$set.checkedAt, 7 * 86400000); assert.equal(options.upsert, true);
  });
  const res = response(); await controller.saveDeviceReference({ params: { id: userId }, query: { deviceId }, body: { photo } }, res, next);
  assert.equal(res.body.success, true);
});
test('cache reads use saved model and exclude expired records even before the Mongo TTL sweep', async () => {
  savedDevice();
  mock.method(DeviceReferenceCache, 'findOne', filter => {
    assert.equal(filter.modelKey, 'moto g45 5g'); assert.ok(filter.expiresAt.$gt instanceof Date);
    return { lean: async () => ({ photo, checkedAt: new Date(), expiresAt: new Date(Date.now() + 1000) }) };
  });
  const res = response(); await controller.getDeviceReference({ params: { id: userId }, query: { deviceId, model: 'spoofed' } }, res, next);
  assert.equal(res.body.photo.model, 'moto g45 5G');
});
test('cache lookup cannot read another accounts device or arbitrary model', async () => {
  mock.method(User, 'findById', () => ({ select: async () => ({ role: 'user' }) }));
  mock.method(UserDevice, 'findOne', filter => { assert.equal(filter.userId, userId); return { lean: async () => null }; });
  mock.method(DeviceReferenceCache, 'findOne', () => assert.fail('must not query cache'));
  let error; await controller.getDeviceReference({ params: { id: userId }, query: { deviceId } }, response(), value => { error = value; });
  assert.equal(error.statusCode, 404);
});
test('cache payload validation rejects mismatches, local URLs, oversized content and missing image metadata', () => {
  for (const candidate of [{ ...photo, model: 'Pixel 9' }, { ...photo, imageUrl: 'http://127.0.0.1/a' }, { ...photo, sourceUrl: 'javascript:alert(1)' }, { ...photo, searchTitle: 'x'.repeat(20000) }, { status: 'found', model: photo.model }]) assert.throws(() => validateDeviceReference(candidate, photo.model));
  assert.equal(referenceTtl('not_found'), 3600000); assert.equal(referenceTtl('unavailable'), 60000);
});

test('device locations require explicit consent, valid coordinates and a recent capture timestamp', () => {
  const valid = { latitude: 10, longitude: 76, accuracy: 20, capturedAt: new Date().toISOString(), consentVersion: 1, mocked: false };
  const saved = network.parseDeviceLocation({ ...valid, userId: 'spoofed', receivedAt: '1999-01-01' });
  assert.equal(saved.latitude, 10); assert.equal(saved.userId, undefined);
  assert.ok(saved.receivedAt.getTime() > Date.now() - 1000);
  assert.equal(network.parseDeviceLocation(null), null); assert.equal(network.parseDeviceLocation(undefined), undefined);
  for (const input of ['location', [], { ...valid, consentVersion: 0 }, { ...valid, latitude: 91 }, { ...valid, longitude: Infinity }, { ...valid, accuracy: -1 }, { ...valid, accuracy: '10' }, { ...valid, capturedAt: new Date(Date.now() - 3600000).toISOString() }, { ...valid, capturedAt: new Date(Date.now() + 3600000).toISOString() }, { ...valid, mocked: 'no' }]) {
    assert.throws(() => network.parseDeviceLocation(input), { statusCode: 400 });
  }
});
test('latest location is stored per authenticated installation; explicit null clears it and legacy reports leave it alone', async () => {
  const writes = [];
  mock.method(UserDevice, 'findOne', () => ({ lean: async () => ({ publicIp: '8.8.8.8', geo: { status: 'approximate', checkedAt: new Date() } }) }));
  mock.method(UserDevice, 'updateOne', async (filter, update) => { assert.equal(filter.userId, userId); assert.equal(filter.installationId, uuidA); writes.push(update); });
  const report = async extra => controller.recordNetwork({ ip: '8.8.8.8', user: { _id: userId }, body: { networkType: 'wifi', installationId: uuidA, ...extra } }, response(), next);
  await report({ deviceLocation: { latitude: 10, longitude: 76, accuracy: null, capturedAt: new Date().toISOString(), consentVersion: 1 } });
  assert.equal(writes[0].$set.deviceLocation.longitude, 76); assert.equal(writes[0].$set.geo, undefined);
  await report({ deviceLocation: null }); assert.equal(writes[1].$unset.deviceLocation, 1);
  await report({}); assert.equal(writes[2].$set.deviceLocation, undefined); assert.equal(writes[2].$unset, undefined);
});
test('location cannot be stored in a legacy network snapshot without an installation identity', async () => {
  mock.method(UserNetwork, 'updateOne', () => assert.fail('no write'));
  let caught;
  await controller.recordNetwork({ user: { _id: userId }, body: { networkType: 'wifi', deviceLocation: { latitude: 10, longitude: 76, accuracy: 20, capturedAt: new Date().toISOString(), consentVersion: 1 } } }, response(), error => { caught = error; });
  assert.equal(caught.statusCode, 400);
});
