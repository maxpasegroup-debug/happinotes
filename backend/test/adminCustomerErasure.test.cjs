const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { once } = require('node:events');
const { createServer } = require('node:net');
const { spawn } = require('node:child_process');
const mongoose = require('mongoose');
const { User, Otp, AccountDeletionReauth, AccountDeletionRequest } = require('../dist/models');
const { UserNetwork } = require('../dist/models/UserNetwork');
const { UserDevice } = require('../dist/models/UserDevice');
const { PasswordResetToken } = require('../dist/models/passwordResetToken');
const { StorePurchase } = require('../dist/models/StorePurchase');
const { SubscriptionPurchase } = require('../dist/models/SubscriptionPurchase');
const { SecurityBlock } = require('../dist/models/SecurityBlock');
const { eraseCustomerData } = require('../dist/services/accountDeletionWorker');
const { securityKey } = require('../dist/services/vpnSecurity');

// Uses a fresh loopback replica set; never reads the application's database URI.
test('admin erase is atomic, scoped, repeatable, and retains detached claims and blocks', {
  skip: process.env.HAPPINOTES_TEST_MONGOD ? false : 'Set HAPPINOTES_TEST_MONGOD to a local mongod executable',
}, async t => {
  const dir = await mkdtemp(join(tmpdir(), 'hn-erasure-db-'));
  const socket = createServer();
  socket.listen(0, '127.0.0.1');
  await once(socket, 'listening');
  const address = '127.0.0.1:' + socket.address().port;
  await new Promise(resolve => socket.close(resolve));
  const server = spawn(process.env.HAPPINOTES_TEST_MONGOD, [
    '--dbpath', dir, '--bind_ip', '127.0.0.1', '--port', address.split(':')[1], '--replSet', 'qa',
    '--oplogSize', '24', '--wiredTigerCacheSizeGB', '0.25', '--logpath', join(dir, 'mongod.log'),
  ]);
  const stopped = once(server, 'exit');
  t.after(async () => {
    await mongoose.disconnect();
    if (server.exitCode === null) { server.kill('SIGTERM'); await stopped; }
    await rm(dir, { recursive: true, force: true });
  });
  const boot = new mongoose.mongo.MongoClient('mongodb://' + address + '/?directConnection=true');
  try {
    await boot.connect();
    await boot.db('admin').command({ replSetInitiate: { _id: 'qa', members: [{ _id: 0, host: address }] } });
  } finally { await boot.close(); }
  await mongoose.connect('mongodb://' + address + '/qa?replicaSet=qa');
  const owned = [UserDevice, UserNetwork, PasswordResetToken, AccountDeletionReauth, AccountDeletionRequest];
  await Promise.all([User, Otp, ...owned, StorePurchase, SubscriptionPurchase, SecurityBlock].map(model => model.init()));

  const id = new mongoose.Types.ObjectId(), other = new mongoose.Types.ObjectId();
  const email = 'erased@example.invalid';
  await User.collection.insertMany([{ _id: id, name: 'Disposable', role: 'user', email, blocked: true,
    vpnDetectionCount: 5, vpnInstallationKeys: ['install-hash', 'shared-install-hash'] }, { _id: other, role: 'admin', email: 'keep@example.invalid' }]);
  for (const model of owned) {
    await model.collection.insertMany([id, other].map(userId => ({ userId, ...(model === AccountDeletionReauth && { proofHash: String(userId) }) })));
  }
  for (const model of [StorePurchase, SubscriptionPurchase]) {
    const details = model === StorePurchase ? { bookId: id } : { planKey: 'monthly', priceVersion: 1 };
    await model.collection.insertMany([{ userId: id, store: 'android', transactionKey: 'a', ...details },
      { userId: other, store: 'android', transactionKey: 'b' }]);
  }
  await Otp.collection.insertMany([{ identifier: email }, { identifier: 'keep@example.invalid' }]);
  await SecurityBlock.collection.insertMany([{ kind: 'ip', key: 'keep-hash', userId: id, reason: email, active: true },
    { kind: 'ip', key: 'old-hash', userId: id, active: false },
    { kind: 'installation', key: 'shared-install-hash', userId: other, reason: 'separate restriction', active: true }]);

  const failure = t.mock.method(UserNetwork, 'deleteMany', async () => { throw Error('simulated write failure'); });
  await assert.rejects(eraseCustomerData(String(id)), /simulated write failure/);
  assert.ok(await User.exists({ _id: id }));
  assert.ok(await UserDevice.exists({ userId: id }));
  failure.mock.restore();
  await assert.rejects(eraseCustomerData(String(other)), { statusCode: 403 });
  await AccountDeletionRequest.updateOne({ userId: id }, { $set: { status: 'processing', leaseUntil: new Date(Date.now() + 60000) } });
  await assert.rejects(eraseCustomerData(String(id)), { statusCode: 409 });
  await AccountDeletionRequest.updateOne({ userId: id }, { $set: { status: 'blocked_policy' }, $unset: { leaseUntil: 1 } });
  await eraseCustomerData(String(id));
  await eraseCustomerData(String(id));
  assert.equal(await User.exists({ _id: id }), null);
  assert.ok(await User.exists({ _id: other }));
  for (const model of owned) {
    assert.equal(await model.countDocuments({ userId: id }), 0, model.modelName);
    assert.equal(await model.countDocuments({ userId: other }), 1, model.modelName);
  }
  assert.equal(await Otp.countDocuments({ identifier: email }), 0);
  assert.equal(await Otp.countDocuments({ identifier: 'keep@example.invalid' }), 1);
  for (const model of [StorePurchase, SubscriptionPurchase]) {
    const detached = await model.collection.findOne({ transactionKey: 'a' });
    assert.ok(detached);
    for (const key of ['userId', 'bookId', 'planKey', 'priceVersion']) assert.equal(detached[key], undefined);
    assert.ok(await model.exists({ transactionKey: 'b', userId: other }));
  }
  assert.equal(await SecurityBlock.countDocuments({ userId: id }), 0);
  assert.ok(await SecurityBlock.exists({ key: 'shared-install-hash', userId: other, active: true }));
  assert.equal(await SecurityBlock.countDocuments({ key: 'old-hash' }), 0);
  for (const key of ['keep-hash', 'install-hash', securityKey('email', email)]) {
    assert.ok(await SecurityBlock.exists({ key, active: true, reason: { $ne: email }, userId: { $exists: false } }));
  }
});
