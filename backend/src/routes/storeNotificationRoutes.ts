import { Router } from 'express';
import { createHash, randomUUID } from 'crypto';
import mongoose, { ClientSession, Types } from 'mongoose';
import { OAuth2Client } from 'google-auth-library';
import { Type } from '@apple/app-store-server-library';
import { StorePurchase } from '../models/StorePurchase';
import { User } from '../models';
import { SubscriptionPurchase } from '../models/SubscriptionPurchase';
import { applePurchaseClient, googlePurchase, accountToken } from '../services/storePurchase';
import { appleDetachedSubscriptionNotification, appleSubscriptionNotification, googleSubscriptionNotification,
} from '../services/subscriptionPurchase';
import { applySubscriptionEntitlement } from '../services/subscriptionEntitlement';
import { IStoreNotificationInbox, StoreNotificationInbox, NotificationClaimType,
  NotificationProvider } from '../models/StoreNotificationInbox';
import { StoreNotificationReconciliationLease } from '../models/StoreNotificationReconciliationLease';
import { AppError, BadRequestError, UnauthorizedError } from '../utils/errors';
import { isAccountWritable } from '../services/accountDeletion';

const router = Router();
const googleIdentity = new OAuth2Client();

type GoogleLeaseContext = {
  id: Types.ObjectId;
  owner: string;
  lookupKey: string;
  generation: number;
};

async function withGoogleTransactionLease<T>(transactionKey: string,
  operation: (lease: GoogleLeaseContext, assertLease: () => Promise<void>) => Promise<T>): Promise<T> {
  const lookupKey = createHash('sha256').update(`google_play:${transactionKey}`).digest('hex');
  const owner = randomUUID();
  const now = new Date();
  let lease;
  try {
    lease = await StoreNotificationReconciliationLease.findOneAndUpdate({ provider: 'google_play', lookupKey,
      $or: [{ leaseUntil: { $lte: now } }, { leaseUntil: { $exists: false } }] }, {
      $set: { leaseOwner: owner, leaseUntil: new Date(now.getTime() + 120_000) }, $inc: { generation: 1 },
    }, { upsert: true, new: true, setDefaultsOnInsert: true });
  } catch {
    throw new AppError('Store transaction is already being reconciled; retry notification.', 503);
  }
  if (!lease) throw new AppError('Store transaction is already being reconciled; retry notification.', 503);
  const assertLease = async () => {
    const held = await StoreNotificationReconciliationLease.exists({ _id: lease!._id,
      leaseOwner: owner, leaseUntil: { $gt: new Date() } });
    if (!held) throw new AppError('Store reconciliation lease expired; retry notification.', 503);
  };
  try {
    return await operation({ id: lease._id, owner, lookupKey, generation: lease.generation }, assertLease);
  }
  finally {
    await StoreNotificationReconciliationLease.updateOne({ _id: lease._id, leaseOwner: owner }, {
      $unset: { leaseOwner: 1, leaseUntil: 1 },
    }).catch(() => undefined);
  }
}

/**
 * A write to the lease document inside the same MongoDB transaction as the
 * linked ledger/User writes fences out a handler whose lease expired or whose
 * generation has already been superseded.
 */
async function fenceGoogleLeaseInTransaction(session: ClientSession, lease: GoogleLeaseContext): Promise<void> {
  const result = await StoreNotificationReconciliationLease.updateOne({
    _id: lease.id,
    leaseOwner: lease.owner,
    generation: lease.generation,
    $expr: { $gt: ['$leaseUntil', '$$NOW'] },
  }, [{ $set: { leaseUntil: { $add: ['$$NOW', 120_000] }, updatedAt: '$$NOW' } }],
  { session, timestamps: false });
  if (!result.matchedCount) {
    throw new AppError('Store reconciliation lease expired; retry notification.', 503);
  }
}

async function withGoogleFencedTransaction<T>(lease: GoogleLeaseContext,
  operation: (session: ClientSession) => Promise<T>): Promise<T> {
  const session = await mongoose.startSession();
  try {
    let value!: T;
    await session.withTransaction(async () => {
      await fenceGoogleLeaseInTransaction(session, lease);
      value = await operation(session);
      return value;
    });
    return value;
  } finally {
    await session.endSession();
  }
}

async function persistVerifiedEvent(input: {
  provider: NotificationProvider;
  providerEventId: string;
  claimType: NotificationClaimType;
  claimId?: Types.ObjectId;
  transactionKey: string;
  productId: string;
  eventType: string;
  providerEventAt: Date;
  stateVersion: number;
  stateVersionAt?: Date;
  snapshot: { active: boolean; expiresAt?: Date; autoRenewing?: boolean; providerStateSignedAt?: Date };
}): Promise<void> {
  const snapshot = {
    active: input.snapshot.active,
    ...(input.snapshot.expiresAt ? { expiresAt: input.snapshot.expiresAt } : {}),
    ...(input.snapshot.autoRenewing !== undefined ? { autoRenewing: input.snapshot.autoRenewing } : {}),
    ...(input.snapshot.providerStateSignedAt ? { providerStateSignedAt: input.snapshot.providerStateSignedAt } : {}),
  };
  const durableInput = { ...input, snapshot };
  const insertFields: Record<string, unknown> = { ...durableInput,
    status: input.provider === 'google_play' ? 'recording' : input.claimId ? 'pending' : 'unmatched',
    attempts: 0, nextAttemptAt: new Date() };
  if (input.provider === 'google_play') {
    delete insertFields.stateVersionAt;
  }
  let row: IStoreNotificationInbox | null = null;
  try {
    await StoreNotificationInbox.findOneAndUpdate(
      { provider: input.provider, providerEventId: input.providerEventId },
      { $setOnInsert: insertFields },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    row = await StoreNotificationInbox.findOne({ provider: input.provider,
      providerEventId: input.providerEventId }).select('+transactionKey');
  } catch (error) {
    // A concurrent redelivery may win the unique-key insert. Read and verify
    // that it is the same durable event before acknowledging this delivery.
    row = await StoreNotificationInbox.findOne({ provider: input.provider,
      providerEventId: input.providerEventId }).select('+transactionKey');
    if (!row) throw error;
  }
  if (!row || (row.claimId && input.claimId && String(row.claimId) !== String(input.claimId)) ||
      row.claimType !== input.claimType || row.productId !== input.productId ||
      row.eventType !== input.eventType || (row.transactionKey && row.transactionKey !== input.transactionKey)) {
    throw new AppError('Store notification event conflicts with a recorded event', 503);
  }
  if (input.provider === 'google_play') {
    // This follows a fresh authoritative Play API lookup while the hashed
    // transaction lease is held. MongoDB supplies the ordering timestamp,
    // avoiding app-replica clock skew; the lease generation orders snapshots.
    const write = await StoreNotificationInbox.updateOne({ _id: row._id,
      $or: [{ stateVersion: { $lt: input.stateVersion } }, { stateVersion: { $exists: false } }] }, {
      $set: { transactionKey: input.transactionKey, productId: input.productId,
        eventType: input.eventType, providerEventAt: input.providerEventAt, snapshot,
        stateVersion: input.stateVersion, ...(input.claimId ? { claimId: input.claimId } : {}),
        status: input.claimId || row.claimId ? 'pending' : 'unmatched', nextAttemptAt: new Date() },
      $currentDate: { stateVersionAt: true },
      $unset: { failureCode: 1, processedAt: 1, leaseOwner: 1, leaseUntil: 1 },
    });
    if (!write.matchedCount) {
      const latest = await StoreNotificationInbox.findById(row._id).select('+transactionKey');
      if (!latest || typeof latest.stateVersion !== 'number' || latest.stateVersion < input.stateVersion ||
          (latest.stateVersion === input.stateVersion && !sameVerifiedSnapshot(latest.snapshot, snapshot))) {
        throw new AppError('Verified notification state could not be safely ordered', 503);
      }
      // A duplicate or expired lease owner cannot replace a newer snapshot.
    }
    return;
  }
  // A duplicate delivery may now have a fresher authoritative lookup or a
  // ledger row that was created after the first delivery. Only advance state;
  // never replace a newer snapshot or reopen an event currently being leased.
  const existingVersion = row.stateVersion ?? 0;
  const incomingVersion = input.stateVersion;
  if (existingVersion === incomingVersion && !sameVerifiedSnapshot(row.snapshot, snapshot)) {
    if (row.status !== 'processing') {
      await StoreNotificationInbox.updateOne({ _id: row._id, status: row.status,
        stateVersion: input.stateVersion }, {
        $set: { status: 'blocked', failureCode: 'ORDERING_AMBIGUOUS' },
        $unset: { leaseOwner: 1, leaseUntil: 1, processedAt: 1 },
      });
    }
    throw new AppError('Store notification state ordering is ambiguous; provider retry required', 503);
  }
  if (existingVersion === incomingVersion && sameVerifiedSnapshot(row.snapshot, snapshot) && input.claimId &&
      ['blocked', 'unmatched', 'retry'].includes(row.status)) {
    await StoreNotificationInbox.updateOne({ _id: row._id, status: row.status,
      stateVersion: input.stateVersion }, {
      $set: { claimId: input.claimId, status: 'pending', nextAttemptAt: new Date() },
      $unset: { failureCode: 1, processedAt: 1 },
    });
  }
  if (incomingVersion === existingVersion && sameVerifiedSnapshot(row.snapshot, snapshot) &&
      (!row.transactionKey || (!row.claimId && input.claimId))) {
    await StoreNotificationInbox.updateOne({ _id: row._id, stateVersion: input.stateVersion,
      status: { $ne: 'processing' } }, {
      $set: { transactionKey: input.transactionKey, ...(input.claimId ? { claimId: input.claimId } : {}),
        status: input.claimId ? 'pending' : 'unmatched', nextAttemptAt: new Date() },
      $unset: { failureCode: 1, processedAt: 1 },
    });
  }
  if (incomingVersion > existingVersion) {
    const write = await StoreNotificationInbox.updateOne({ _id: row._id, provider: input.provider,
      providerEventId: input.providerEventId,
      $or: [{ stateVersion: { $lt: input.stateVersion } }, { stateVersion: { $exists: false } }] }, {
      $set: { transactionKey: input.transactionKey, stateVersion: input.stateVersion,
        ...(input.stateVersionAt ? { stateVersionAt: input.stateVersionAt } : {}),
        snapshot, ...(input.claimId ? { claimId: input.claimId } : {}),
        status: input.claimId ? 'pending' : 'unmatched', nextAttemptAt: new Date() },
      $unset: { failureCode: 1, processedAt: 1, leaseOwner: 1, leaseUntil: 1 },
    });
    if (!write.matchedCount) {
      const latest = await StoreNotificationInbox.findById(row._id).select('+transactionKey');
      if (!latest) throw new AppError('Verified notification event could not be confirmed', 503);
      if (latest.stateVersion === input.stateVersion && !sameVerifiedSnapshot(latest.snapshot, snapshot)) {
        await StoreNotificationInbox.updateOne({ _id: latest._id, stateVersion: input.stateVersion }, {
          $set: { status: 'blocked', failureCode: 'ORDERING_AMBIGUOUS' },
          $unset: { processedAt: 1, leaseOwner: 1, leaseUntil: 1 },
        });
        throw new AppError('Store notification state ordering is ambiguous; provider retry required', 503);
      }
      if (typeof latest.stateVersion !== 'number' || latest.stateVersion < input.stateVersion) {
        throw new AppError('Verified notification event could not be safely ordered', 503);
      }
    }
  }
}

function sameVerifiedSnapshot(left: IStoreNotificationInbox['snapshot'], right: typeof left): boolean {
  const dateEqual = (a?: Date, b?: Date) => (a?.getTime() ?? null) === (b?.getTime() ?? null);
  return left.active === right.active && dateEqual(left.expiresAt, right.expiresAt) &&
    (left.autoRenewing ?? null) === (right.autoRenewing ?? null) &&
    dateEqual(left.providerStateSignedAt, right.providerStateSignedAt);
}

function googleEventTime(value: unknown): Date {
  const milliseconds = typeof value === 'number' || typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isSafeInteger(milliseconds) || milliseconds <= 0) {
    throw new BadRequestError('Invalid store notification timestamp');
  }
  const date = new Date(milliseconds);
  if (!Number.isFinite(date.getTime())) throw new BadRequestError('Invalid store notification timestamp');
  return date;
}

function appleEventTime(value: unknown): Date {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw new BadRequestError('Invalid store notification timestamp');
  }
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new BadRequestError('Invalid store notification timestamp');
  return date;
}

async function updateAccess(claim: { _id: Types.ObjectId; userId?: Types.ObjectId; bookId?: Types.ObjectId },
  active: boolean, googleLease?: GoogleLeaseContext) {
  // The direct route updates linked claims only. Detached evidence is handled
  // by the durable inbox worker and must never restore account-level access.
  const userId = claim.userId;
  if (!userId || !claim.bookId) return;
  const ledgerFilter: Record<string, unknown> = { _id: claim._id, userId };
  if (googleLease) {
    ledgerFilter.$or = [
      { providerStateVersion: { $lt: googleLease.generation } },
      { providerStateVersion: { $exists: false } },
    ];
  }
  if (!(await isAccountWritable(userId))) return;

  if (googleLease) {
    await withGoogleFencedTransaction(googleLease, async (session) => {
      if (!(await isAccountWritable(userId, session))) return false;
      const ledgerWrite = await StorePurchase.updateOne(ledgerFilter, { $set: {
        active, providerStateVersion: googleLease.generation, providerStateVersionAt: new Date(),
      } }, { session });
      if (!ledgerWrite.matchedCount) return false;
      const userFilter = { _id: userId,
        $or: [{ deletionState: 'active' }, { deletionState: { $exists: false } }] };
      if (active) {
        await User.updateOne(userFilter, { $addToSet: { purchasedBooks: claim.bookId } }, { session });
      } else {
        const anotherPurchase = await StorePurchase.findOne({
          userId, bookId: claim.bookId, active: { $ne: false },
        }).select('_id').session(session).lean();
        if (!anotherPurchase) await User.updateOne(userFilter,
          { $pull: { purchasedBooks: claim.bookId } }, { session });
      }
      return true;
    });
    return;
  }

  const ledgerWrite = await StorePurchase.updateOne(ledgerFilter, { $set: { active } });
  if (!ledgerWrite.matchedCount) return;
  if (active) {
    await User.updateOne({
      _id: userId,
      $or: [{ deletionState: 'active' }, { deletionState: { $exists: false } }],
    }, { $addToSet: { purchasedBooks: claim.bookId } });
  } else {
    const anotherPurchase = await StorePurchase.exists({
      userId, bookId: claim.bookId, active: { $ne: false },
    });
    if (!anotherPurchase) {
      await User.updateOne({
        _id: userId,
        $or: [{ deletionState: 'active' }, { deletionState: { $exists: false } }],
      }, { $pull: { purchasedBooks: claim.bookId } });
    }
  }
}

async function updateSubscriptionAccess(
  claim: { _id: Types.ObjectId; userId?: Types.ObjectId; planKey?: 'monthly' | 'yearly'; productId: string; store: 'android' | 'ios'; priceVersion?: number },
  state: { active: boolean; expiresAt?: Date; autoRenewing?: boolean; transactionKey: string;
    providerStateSignedAt?: Date }, googleLease?: GoogleLeaseContext,
) {
  // The direct route updates linked claims only. Detached evidence is handled
  // by the durable inbox worker and must never restore account-level access.
  const userId = claim.userId;
  const planKey = claim.planKey;
  if (!userId || !planKey) return;
  // Purchases verified before price versioning are the initial cohort.
  // Keeping this lookup local avoids making store webhooks depend on catalog DB reads.
  const priceVersion = claim.priceVersion ?? 1;
  const filter: Record<string, unknown> = { _id: claim._id, userId };
  const guards: Record<string, unknown>[] = [];
  if (googleLease) {
    guards.push({ $or: [
      { providerStateVersion: { $lt: googleLease.generation } },
      { providerStateVersion: { $exists: false } },
    ] });
  }
  if (state.providerStateSignedAt) {
    guards.push({ $or: [
      { providerStateSignedAt: { $lte: state.providerStateSignedAt } },
      { providerStateSignedAt: { $exists: false } },
    ] });
  }
  if (guards.length) filter.$and = guards;
  const updateLedgerAndEntitlement = async (session?: ClientSession): Promise<boolean> => {
    if (session && !(await isAccountWritable(userId, session))) return false;
    const update = await SubscriptionPurchase.updateOne(filter, { $set: {
      active: state.active, expiresAt: state.expiresAt, autoRenewing: state.autoRenewing,
      priceVersion,
      transactionKey: state.transactionKey,
      ...(state.providerStateSignedAt ? { providerStateSignedAt: state.providerStateSignedAt } : {}),
      ...(googleLease ? { providerStateVersion: googleLease.generation,
        providerStateVersionAt: new Date() } : {}),
    } }, session ? { session } : {});
    if (!update.matchedCount) return false;
    await applySubscriptionEntitlement(userId, {
    store: claim.store, planKey, productId: claim.productId,
    priceVersion,
    transactionKey: state.transactionKey, active: state.active, expiresAt: state.expiresAt,
    autoRenewing: state.autoRenewing, providerStateSignedAt: state.providerStateSignedAt,
    lastVerifiedAt: new Date(),
    }, session);
    return true;
  };

  if (googleLease) {
    if (!(await isAccountWritable(userId))) return;
    await withGoogleFencedTransaction(googleLease, updateLedgerAndEntitlement);
  } else {
    await updateLedgerAndEntitlement();
  }
}

export function googleNotificationClaimMatches(
  claim: { userId?: Types.ObjectId | string },
  externalAccountId: unknown,
): boolean {
  return Boolean(claim.userId) && typeof externalAccountId === 'string' && externalAccountId.length > 0 &&
    externalAccountId === accountToken(String(claim.userId));
}

// Google Pub/Sub authenticated push, configured for Play RTDN including voided purchases.
router.post('/google', async (req, res, next) => {
  try {
    const audience = process.env.IAP_GOOGLE_NOTIFICATION_AUDIENCE;
    const email = process.env.IAP_GOOGLE_NOTIFICATION_EMAIL;
    if (!audience || !email) throw new AppError('Store notifications are not configured', 503);
    const token = req.headers.authorization?.replace(/^Bearer /, '');
    if (!token) throw new UnauthorizedError();
    let identity;
    try {
      identity = (await googleIdentity.verifyIdToken({ idToken: token, audience })).getPayload();
    } catch { throw new UnauthorizedError('Invalid store notification identity'); }
    if (identity?.email !== email || identity.email_verified !== true) throw new UnauthorizedError();
    const encoded = req.body?.message?.data;
    if (typeof encoded !== 'string' || encoded.length > 50000) throw new BadRequestError('Invalid notification');
    const event = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
    if (event.packageName !== process.env.GOOGLE_PLAY_PACKAGE_NAME) throw new BadRequestError('Unexpected app');
    const providerEventId = req.body?.message?.messageId;
    const subscription = event.subscriptionNotification;
    if (subscription?.purchaseToken && subscription.subscriptionId) {
      // RTDN is authenticated by Google Pub/Sub and the authoritative Play
      // lookup. It is not an authenticated user purchase request: never pass
      // an empty account ID or allow this event to create a new claim.
      // Resolve only after authoritative provider verification, matching the
      // linked-account flow. Notifications cannot create or attach a claim.
      const transactionKey = createHash('sha256').update(subscription.purchaseToken).digest('hex');
      await withGoogleTransactionLease(transactionKey, async (lease, assertLease) => {
        const verified = await googleSubscriptionNotification(subscription.subscriptionId, subscription.purchaseToken);
        const claim = await SubscriptionPurchase.findOne({ store: 'android', transactionKey: verified.transactionKey });
        if (typeof providerEventId !== 'string' || !providerEventId || providerEventId.length > 200) {
          throw new BadRequestError('Invalid store notification event ID');
        }
        if (claim && claim.productId === subscription.subscriptionId && claim.userId) {
          if (!googleNotificationClaimMatches({ userId: claim.userId }, verified.externalAccountId)) {
            throw new BadRequestError('Subscription notification account does not match the existing claim');
          }
          await assertLease();
          await updateSubscriptionAccess(claim, verified, lease);
          return;
        }
        await assertLease();
        await persistVerifiedEvent({
          provider: 'google_play', providerEventId, claimType: 'subscription_purchase',
          ...(claim && claim.productId === subscription.subscriptionId ? { claimId: claim._id } : {}),
          transactionKey: verified.transactionKey, productId: subscription.subscriptionId,
          eventType: `subscription:${String(subscription.notificationType ?? 'unknown')}`,
          providerEventAt: googleEventTime(event.eventTimeMillis), stateVersion: lease.generation, snapshot: verified,
        });
      });
      res.sendStatus(204);
      return;
    }
    const proof = event.oneTimeProductNotification?.purchaseToken ?? event.voidedPurchaseNotification?.purchaseToken;
    if (typeof proof !== 'string') {
      if (event.testNotification) { res.sendStatus(204); return; }
      throw new AppError('Store notification has no verifiable transaction; please retry.', 503);
    }
    const transactionKey = createHash('sha256').update(proof).digest('hex');
    const eventSku = event.oneTimeProductNotification?.sku;
    await withGoogleTransactionLease(transactionKey, async (lease, assertLease) => {
      const claim = await StorePurchase.findOne({ store: 'android', transactionKey });
      const productId = claim?.productId ?? (typeof eventSku === 'string' ? eventSku : undefined);
      if (!productId) throw new AppError('Unmatched voided purchase cannot be verified; please retry.', 503);
      if (eventSku && claim && eventSku !== claim.productId) throw new BadRequestError('Purchase product does not match the existing claim');
      const { purchase } = await googlePurchase(productId, proof);
      const active = purchase.purchaseState === 0 && purchase.consumptionState === 0;
      if (typeof providerEventId !== 'string' || !providerEventId || providerEventId.length > 200) {
        throw new BadRequestError('Invalid store notification event ID');
      }
      if (claim?.userId) {
        if (purchase.obfuscatedExternalAccountId !== accountToken(String(claim.userId))) {
          throw new BadRequestError('Purchase notification account does not match the existing claim');
        }
        await assertLease();
        await updateAccess(claim, active, lease);
        return;
      }
      await assertLease();
      await persistVerifiedEvent({
        provider: 'google_play', providerEventId, claimType: 'store_purchase',
        ...(claim ? { claimId: claim._id } : {}), transactionKey, productId,
        eventType: event.oneTimeProductNotification ? 'one_time_product' : 'voided_purchase',
        providerEventAt: googleEventTime(event.eventTimeMillis), stateVersion: lease.generation, snapshot: { active },
      });
    });
    res.sendStatus(204);
  } catch (error) {
    next(error instanceof AppError ? error : new AppError('Store notification processing failed', 503));
  }
});

// App Store Server Notifications V2: verify both the notification and transaction JWS.
router.post('/apple', async (req, res, next) => {
  try {
    const signedPayload = req.body?.signedPayload;
    if (typeof signedPayload !== 'string' || signedPayload.length > 100000) {
      throw new BadRequestError('Invalid notification');
    }
    const { client, verifier, environment } = applePurchaseClient();
    let notification;
    try { notification = await verifier.verifyAndDecodeNotification(signedPayload); }
    catch { throw new UnauthorizedError('Invalid store notification signature'); }
    const signedTransaction = notification.data?.signedTransactionInfo;
    const signedRenewal = notification.data?.signedRenewalInfo;
    const transaction = signedTransaction
      ? await verifier.verifyAndDecodeTransaction(signedTransaction)
      : undefined;
    const renewal = signedRenewal
      ? await verifier.verifyAndDecodeRenewalInfo(signedRenewal)
      : undefined;
    const originalTransactionId = transaction?.originalTransactionId ?? renewal?.originalTransactionId;
    if (!originalTransactionId || (renewal?.originalTransactionId &&
        renewal.originalTransactionId !== originalTransactionId)) {
      if (!signedTransaction && !signedRenewal && notification.notificationType === 'TEST') {
        res.sendStatus(204);
        return;
      }
      if (!signedTransaction && !signedRenewal) {
        throw new AppError('Unclassified Apple notification requires transaction data; please retry.', 503);
      }
      throw new BadRequestError('Missing subscription transaction');
    }
    const providerEventId = notification.notificationUUID;
    if (transaction?.transactionId && transaction.type === Type.NON_CONSUMABLE) {
      const claim = await StorePurchase.findOne({ store: 'ios',
        transactionKey: `${environment}:${originalTransactionId}` });
      if (typeof providerEventId !== 'string' || !providerEventId || providerEventId.length > 200) {
        throw new BadRequestError('Invalid store notification event ID');
      }
      const latest = await client.getTransactionInfo(transaction.transactionId);
      if (!latest.signedTransactionInfo) throw new AppError('Transaction lookup failed', 503);
      const current = await verifier.verifyAndDecodeTransaction(latest.signedTransactionInfo);
      const expectedProduct = claim?.productId ?? transaction.productId;
      if (typeof expectedProduct !== 'string' || expectedProduct.length === 0) {
        throw new AppError('Apple notification has no verifiable product; please retry.', 503);
      }
      const transactionKey = `${environment}:${current.originalTransactionId}`;
      if (current.originalTransactionId !== originalTransactionId || current.productId !== expectedProduct ||
          current.type !== Type.NON_CONSUMABLE) {
        throw new BadRequestError('Purchase notification does not match the verified transaction');
      }
      const active = current.revocationDate == null;
      const signedStateTime = typeof current.signedDate === 'number' &&
        Number.isSafeInteger(current.signedDate) && current.signedDate > 0
        ? new Date(current.signedDate) : undefined;
      if (!signedStateTime || !Number.isFinite(signedStateTime.getTime())) {
        throw new AppError('Apple transaction is missing a valid state timestamp; please retry.', 503);
      }
      if (claim?.userId) {
        const linkedActive = active && current.appAccountToken === accountToken(String(claim.userId));
        await updateAccess(claim, linkedActive);
      } else {
        await persistVerifiedEvent({
          provider: 'apple', providerEventId, claimType: 'store_purchase',
          ...(claim ? { claimId: claim._id } : {}), transactionKey, productId: expectedProduct,
          eventType: `one_time:${String(notification.notificationType ?? 'unknown')}`,
          providerEventAt: appleEventTime(notification.signedDate), stateVersion: signedStateTime.getTime(),
          stateVersionAt: signedStateTime,
          snapshot: { active },
        });
      }
      res.sendStatus(204);
      return;
    }
    const subscriptionClaim = await SubscriptionPurchase.findOne({ store: 'ios',
      transactionKey: `${environment}:${originalTransactionId}` });
    const linkedSubscriptionUserId = subscriptionClaim?.userId;
    const productId = subscriptionClaim?.productId ?? transaction?.productId;
    if (!productId) throw new AppError('Apple notification has no verifiable product; please retry.', 503);
    if (typeof providerEventId !== 'string' || !providerEventId || providerEventId.length > 200) {
      throw new BadRequestError('Invalid store notification event ID');
    }
    let verified: Awaited<ReturnType<typeof appleDetachedSubscriptionNotification>>;
    if (subscriptionClaim && linkedSubscriptionUserId) {
      verified = await appleSubscriptionNotification(originalTransactionId,
        subscriptionClaim.productId, accountToken(String(linkedSubscriptionUserId)));
      await updateSubscriptionAccess(subscriptionClaim, verified);
    } else {
      verified = await appleDetachedSubscriptionNotification(originalTransactionId, productId);
      await persistVerifiedEvent({
        provider: 'apple', providerEventId, claimType: 'subscription_purchase',
        ...(subscriptionClaim ? { claimId: subscriptionClaim._id } : {}),
        transactionKey: verified.transactionKey, productId,
        eventType: `subscription:${String(notification.notificationType ?? 'unknown')}`,
        providerEventAt: appleEventTime(notification.signedDate),
        stateVersion: (verified.providerStateSignedAt ?? appleEventTime(notification.signedDate)).getTime(),
        stateVersionAt: verified.providerStateSignedAt ?? appleEventTime(notification.signedDate), snapshot: verified,
      });
    }
    res.sendStatus(204);
  } catch (error) {
    next(error instanceof AppError ? error : new AppError('Store notification processing failed', 503));
  }
});

export default router;
