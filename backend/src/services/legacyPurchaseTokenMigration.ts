import { createHash } from 'crypto';

/**
 * Offline-only planning types for a legacy Android purchase-token migration.
 * This module is deliberately not imported by the request handlers. A plan
 * must be reviewed and executed against a disposable copy before any shared
 * or production database is considered.
 */
export type LegacyPurchaseRecord = {
  id: string;
  store: 'android' | 'ios';
  transactionKey: string;
  userId: string;
  productId: string;
  /** Set only after the raw token has been verified against Google Play. */
  verifiedRawToken?: boolean;
};

export type LegacyMigrationAction =
  | 'unchanged'
  | 'migrate'
  | 'merge-duplicate'
  | 'manual-review';

export type LegacyMigrationPlan = {
  recordId: string;
  action: LegacyMigrationAction;
  currentKey: string;
  targetKey?: string;
  canonicalRecordId?: string;
  reason?: string;
};

const SHA256_KEY = /^[a-f0-9]{64}$/;

export function sha256PurchaseToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Build an idempotent, ownership-preserving plan without writing MongoDB.
 * Android keys that are not already SHA-256 are treated as legacy only when
 * an external Google verification step has confirmed the value is the raw
 * purchase token.  A 64-hex value is intentionally ambiguous and is never
 * rewritten automatically.
 */
export function planLegacyPurchaseTokenMigration(
  records: readonly LegacyPurchaseRecord[],
): LegacyMigrationPlan[] {
  const plans: LegacyMigrationPlan[] = [];
  const targetOwners = new Map<string, { recordId: string; userId: string; productId: string }>();

  for (const record of records) {
    // Snapshot data is treated as untrusted input even though the TypeScript
    // type says string. Never hash or emit a missing/non-string key.
    if (typeof record.transactionKey !== 'string' || record.transactionKey.trim().length === 0) {
      plans.push({ recordId: String(record.id), action: 'manual-review', currentKey: '',
        reason: 'Transaction key is missing or malformed.' });
      continue;
    }

    if (record.store !== 'android') {
      plans.push({ recordId: record.id, action: 'unchanged', currentKey: record.transactionKey,
        reason: 'Non-Android transaction keys use a different provider format.' });
      continue;
    }

    if (SHA256_KEY.test(record.transactionKey)) {
      const existing = targetOwners.get(record.transactionKey);
      if (existing && (existing.userId !== record.userId || existing.productId !== record.productId)) {
        throw new Error(`Ownership conflict for transaction key ${record.transactionKey}`);
      }
      if (existing) {
        plans.push({ recordId: record.id, action: 'merge-duplicate', currentKey: record.transactionKey,
          targetKey: record.transactionKey, canonicalRecordId: existing.recordId,
          reason: 'A duplicate canonical key is already represented by an owner-equivalent record.' });
        continue;
      }
      targetOwners.set(record.transactionKey, { recordId: record.id, userId: record.userId, productId: record.productId });
      plans.push({ recordId: record.id, action: 'unchanged', currentKey: record.transactionKey,
        targetKey: record.transactionKey, reason: 'Already a canonical SHA-256 key.' });
      continue;
    }

    if (!record.verifiedRawToken) {
      plans.push({ recordId: record.id, action: 'manual-review', currentKey: record.transactionKey,
        reason: 'Legacy key is not proven to be a raw Google token.' });
      continue;
    }

    const targetKey = sha256PurchaseToken(record.transactionKey);
    const existing = targetOwners.get(targetKey);
    if (existing) {
      if (existing.userId !== record.userId || existing.productId !== record.productId) {
        throw new Error(`Ownership conflict for migrated token ${targetKey}`);
      }
      plans.push({ recordId: record.id, action: 'merge-duplicate', currentKey: record.transactionKey,
        targetKey, canonicalRecordId: existing.recordId,
        reason: 'The same verified token is already represented by an owner-equivalent record.' });
      continue;
    }

    targetOwners.set(targetKey, { recordId: record.id, userId: record.userId, productId: record.productId });
    plans.push({ recordId: record.id, action: 'migrate', currentKey: record.transactionKey, targetKey,
      reason: 'Verified legacy raw token can be replaced by its SHA-256 key.' });
  }

  return plans;
}
