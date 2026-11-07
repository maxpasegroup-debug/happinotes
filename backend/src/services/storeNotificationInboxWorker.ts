import { randomUUID } from 'crypto';
import { Model } from 'mongoose';
import { StorePurchase } from '../models/StorePurchase';
import { SubscriptionPurchase } from '../models/SubscriptionPurchase';
import { IStoreNotificationInbox, StoreNotificationInbox } from '../models/StoreNotificationInbox';
import { StoreNotificationOpsAudit } from '../models/StoreNotificationOpsAudit';

const LEASE_MS = 60_000;
const MAX_RETRY_MS = 6 * 60 * 60_000;
const UNMATCHED_ALERT_AGE_MS = 60 * 60_000;
const STALE_OPS_AUDIT_AGE_MS = 5 * 60_000;

/** Aggregate-only signal for blocked work and unmatched events older than one hour. */
export async function monitorStoreNotificationInbox(): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - STALE_OPS_AUDIT_AGE_MS);
    const recovered = await StoreNotificationOpsAudit.updateMany({
      outcome: 'started', createdAt: { $lte: cutoff },
    }, {
      $set: { outcome: 'unknown', completedAt: new Date() },
      $unset: { httpStatus: 1 },
    });
    if (recovered.modifiedCount > 0) {
      console.error('store_notification_ops_audit_outcome_unknown', { count: recovered.modifiedCount });
    }
  } catch {
    console.error('store_notification_ops_audit_recovery_failed');
  }
  try {
    const cutoff = new Date(Date.now() - UNMATCHED_ALERT_AGE_MS);
    const [blockedCount, agedUnmatchedCount] = await Promise.all([
      StoreNotificationInbox.countDocuments({ status: 'blocked' }),
      StoreNotificationInbox.countDocuments({ status: 'unmatched', createdAt: { $lte: cutoff } }),
    ]);
    if (blockedCount > 0 || agedUnmatchedCount > 0) {
      console.error('store_notification_inbox_attention_required', { blockedCount, agedUnmatchedCount });
    }
  } catch {
    // Keep a stable, non-sensitive marker so host log monitoring can alert on monitoring failures too.
    console.error('store_notification_inbox_monitor_failed');
  }
}

async function claimNext(owner: string): Promise<IStoreNotificationInbox | null> {
  const now = new Date();
  return StoreNotificationInbox.findOneAndUpdate({ $or: [
    { status: { $in: ['recording', 'pending', 'retry', 'unmatched'] }, nextAttemptAt: { $lte: now } },
    { status: 'processing', $or: [{ leaseUntil: { $lte: now } }, { leaseUntil: { $exists: false } }] },
  ] }, {
    $set: { status: 'processing', leaseOwner: owner, leaseUntil: new Date(now.getTime() + LEASE_MS) },
    $inc: { attempts: 1 },
    $unset: { failureCode: 1 },
  }, { new: true, sort: { providerEventAt: 1, createdAt: 1 } }).select('+transactionKey');
}

function retryDelay(attempts: number): number {
  return Math.min(MAX_RETRY_MS, 1000 * 2 ** Math.min(attempts, 16));
}

async function finish(row: IStoreNotificationInbox, owner: string, status: 'processed' | 'blocked',
  failureCode?: IStoreNotificationInbox['failureCode']): Promise<void> {
  await StoreNotificationInbox.updateOne({ _id: row._id, status: 'processing', leaseOwner: owner }, {
    $set: { status, ...(failureCode ? { failureCode } : {}), ...(status === 'processed' ? { processedAt: new Date() } : {}) },
    $unset: { leaseOwner: 1, leaseUntil: 1 },
  });
}

async function releaseUnmatched(row: IStoreNotificationInbox, owner: string): Promise<void> {
  await StoreNotificationInbox.updateOne({ _id: row._id, status: 'processing', leaseOwner: owner }, {
    $set: { status: 'unmatched', failureCode: 'CLAIM_UNAVAILABLE',
      nextAttemptAt: new Date(Date.now() + retryDelay(row.attempts)) },
    $unset: { leaseOwner: 1, leaseUntil: 1 },
  });
}

async function retry(row: IStoreNotificationInbox, owner: string): Promise<void> {
  await StoreNotificationInbox.updateOne({ _id: row._id, status: 'processing', leaseOwner: owner }, {
    $set: { status: row.claimId ? 'retry' : 'unmatched', failureCode: 'PROCESSING_FAILED',
      nextAttemptAt: new Date(Date.now() + retryDelay(row.attempts)) },
    $unset: { leaseOwner: 1, leaseUntil: 1 },
  });
}

async function resolveClaim(row: IStoreNotificationInbox, owner: string): Promise<boolean> {
  if (row.claimId) return true;
  if (!row.transactionKey) {
    await finish(row, owner, 'blocked', 'LEGACY_UNORDERED');
    return false;
  }
  const store = row.provider === 'google_play' ? 'android' : 'ios';
  const claim = row.claimType === 'store_purchase'
    ? await StorePurchase.findOne({ store, transactionKey: row.transactionKey, productId: row.productId })
      .select('_id').lean()
    : await SubscriptionPurchase.findOne({ store, transactionKey: row.transactionKey, productId: row.productId })
      .select('_id').lean();
  if (!claim) {
    await releaseUnmatched(row, owner);
    return false;
  }
  const attached = await StoreNotificationInbox.updateOne({
    _id: row._id, status: 'processing', leaseOwner: owner, claimId: { $exists: false },
  }, { $set: { claimId: claim._id } });
  if (!attached.matchedCount) return false;
  row.claimId = claim._id;
  return true;
}

function sameSnapshot(row: IStoreNotificationInbox, claim: Record<string, any>): boolean {
  const dateEqual = (left?: Date, right?: Date) => (left?.getTime() ?? null) === (right?.getTime() ?? null);
  return claim.active === row.snapshot.active &&
    dateEqual(claim.expiresAt, row.snapshot.expiresAt) &&
    (claim.autoRenewing ?? null) === (row.snapshot.autoRenewing ?? null) &&
    dateEqual(claim.providerStateSignedAt, row.snapshot.providerStateSignedAt);
}

async function applyDetachedSnapshot(row: IStoreNotificationInbox, owner: string): Promise<void> {
  if (!await resolveClaim(row, owner)) return;
  if (!row.claimId || row.stateVersion === undefined) {
    await finish(row, owner, 'blocked', 'LEGACY_UNORDERED');
    return;
  }
  const model: Model<any> = row.claimType === 'store_purchase' ? StorePurchase : SubscriptionPurchase;
  const claim = row.claimType === 'store_purchase'
    ? await StorePurchase.findById(row.claimId)
      .select('userId productId active expiresAt autoRenewing providerStateSignedAt providerStateVersionAt providerStateVersion providerEventOrder').lean()
    : await SubscriptionPurchase.findById(row.claimId)
      .select('userId productId active expiresAt autoRenewing providerStateSignedAt providerStateVersionAt providerStateVersion providerEventOrder').lean();
  if (!claim) {
    await finish(row, owner, 'blocked', 'CLAIM_UNAVAILABLE');
    return;
  }
  if (claim.userId || claim.productId !== row.productId) {
    // A notification can be associated only with its exact ledger key and
    // product. Never apply an unmatched event to a linked account.
    await finish(row, owner, 'blocked', 'CLAIM_NOT_DETACHED');
    return;
  }
  const currentVersion = claim.providerStateVersion as number | undefined;
  if (currentVersion !== undefined && currentVersion > row.stateVersion) {
    await finish(row, owner, 'processed'); // stale event; newer verified evidence remains authoritative
    return;
  }
  if (currentVersion !== undefined && currentVersion === row.stateVersion) {
    if (sameSnapshot(row, claim)) await finish(row, owner, 'processed');
    else await finish(row, owner, 'blocked', 'ORDERING_AMBIGUOUS');
    return;
  }

  const updateFields = row.claimType === 'store_purchase'
    ? { active: row.snapshot.active, providerStateVersion: row.stateVersion,
      ...(row.stateVersionAt ? { providerStateVersionAt: row.stateVersionAt } : {}) }
    : {
      active: row.snapshot.active,
      ...(row.snapshot.expiresAt ? { expiresAt: row.snapshot.expiresAt } : {}),
      ...(row.snapshot.autoRenewing !== undefined ? { autoRenewing: row.snapshot.autoRenewing } : {}),
      ...(row.snapshot.providerStateSignedAt ? { providerStateSignedAt: row.snapshot.providerStateSignedAt } : {}),
      ...(row.stateVersionAt ? { providerStateVersionAt: row.stateVersionAt } : {}),
      providerStateVersion: row.stateVersion,
    };
  const versionFilter = currentVersion
    ? { providerStateVersion: currentVersion }
    : { providerStateVersion: { $exists: false } };
  const result = await model.updateOne({
    _id: row.claimId,
    productId: row.productId,
    $or: [{ userId: { $exists: false } }, { userId: null }],
    ...versionFilter,
  }, { $set: updateFields });
  if (result.matchedCount) {
    await finish(row, owner, 'processed');
    return;
  }

  // A competing event changed the claim after the read. Re-read and classify
  // it on the next lease; do not guess an order or overwrite on equal times.
  throw new Error('Detached notification version changed concurrently');
}

export async function processStoreNotificationInboxBatch(limit = 20): Promise<number> {
  let claimed = 0;
  for (let index = 0; index < limit; index += 1) {
    const owner = randomUUID();
    const row = await claimNext(owner);
    if (!row) break;
    try { await applyDetachedSnapshot(row, owner); }
    catch { await retry(row, owner).catch(() => undefined); }
    claimed += 1;
  }
  return claimed;
}

export function startStoreNotificationInboxWorker(): () => void {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try { await processStoreNotificationInboxBatch(); }
    catch { console.error('store_notification_inbox_worker_failed'); }
    finally { running = false; }
  };
  void tick();
  const timer = setInterval(() => { void tick(); }, 5000);
  timer.unref();
  void monitorStoreNotificationInbox();
  const monitorTimer = setInterval(() => { void monitorStoreNotificationInbox(); }, 60_000);
  monitorTimer.unref();
  return () => { clearInterval(timer); clearInterval(monitorTimer); };
}
