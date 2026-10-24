const { test } = require('node:test');
const assert = require('node:assert/strict');
const { shouldReplaceSubscriptionEntitlement } = require('../dist/services/subscriptionEntitlement');

const future = (minutes) => new Date(Date.now() + minutes * 60_000);

test('a cancellation/expiry from another older transaction cannot remove a newer active entitlement', () => {
  const current = { transactionKey: 'newer', active: true, expiresAt: future(60) };
  const stale = { transactionKey: 'older', active: false, expiresAt: future(1) };
  assert.equal(shouldReplaceSubscriptionEntitlement(current, stale), false);
});

test('a renewal with a later expiry may replace a different active transaction', () => {
  const current = { transactionKey: 'old', active: true, expiresAt: future(10) };
  const renewal = { transactionKey: 'new', active: true, expiresAt: future(90) };
  assert.equal(shouldReplaceSubscriptionEntitlement(current, renewal), true);
});

test('same-transaction lifecycle transitions are authoritative and idempotent', () => {
  const current = { transactionKey: 'same', active: true, expiresAt: future(60) };
  assert.equal(shouldReplaceSubscriptionEntitlement(current, {
    transactionKey: 'same', active: false, expiresAt: future(60),
  }), true);
  assert.equal(shouldReplaceSubscriptionEntitlement(current, current), true);
});

test('an older signed Apple lifecycle state cannot overwrite a newer state in the same chain', () => {
  const current = { transactionKey: 'Sandbox:original', active: true, expiresAt: future(90),
    providerStateSignedAt: new Date('2026-10-24T10:00:00Z') };
  const staleNotification = { transactionKey: 'Sandbox:original', active: false, expiresAt: future(10),
    providerStateSignedAt: new Date('2026-10-24T09:00:00Z') };
  assert.equal(shouldReplaceSubscriptionEntitlement(current, staleNotification), false);
});
