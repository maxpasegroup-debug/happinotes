import { Router } from 'express';
import { createHash } from 'crypto';
import { Types } from 'mongoose';
import { OAuth2Client } from 'google-auth-library';
import { Type } from '@apple/app-store-server-library';
import { StorePurchase } from '../models/StorePurchase';
import { User } from '../models';
import { SubscriptionPurchase } from '../models/SubscriptionPurchase';
import { applePurchaseClient, googlePurchase, accountToken } from '../services/storePurchase';
import { appleSubscriptionNotification, googleSubscriptionNotification } from '../services/subscriptionPurchase';
import { applySubscriptionEntitlement } from '../services/subscriptionEntitlement';
import { AppError, BadRequestError, UnauthorizedError } from '../utils/errors';
import { isAccountWritable } from '../services/accountDeletion';

const router = Router();
const googleIdentity = new OAuth2Client();

async function updateAccess(claim: { _id: Types.ObjectId; userId: Types.ObjectId; bookId: Types.ObjectId }, active: boolean) {
  await StorePurchase.updateOne({ _id: claim._id }, { $set: { active } });
  if (!(await isAccountWritable(claim.userId))) return;
  if (active) {
    await User.updateOne({
      _id: claim.userId,
      $or: [{ deletionState: 'active' }, { deletionState: { $exists: false } }],
    }, { $addToSet: { purchasedBooks: claim.bookId } });
  } else {
    const anotherPurchase = await StorePurchase.exists({
      userId: claim.userId, bookId: claim.bookId, active: { $ne: false },
    });
    if (!anotherPurchase) {
      await User.updateOne({
        _id: claim.userId,
        $or: [{ deletionState: 'active' }, { deletionState: { $exists: false } }],
      }, { $pull: { purchasedBooks: claim.bookId } });
    }
  }
}

async function updateSubscriptionAccess(
  claim: { _id: Types.ObjectId; userId: Types.ObjectId; planKey: 'monthly' | 'yearly'; productId: string; store: 'android' | 'ios' },
  state: { active: boolean; expiresAt?: Date; autoRenewing?: boolean; transactionKey: string;
    providerStateSignedAt?: Date },
) {
  const filter: Record<string, unknown> = { _id: claim._id };
  if (state.providerStateSignedAt) {
    filter.$or = [
      { providerStateSignedAt: { $lte: state.providerStateSignedAt } },
      { providerStateSignedAt: { $exists: false } },
    ];
  }
  const update = await SubscriptionPurchase.updateOne(filter, { $set: {
    active: state.active, expiresAt: state.expiresAt, autoRenewing: state.autoRenewing,
    transactionKey: state.transactionKey,
    ...(state.providerStateSignedAt ? { providerStateSignedAt: state.providerStateSignedAt } : {}),
  } });
  const result = update as unknown as { matchedCount?: number; n?: number } | undefined;
  if (state.providerStateSignedAt && result && (result.matchedCount ?? result.n ?? 0) === 0) return;
  await applySubscriptionEntitlement(claim.userId, {
    store: claim.store, planKey: claim.planKey, productId: claim.productId,
    transactionKey: state.transactionKey, active: state.active, expiresAt: state.expiresAt,
    autoRenewing: state.autoRenewing, providerStateSignedAt: state.providerStateSignedAt,
    lastVerifiedAt: new Date(),
  });
}

export function googleNotificationClaimMatches(
  claim: { userId: Types.ObjectId | string },
  externalAccountId: unknown,
): boolean {
  return typeof externalAccountId === 'string' && externalAccountId.length > 0 &&
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
    const subscription = event.subscriptionNotification;
    if (subscription?.purchaseToken && subscription.subscriptionId) {
      // RTDN is authenticated by Google Pub/Sub and the authoritative Play
      // lookup. It is not an authenticated user purchase request: never pass
      // an empty account ID or allow this event to create a new claim.
      const verified = await googleSubscriptionNotification(subscription.subscriptionId, subscription.purchaseToken);
      const claim = await SubscriptionPurchase.findOne({
        store: 'android', transactionKey: verified.transactionKey,
      });
      if (claim && claim.productId === subscription.subscriptionId) {
        if (!googleNotificationClaimMatches(claim, verified.externalAccountId)) {
          throw new BadRequestError('Subscription notification account does not match the existing claim');
        }
        await updateSubscriptionAccess(claim, verified);
      }
      res.sendStatus(204);
      return;
    }
    const proof = event.oneTimeProductNotification?.purchaseToken ?? event.voidedPurchaseNotification?.purchaseToken;
    if (typeof proof !== 'string') { res.sendStatus(204); return; }
    const transactionKey = createHash('sha256').update(proof).digest('hex');
    const claim = await StorePurchase.findOne({ store: 'android', transactionKey });
    if (claim) {
      // Fetch current state so duplicate and out-of-order notifications are safe.
      const { purchase } = await googlePurchase(claim.productId, proof);
      if (purchase.obfuscatedExternalAccountId !== accountToken(String(claim.userId))) {
        throw new BadRequestError('Purchase notification account does not match the existing claim');
      }
      const active = purchase.purchaseState === 0 && purchase.consumptionState === 0;
      await updateAccess(claim, active);
    }
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
      if (!signedTransaction && !signedRenewal) { res.sendStatus(204); return; }
      throw new BadRequestError('Missing subscription transaction');
    }
    if (transaction?.transactionId) {
      const claim = await StorePurchase.findOne({ store: 'ios',
        transactionKey: `${environment}:${originalTransactionId}` });
      if (claim) {
        const latest = await client.getTransactionInfo(transaction.transactionId);
        if (!latest.signedTransactionInfo) throw new AppError('Transaction lookup failed', 503);
        const current = await verifier.verifyAndDecodeTransaction(latest.signedTransactionInfo);
        const active = current.revocationDate == null && current.type === Type.NON_CONSUMABLE &&
          current.productId === claim.productId && current.appAccountToken === accountToken(String(claim.userId));
        await updateAccess(claim, active);
      }
    }
    const subscriptionClaim = await SubscriptionPurchase.findOne({ store: 'ios',
      transactionKey: `${environment}:${originalTransactionId}` });
    if (subscriptionClaim) {
      const verified = await appleSubscriptionNotification(
        originalTransactionId,
        subscriptionClaim.productId,
        accountToken(String(subscriptionClaim.userId)),
      );
      await updateSubscriptionAccess(subscriptionClaim, verified);
    }
    res.sendStatus(204);
  } catch (error) {
    next(error instanceof AppError ? error : new AppError('Store notification processing failed', 503));
  }
});

export default router;
