const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  planLegacyPurchaseTokenMigration,
  sha256PurchaseToken,
} = require('../dist/services/legacyPurchaseTokenMigration');

test('legacy migration planning is idempotent and preserves owner/product identity', () => {
  const raw = 'legacy-google-token';
  const plan = planLegacyPurchaseTokenMigration([
    { id: 'legacy', store: 'android', transactionKey: raw, userId: 'user-a', productId: 'monthly', verifiedRawToken: true },
    { id: 'ios', store: 'ios', transactionKey: 'Sandbox:original', userId: 'user-a', productId: 'yearly' },
  ]);
  assert.equal(plan[0].action, 'migrate');
  assert.equal(plan[0].targetKey, sha256PurchaseToken(raw));
  assert.equal(plan[1].action, 'unchanged');

  const rerun = planLegacyPurchaseTokenMigration([
    { id: 'legacy', store: 'android', transactionKey: plan[0].targetKey, userId: 'user-a', productId: 'monthly' },
  ]);
  assert.equal(rerun[0].action, 'unchanged');
});

test('unverified legacy keys are held for manual review', () => {
  const [entry] = planLegacyPurchaseTokenMigration([
    { id: 'unknown', store: 'android', transactionKey: 'opaque-legacy-value', userId: 'user-a', productId: 'monthly' },
  ]);
  assert.equal(entry.action, 'manual-review');
});

test('same-owner duplicate tokens can be merged, but cross-owner collisions fail closed', () => {
  const records = [
    { id: 'first', store: 'android', transactionKey: 'same-token', userId: 'user-a', productId: 'monthly', verifiedRawToken: true },
    { id: 'second', store: 'android', transactionKey: 'same-token', userId: 'user-a', productId: 'monthly', verifiedRawToken: true },
  ];
  const plan = planLegacyPurchaseTokenMigration(records);
  assert.equal(plan[1].action, 'merge-duplicate');
  assert.equal(plan[1].canonicalRecordId, 'first');

  assert.throws(() => planLegacyPurchaseTokenMigration([
    records[0],
    { ...records[1], userId: 'user-b' },
  ]), /Ownership conflict/);

  const canonical = sha256PurchaseToken('raw-first');
  const reverseOrder = planLegacyPurchaseTokenMigration([
    { id: 'raw', store: 'android', transactionKey: 'raw-first', userId: 'user-a', productId: 'monthly', verifiedRawToken: true },
    { id: 'canonical', store: 'android', transactionKey: canonical, userId: 'user-a', productId: 'monthly' },
  ]);
  assert.equal(reverseOrder[1].action, 'merge-duplicate');
});

test('ambiguous 64-hex keys are not rewritten automatically', () => {
  const [entry] = planLegacyPurchaseTokenMigration([
    { id: 'ambiguous', store: 'android', transactionKey: 'a'.repeat(64), userId: 'user-a', productId: 'monthly', verifiedRawToken: true },
  ]);
  assert.equal(entry.action, 'unchanged');
  assert.match(entry.reason, /canonical SHA-256/);
});

test('product mismatches fail closed even when the user is the same', () => {
  assert.throws(() => planLegacyPurchaseTokenMigration([
    { id: 'monthly', store: 'android', transactionKey: 'same-token', userId: 'user-a', productId: 'monthly', verifiedRawToken: true },
    { id: 'yearly', store: 'android', transactionKey: 'same-token', userId: 'user-a', productId: 'yearly', verifiedRawToken: true },
  ]), /Ownership conflict/);
});

test('malformed candidate keys remain manual-review items', () => {
  const plan = planLegacyPurchaseTokenMigration([
    { id: 'empty', store: 'android', transactionKey: '', userId: 'user-a', productId: 'monthly', verifiedRawToken: true },
    { id: 'non-string', store: 'android', transactionKey: 123, userId: 'user-a', productId: 'monthly', verifiedRawToken: true },
  ]);
  assert.deepEqual(plan.map((entry) => entry.action), ['manual-review', 'manual-review']);
  assert.match(plan[0].reason, /malformed/);
  assert.match(plan[1].reason, /malformed/);
});

test('canonical duplicate conflicts are detected before a unique-index write', () => {
  const canonical = sha256PurchaseToken('raw-token');
  const sameOwner = planLegacyPurchaseTokenMigration([
    { id: 'canonical-a', store: 'android', transactionKey: canonical, userId: 'user-a', productId: 'monthly' },
    { id: 'canonical-b', store: 'android', transactionKey: canonical, userId: 'user-a', productId: 'monthly' },
  ]);
  assert.equal(sameOwner[1].action, 'merge-duplicate');
  assert.equal(sameOwner[1].canonicalRecordId, 'canonical-a');

  assert.throws(() => planLegacyPurchaseTokenMigration([
    { id: 'canonical-a', store: 'android', transactionKey: canonical, userId: 'user-a', productId: 'monthly' },
    { id: 'canonical-b', store: 'android', transactionKey: canonical, userId: 'user-b', productId: 'monthly' },
  ]), /Ownership conflict/);
});

test('repeating the same mixed input produces the same plan', () => {
  const records = [
    { id: 'raw', store: 'android', transactionKey: 'repeat-token', userId: 'user-a', productId: 'monthly', verifiedRawToken: true },
    { id: 'review', store: 'android', transactionKey: 'opaque', userId: 'user-a', productId: 'monthly' },
  ];
  assert.deepEqual(planLegacyPurchaseTokenMigration(records), planLegacyPurchaseTokenMigration(records));
});
