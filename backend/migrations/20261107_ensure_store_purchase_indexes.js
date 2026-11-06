/**
 * Explicit provisioning for the ledger indexes required by purchase claim
 * deduplication and user subscription lookups. Do not run without the normal
 * database migration approval and duplicate-key preflight.
 */
exports.up = async function up(db) {
  await db.collection('storepurchases').createIndex(
    { store: 1, transactionKey: 1 },
    { name: 'store_1_transactionKey_1', unique: true },
  );
  await db.collection('subscriptionpurchases').createIndex(
    { store: 1, transactionKey: 1 },
    { name: 'store_1_transactionKey_1', unique: true },
  );
  await db.collection('subscriptionpurchases').createIndex(
    { userId: 1, active: 1, expiresAt: 1 },
    { name: 'userId_1_active_1_expiresAt_1' },
  );
};
