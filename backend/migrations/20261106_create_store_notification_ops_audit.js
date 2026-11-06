/** Explicit index migration for the restricted operational access audit collection. */
exports.up = async function up(db) {
  const collection = db.collection('store_notification_ops_audit');
  await collection.createIndex(
    { createdAt: -1 },
    { name: 'ops_audit_created_at' },
  );
  await collection.createIndex(
    { operatorId: 1, createdAt: -1 },
    { name: 'ops_audit_operator_created_at' },
  );
  await collection.createIndex(
    { outcome: 1, createdAt: 1 },
    { name: 'ops_audit_outcome_created_at' },
  );
};

