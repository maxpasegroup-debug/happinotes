const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  exposeSubscriptionStoreProductIds,
  resolveSubscriptionPlanForStoreProduct,
  subscriptionProductIdForStore,
} = require('../dist/services/subscriptionProductMapping');

test('monthly and yearly plans resolve distinct store-specific products', () => {
  const monthly = {
    key: 'monthly', productId: 'legacy.monthly', active: true,
    storeProductIds: { android: 'play.monthly', ios: 'apple.monthly' },
  };
  const yearly = {
    key: 'yearly', productId: 'legacy.yearly', active: true,
    storeProductIds: { android: 'play.yearly', ios: 'apple.yearly' },
  };

  assert.equal(subscriptionProductIdForStore(monthly, 'android'), 'play.monthly');
  assert.equal(subscriptionProductIdForStore(monthly, 'ios'), 'apple.monthly');
  assert.equal(resolveSubscriptionPlanForStoreProduct([yearly], 'android', 'play.yearly'), yearly);
  assert.equal(resolveSubscriptionPlanForStoreProduct([yearly], 'ios', 'apple.yearly'), yearly);
});

test('unconfigured Apple IDs are omitted and Google IDs are never aliased to Apple', () => {
  const monthlyAppleId = process.env.APPLE_IAP_SUBSCRIPTION_MONTHLY_PRODUCT_ID;
  delete process.env.APPLE_IAP_SUBSCRIPTION_MONTHLY_PRODUCT_ID;
  const plan = { key: 'monthly', productId: 'legacy.monthly', active: true };
  try {
    const exposed = exposeSubscriptionStoreProductIds(plan);
    assert.equal(exposed.storeProductIds.android, 'legacy.monthly');
    assert.equal(exposed.storeProductIds.ios, undefined);
    assert.equal(resolveSubscriptionPlanForStoreProduct([plan], 'ios', 'legacy.monthly'), undefined);
  } finally {
    if (monthlyAppleId === undefined) delete process.env.APPLE_IAP_SUBSCRIPTION_MONTHLY_PRODUCT_ID;
    else process.env.APPLE_IAP_SUBSCRIPTION_MONTHLY_PRODUCT_ID = monthlyAppleId;
  }
});

test('unknown and cross-store products are rejected', () => {
  const plan = {
    key: 'monthly', productId: 'legacy.monthly', active: true,
    storeProductIds: { android: 'play.monthly', ios: 'apple.monthly' },
  };
  assert.equal(resolveSubscriptionPlanForStoreProduct([plan], 'ios', 'play.monthly'), undefined);
  assert.equal(resolveSubscriptionPlanForStoreProduct([plan], 'android', 'unknown'), undefined);
});

test('ambiguous store IDs fail closed', () => {
  const plans = [
    { key: 'monthly', productId: 'legacy.monthly', active: true, storeProductIds: { ios: 'duplicate' } },
    { key: 'yearly', productId: 'legacy.yearly', active: true, storeProductIds: { ios: 'duplicate' } },
  ];
  assert.equal(resolveSubscriptionPlanForStoreProduct(plans, 'ios', 'duplicate'), undefined);
});

test('existing yearly ledger claims preserve restore when the store mapping is unconfigured', () => {
  const yearly = {
    key: 'yearly', productId: 'current.yearly', active: false,
    storeProductIds: { android: 'play.yearly' },
  };
  const claim = { store: 'ios', productId: 'legacy.yearly', planKey: 'yearly' };
  assert.equal(resolveSubscriptionPlanForStoreProduct([yearly], 'ios', 'legacy.yearly'), undefined);
  assert.equal(resolveSubscriptionPlanForStoreProduct([yearly], 'ios', 'legacy.yearly', claim), yearly);
  assert.equal(resolveSubscriptionPlanForStoreProduct([yearly], 'android', 'legacy.yearly', claim), undefined);
});
