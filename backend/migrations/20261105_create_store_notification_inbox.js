/**
 * Explicit provisioning alternative for the Mongoose autoIndex startup path.
 * Run only through an approved deployment migration process; this task does
 * not execute it. The collection is intentionally never TTL-expired.
 */
exports.up = async function up(db) {
  const collection = db.collection('store_notification_inbox');
  await collection.createIndex(
    { provider: 1, providerEventId: 1 },
    { name: 'provider_event_unique', unique: true },
  );
  await collection.createIndex(
    { status: 1, nextAttemptAt: 1, providerEventAt: 1, createdAt: 1 },
    { name: 'pending_notification_worker' },
  );
  await collection.createIndex(
    { status: 1, leaseUntil: 1 },
    { name: 'expired_notification_lease_recovery' },
  );
  const leases = db.collection('store_notification_reconciliation_leases');
  await leases.createIndex(
    { provider: 1, lookupKey: 1 },
    { name: 'provider_transaction_lease_unique', unique: true },
  );
  await leases.createIndex(
    { leaseUntil: 1 },
    { name: 'expired_transaction_lease_recovery' },
  );
};
