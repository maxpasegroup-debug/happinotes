const { test, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const realtime = require('../dist/services/realtime');
const { StorePurchase } = require('../dist/models/StorePurchase');
const { SubscriptionPurchase } = require('../dist/models/SubscriptionPurchase');
const { User } = require('../dist/models');
const { Otp } = require('../dist/models');
const { AccountDeletionRequest } = require('../dist/models/AccountDeletionRequest');
const { AccountDeletionReauth } = require('../dist/models/AccountDeletionReauth');
const { PasswordResetToken } = require('../dist/models/passwordResetToken');
const deletion = require('../dist/services/accountDeletion');
const worker = require('../dist/services/accountDeletionWorker');
const deletionController = require('../dist/controllers/accountDeletionController');
const auth = require('../dist/middleware/auth');
const { env } = require('../dist/config/env');

afterEach(() => mock.restoreAll());

function fakeRequest() {
  return {
    _id: 'user',
    status: 'requested',
    requestedAt: new Date(),
    checkpoints: { accessBlocked: false },
  };
}

function query(value) {
  return { session() { return this; }, then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); } };
}
function transaction() {
  const state = { committed: false, aborted: false, ended: false };
  mock.method(mongoose, 'startSession', async () => ({
    async withTransaction(callback) {
      try { await callback(); state.committed = true; }
      catch (error) { state.aborted = true; throw error; }
    },
    async endSession() { state.ended = true; },
  }));
  return state;
}

test('deletion request and pending marker commit before admin notification', async () => {
  const state = transaction();
  let stored;
  mock.method(AccountDeletionRequest, 'findOne', () => query(null));
  mock.method(AccountDeletionRequest.prototype, 'save', async function (options) {
    assert.ok(options.session);
    stored = this;
    return this;
  });
  mock.method(AccountDeletionRequest, 'updateOne', async () => ({}));
  let userUpdate;
  mock.method(User, 'updateOne', async (filter, update, options) => {
    assert.ok(options.session);
    userUpdate = { filter, update };
    return { matchedCount: 1 };
  });
  const event = mock.method(realtime, 'emitAccountDeletionsChanged', () => {
    assert.equal(state.committed, true);
  });
  const result = await deletion.requestAccountDeletion('64b000000000000000000001', 'client-key-123456789');
  assert.equal(result, stored);
  assert.match(stored.idempotencyKeyHash, /^[a-f0-9]{64}$/);
  assert.notEqual(stored.idempotencyKeyHash, 'client-key-123456789');
  assert.equal(userUpdate.update.$set.deletionState, 'pending');
  assert.equal(result.checkpoints.accessBlocked, true);
  assert.equal(event.mock.callCount(), 1);
  assert.equal(state.ended, true);
});

test('a concurrent duplicate request returns the existing active workflow', async () => {
  transaction();
  const existing = fakeRequest();
  let calls = 0;
  mock.method(AccountDeletionRequest, 'findOne', () => query(++calls === 5 ? existing : null));
  mock.method(AccountDeletionRequest.prototype, 'save', async () => { throw Object.assign(new Error('duplicate'), { code: 11000 }); });
  const result = await deletion.requestAccountDeletion('64b000000000000000000001', 'client-key-123456789');
  assert.equal(result, existing);
  assert.equal(calls, 5);
});

test('a failed pending-marker compare-and-set aborts creation without notifying admins', async () => {
  const state = transaction();
  mock.method(AccountDeletionRequest, 'findOne', () => query(null));
  mock.method(AccountDeletionRequest.prototype, 'save', async function () { return this; });
  mock.method(User, 'updateOne', async () => ({ matchedCount: 0 }));
  const event = mock.method(realtime, 'emitAccountDeletionsChanged', () => assert.fail('must not emit before commit'));
  await assert.rejects(deletion.requestAccountDeletion('64b000000000000000000001', 'client-key-123456789'), (error) => error.statusCode === 403);
  assert.equal(state.aborted, true);
  assert.equal(state.ended, true);
  assert.equal(event.mock.callCount(), 0);
});

test('account write checks reject pending users and active deletion requests', async () => {
  mock.method(User, 'findById', () => ({ select: async () => ({ blocked: false, deletionState: 'pending' }) }));
  mock.method(AccountDeletionRequest, 'exists', async () => false);
  assert.equal(await deletion.isAccountWritable('user'), false);

  mock.restoreAll();
  mock.method(User, 'findById', () => ({ select: async () => ({ blocked: false, deletionState: 'active' }) }));
  mock.method(AccountDeletionRequest, 'exists', async () => true);
  assert.equal(await deletion.isAccountWritable('user'), false);
});

test('reauthentication returns an opaque proof and stores only its hash', async () => {
  const passwordHash = await bcrypt.hash('correct-password', 4);
  let reauthRecord;
  mock.method(User, 'findById', () => ({ select: async () => ({ _id: 'user', password: passwordHash, blocked: false, deletionState: 'active' }) }));
  mock.method(AccountDeletionRequest, 'exists', async () => false);
  mock.method(AccountDeletionReauth, 'create', async (value) => { reauthRecord = value; return value; });
  let response;
  let error;
  await deletionController.requestDeletionReauth(
    { user: { _id: 'user' }, body: { password: 'correct-password' } },
    { json: (value) => { response = value; } },
    (value) => { error = value; },
  );
  assert.equal(error, undefined);
  assert.equal(response.success, true);
  assert.equal(typeof response.proof, 'string');
  assert.notEqual(reauthRecord.proofHash, response.proof);
  assert.equal(reauthRecord.userId, 'user');
});

test('existing JWTs are rejected after the deletion marker is set', async () => {
  const token = jwt.sign({ id: 'user' }, env.JWT_SECRET, { expiresIn: '5m' });
  mock.method(User, 'findById', async () => ({ _id: 'user', blocked: false, deletionState: 'pending' }));
  let error;
  await auth.authenticate(
    { headers: { authorization: `Bearer ${token}` } },
    {},
    (value) => { error = value; },
  );
  assert.equal(error.statusCode, 401);
});

test('deletion worker claims are lease-bounded and increment attempts', async () => {
  let filter;
  let update;
  mock.method(AccountDeletionRequest, 'findOneAndUpdate', async (query, changes) => {
    filter = query;
    update = changes;
    return fakeRequest();
  });
  const claimed = await deletion.claimDeletionRequest('request', 'worker-a');
  assert.ok(claimed);
  assert.deepEqual(filter.status.$in, ['requested', 'processing', 'failed_retryable']);
  assert.equal(update[0].$set.status, 'processing');
  assert.deepEqual(update[0].$set.attempts, { $add: [{ $ifNull: ['$attempts', 0] }, 1] });
});

test('worker failure is lease-owned and records only sanitized retry metadata', async () => {
  let filter;
  let update;
  mock.method(AccountDeletionRequest, 'updateOne', async (query, changes) => {
    filter = query;
    update = changes;
    return { matchedCount: 1 };
  });
  const result = await deletion.recordDeletionFailure(
    'request', 'worker-a', 'provider failure/secret', 'provider\nraw token', true, 1000,
  );
  assert.equal(result, true);
  assert.equal(filter.leaseOwner, 'worker-a');
  assert.equal(update[0].$set.status, 'failed_retryable');
  assert.equal(update[0].$set.failureCode, 'providerfailuresecret');
  assert.equal(update[0].$set.failureMessage, 'Deletion workflow failed at a checkpoint');
  assert.ok(update[1].$unset.includes('leaseOwner'));
  assert.deepEqual(update[0].$set.nextAttemptAt, { $add: ['$$NOW', 1000] });
});

test('next-worker claim is atomic and allows an expired lease to be recovered', async () => {
  let filter;
  let update;
  mock.method(AccountDeletionRequest, 'findOneAndUpdate', async (query, changes) => {
    filter = query;
    update = changes;
    return fakeRequest();
  });
  const claimed = await deletion.claimNextDeletionRequest('worker-b', 60_000);
  assert.ok(claimed);
  assert.deepEqual(filter.status.$in, ['requested', 'processing', 'failed_retryable']);
  assert.equal(filter.$expr.$and.length, 2);
  assert.equal(update[0].$set.status, 'processing');
  assert.deepEqual(update[0].$set.attempts, { $add: [{ $ifNull: ['$attempts', 0] }, 1] });
});

test('competing workers receive at most one claim for the same request', async () => {
  let calls = 0;
  mock.method(AccountDeletionRequest, 'findOneAndUpdate', async () => {
    calls += 1;
    return calls === 1 ? fakeRequest() : null;
  });
  const [first, second] = await Promise.all([
    deletion.claimNextDeletionRequest('worker-a'),
    deletion.claimNextDeletionRequest('worker-b'),
  ]);
  assert.equal(Boolean(first) + Boolean(second), 1);
});

test('worker performs only policy-independent cleanup and blocks at the policy gate', async () => {
  mock.method(AccountDeletionReauth, 'deleteMany', async () => ({}));
  mock.method(StorePurchase, 'updateMany', async () => ({}));
  mock.method(SubscriptionPurchase, 'updateMany', async () => ({}));
  const request = {
    _id: 'request',
    userId: 'user',
    requestedAt: new Date(),
    checkpoints: {
      authArtifacts: 'pending',
      preferencesAndDevices: 'pending',
      personalDataCleanup: 'pending',
    },
  };
  const updateCalls = [];
  let passwordDeletes = 0;
  let otpDeletes = 0;
  mock.method(User, 'updateOne', async (filter, update) => {
    updateCalls.push({ filter, update });
    return { matchedCount: 1 };
  });
  mock.method(User, 'findById', () => ({ select: async () => ({
    email: 'user@example.com', phoneNumber: '+919999999999', deletionState: 'pending',
  }) }));
  mock.method(PasswordResetToken, 'deleteMany', async () => { passwordDeletes += 1; });
  mock.method(Otp, 'deleteMany', async () => { otpDeletes += 1; });
  mock.method(AccountDeletionRequest, 'updateOne', async (filter, update) => {
    updateCalls.push({ filter, update });
    return { matchedCount: 1 };
  });

  const result = await worker.processClaimedDeletionRequest(request, 'worker-a');
  assert.equal(result, 'blocked');
  assert.equal(passwordDeletes, 1);
  assert.equal(otpDeletes, 1);
  assert.deepEqual(updateCalls.find((call) => call.update.$set?.deletionState).update.$set, {
    deletionState: 'pending',
    deletionRequestedAt: request.requestedAt,
  });
  const preferenceUpdate = updateCalls.find((call) => call.update.$set?.bookCollection);
  assert.deepEqual(preferenceUpdate.update.$set, {
    bookCollection: [], happyBiteCollection: [], favourites: [], fcmTokens: [],
  });
  const policyUpdate = updateCalls.at(-1).update;
  assert.equal(policyUpdate[0].$set.status, 'blocked_policy');
  assert.equal(policyUpdate[0].$set['checkpoints.entitlementPolicy'], 'deferred_policy');
  assert.equal(policyUpdate[0].$set.failureCode, 'POLICY_APPROVAL_REQUIRED');
});

test('worker retries a partial cleanup failure without recording provider text', async () => {
  mock.method(AccountDeletionReauth, 'deleteMany', async () => ({}));
  mock.method(StorePurchase, 'updateMany', async () => ({}));
  mock.method(SubscriptionPurchase, 'updateMany', async () => ({}));
  const request = {
    _id: 'request', userId: 'user', requestedAt: new Date(),
    checkpoints: { authArtifacts: 'pending', preferencesAndDevices: 'pending', personalDataCleanup: 'pending' },
  };
  let failureUpdate;
  mock.method(User, 'updateOne', async () => ({ matchedCount: 1 }));
  mock.method(User, 'findById', () => ({ select: async () => ({ email: 'user@example.com', deletionState: 'pending' }) }));
  mock.method(PasswordResetToken, 'deleteMany', async () => { throw new Error('provider secret token'); });
  mock.method(AccountDeletionRequest, 'updateOne', async (_filter, update) => {
    failureUpdate = update;
    return { matchedCount: 1 };
  });
  const result = await worker.processClaimedDeletionRequest(request, 'worker-a');
  assert.equal(result, 'failed');
  assert.equal(failureUpdate[0].$set.status, 'failed_retryable');
  assert.equal(failureUpdate[0].$set.failureMessage, 'Deletion workflow failed at a checkpoint');
  assert.doesNotMatch(failureUpdate[0].$set.failureMessage, /provider|secret|token/i);
});

test('restart-safe processing skips durable completed checkpoints', async () => {
  const request = {
    _id: 'request', userId: 'user', requestedAt: new Date(),
    checkpoints: { authArtifacts: 'complete', preferencesAndDevices: 'complete', profileAnonymization: 'complete', contactCleanup: 'complete', premiumEntitlement: 'complete', purchaseLedgerDetachment: 'complete' },
  };
  let policyUpdate;
  mock.method(User, 'updateOne', async () => ({ matchedCount: 1 }));
  mock.method(PasswordResetToken, 'deleteMany', async () => { throw new Error('must not repeat'); });
  mock.method(Otp, 'deleteMany', async () => { throw new Error('must not repeat'); });
  mock.method(AccountDeletionRequest, 'updateOne', async (_filter, update) => {
    policyUpdate = update;
    return { matchedCount: 1 };
  });
  const result = await worker.processClaimedDeletionRequest(request, 'worker-a');
  assert.equal(result, 'blocked');
  assert.equal(policyUpdate[0].$set.status, 'blocked_policy');
});
