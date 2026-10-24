const { test, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const router = require('../dist/routes/storePurchaseRoutes').default;
const purchaseService = require('../dist/services/subscriptionPurchase');
const planService = require('../dist/services/subscriptionPlans');
const { SubscriptionPurchase } = require('../dist/models/SubscriptionPurchase');
const { User } = require('../dist/models');
const { AccountDeletionRequest } = require('../dist/models/AccountDeletionRequest');

afterEach(() => mock.restoreAll());

function handler() {
  return router.stack.find((layer) => layer.route?.path === '/subscription-verify').route.stack[0].handle;
}

function request(restore, userId = 'user', store = 'android', productId = 'premium.monthly') {
  return {
    user: { _id: userId },
    body: {
      store, productId,
      verificationData: store === 'android' ? 'subscription-token' : undefined,
      transactionId: store === 'ios' ? 'apple-transaction' : undefined,
      restore,
    },
  };
}

function commonMocks(
  deletionPending = false,
  plans = [{ key: 'monthly', productId: 'premium.monthly', active: true }],
  insertedClaim = {
    _id: 'claim', userId: 'user', productId: 'premium.monthly', planKey: 'monthly', store: 'android',
  },
) {
  mock.method(AccountDeletionRequest, 'exists', async () => deletionPending);
  mock.method(planService, 'ensureSubscriptionPlans', async () => plans);
  mock.method(SubscriptionPurchase, 'init', async () => {});
  mock.method(SubscriptionPurchase, 'findOneAndUpdate', async () => insertedClaim);
  mock.method(SubscriptionPurchase, 'updateOne', async () => ({ matchedCount: 1 }));
  mock.method(User, 'findById', () => ({ select: async () => ({ blocked: false, deletionState: 'active', subscription: undefined }) }));
  mock.method(User, 'updateOne', async () => ({ matchedCount: 1 }));
  mock.method(purchaseService, 'verifySubscriptionPurchase', async () => ({
    transactionKey: 'a'.repeat(64), active: true, expiresAt: new Date(Date.now() + 60_000), autoRenewing: true,
  }));
}

test('restore may use a missing Play binding only for an existing same-user ledger claim', async () => {
  commonMocks();
  const exists = mock.method(SubscriptionPurchase, 'exists', async () => true);
  const verify = purchaseService.verifySubscriptionPurchase;
  let result;
  let error;
  await handler()(request(true), { json: (body) => { result = body; } }, (value) => { error = value; });
  assert.equal(error, undefined);
  assert.equal(result.success, true);
  assert.equal(exists.mock.calls.length, 1);
  assert.deepEqual(verify.mock.calls[0].arguments[5], { allowUnboundAccount: true });
});

test('client restore flag cannot authorize an unknown transaction', async () => {
  commonMocks();
  mock.method(SubscriptionPurchase, 'exists', async () => false);
  const verify = purchaseService.verifySubscriptionPurchase;
  let result;
  let error;
  await handler()(request(true), { json: (body) => { result = body; } }, (value) => { error = value; });
  assert.equal(error, undefined);
  assert.equal(result.success, true);
  assert.deepEqual(verify.mock.calls[0].arguments[5], { allowUnboundAccount: false });
});

test('a verified token already claimed by another user cannot be restored', async () => {
  commonMocks();
  mock.method(SubscriptionPurchase, 'exists', async () => false);
  mock.method(SubscriptionPurchase, 'findOneAndUpdate', async () => ({
    _id: 'claim', userId: 'other-user', productId: 'premium.monthly', planKey: 'monthly', store: 'android',
  }));
  let error;
  await handler()(request(false, 'user'), {}, (value) => { error = value; });
  assert.equal(error.statusCode, 403);
  assert.match(error.message, /another account/);
});

test('purchase verification is rejected after account deletion begins', async () => {
  commonMocks(true);
  let error;
  await handler()(request(false), {}, (value) => { error = value; });
  assert.equal(error.statusCode, 403);
  assert.match(error.message, /deletion is in progress/);
});

test('a Google product cannot be used as an unconfigured Apple product', async () => {
  commonMocks();
  const verify = mock.method(purchaseService, 'verifySubscriptionPurchase', async () => {
    throw new Error('must not reach provider verification');
  });
  let error;
  await handler()(request(false, 'user', 'ios', 'premium.monthly'), {}, (value) => { error = value; });
  assert.equal(error.statusCode, 400);
  assert.match(error.message, /Unknown subscription plan/);
  assert.equal(verify.mock.calls.length, 0);
});

test('a same-user legacy yearly ledger claim can be restored when Apple ID mapping is unconfigured', async () => {
  const yearlyPlan = {
    key: 'yearly', productId: 'legacy.yearly', active: false,
    storeProductIds: { android: 'play.yearly' },
  };
  const legacyClaim = {
    _id: 'old-yearly-claim', userId: 'user', store: 'ios',
    productId: 'legacy.yearly', planKey: 'yearly',
  };
  commonMocks(false, [yearlyPlan], legacyClaim);
  mock.method(SubscriptionPurchase, 'findOne', () => ({ select: async () => legacyClaim }));
  const verify = purchaseService.verifySubscriptionPurchase;
  let result;
  let error;
  await handler()(request(true, 'user', 'ios', 'legacy.yearly'), {
    json: (body) => { result = body; },
  }, (value) => { error = value; });
  assert.equal(error, undefined);
  assert.equal(result.success, true);
  assert.equal(verify.mock.calls[0].arguments[0], 'ios');
  assert.equal(verify.mock.calls[0].arguments[1], 'yearly');
  assert.equal(verify.mock.calls[0].arguments[2], 'legacy.yearly');
});
