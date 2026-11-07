const { test, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const { User } = require('../dist/models');
const { StorePurchase } = require('../dist/models/StorePurchase');
const { SubscriptionPurchase } = require('../dist/models/SubscriptionPurchase');
const deletion = require('../dist/services/accountDeletion');
const { processClaimedDeletionRequest } = require('../dist/services/accountDeletionWorker');

afterEach(() => mock.restoreAll());

test('deletion detaches ledger identity and content fields, then remains policy-blocked', async () => {
  const userId = 'aaaaaaaaaaaaaaaaaaaaaaaa';
  const storeUpdate = mock.method(StorePurchase, 'updateMany', async (filter, update) => {
    assert.deepEqual(filter, { userId });
    assert.deepEqual(update.$unset, { userId: 1, bookId: 1, __v: 1 });
    return { matchedCount: 1 };
  });
  const subscriptionUpdate = mock.method(SubscriptionPurchase, 'updateMany', async (filter, update) => {
    assert.deepEqual(filter, { userId });
    assert.deepEqual(update.$unset, { userId: 1, planKey: 1, priceVersion: 1, __v: 1 });
    return { matchedCount: 1 };
  });
  mock.method(User, 'updateOne', async () => ({ matchedCount: 1 }));
  mock.method(deletion, 'renewDeletionLease', async () => true);
  const checkpoint = mock.method(deletion, 'completeDeletionCheckpoint', async (_id, _owner, name) => {
    assert.equal(name, 'purchaseLedgerDetachment');
    return true;
  });
  const gate = mock.method(deletion, 'blockDeletionForPolicy', async () => true);

  const result = await processClaimedDeletionRequest({
    _id: 'request-id',
    userId,
    checkpoints: {
      authArtifacts: 'complete',
      preferencesAndDevices: 'complete',
      profileAnonymization: 'complete',
      contactCleanup: 'complete',
      premiumEntitlement: 'complete',
      purchaseLedgerDetachment: 'pending',
    },
  }, 'worker-lease');

  assert.equal(result, 'blocked');
  assert.equal(storeUpdate.mock.calls.length, 1);
  assert.equal(subscriptionUpdate.mock.calls.length, 1);
  assert.equal(checkpoint.mock.calls.length, 1);
  assert.equal(gate.mock.calls.length, 1);
});
