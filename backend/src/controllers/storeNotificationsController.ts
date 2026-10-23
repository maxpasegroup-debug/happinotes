import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { StoreNotificationEvent, StoreSubscription, User } from '../models';
import { env } from '../config/env';
import { STORE_PRODUCTS } from '../config/storeProducts';
import {
  verifyAppleNotification,
  verifyAppleNotificationTransaction,
  verifyAppleNotificationRenewal,
  getGoogleObfuscatedAccountId,
  verifyGoogleNotificationPurchase,
} from '../services/storeVerification';
import { syncSubscriptionEntitlement } from '../services/subscriptionEntitlement';
import { AppError, BadRequestError } from '../utils/errors';
import type { IUser } from '../models/User';

const claimEvent = async (store: 'apple' | 'google', eventId: string) => {
  try {
    const event = await StoreNotificationEvent.findOneAndUpdate(
      { store, eventId },
      { $setOnInsert: { store, eventId, state: 'processing' } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return event;
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error;
    return StoreNotificationEvent.findOne({ store, eventId });
  }
};

const markProcessed = async (store: 'apple' | 'google', eventId: string) => {
  await StoreNotificationEvent.updateOne(
    { store, eventId },
    { $set: { state: 'processed', processedAt: new Date() } }
  );
};

const reconcileApple = async (notification: Awaited<ReturnType<typeof verifyAppleNotification>>) => {
  if (!notification.signedTransactionInfo) return;
  const transaction = await verifyAppleNotificationTransaction(notification.signedTransactionInfo);
  if (
    transaction.bundleId !== STORE_PRODUCTS.apple.bundleId ||
    transaction.productId !== STORE_PRODUCTS.apple.productId ||
    !transaction.originalTransactionId ||
    !transaction.transactionId ||
    !transaction.expiresDate
  ) throw new BadRequestError('Apple notification transaction is not for the configured product');

  const originalId = transaction.originalTransactionId;
  const current = await StoreSubscription.findOne({ store: 'apple', transactionKey: originalId });
  const eventTime = notification.signedDate ? new Date(notification.signedDate) : new Date();
  if (current?.lastStoreEventAt && current.lastStoreEventAt >= eventTime) return;
  const accountToken = transaction.appAccountToken;
  const user = ((accountToken
    ? await User.findOne({ storeAccountToken: accountToken }).select('+storeAccountToken')
    : null) || (current ? await User.findById(current.userId).select('+storeAccountToken') : null)) as unknown as IUser | null;
  if (!user) return; // Never create access from an unlinked store notification.
  if (current && current.userId.toString() !== user._id.toString()) return;

  let expiresAt = new Date(transaction.expiresDate);
  let willRenew: boolean | null = null;
  if (notification.signedRenewalInfo) {
    const renewal = await verifyAppleNotificationRenewal(notification.signedRenewalInfo);
    if (renewal.autoRenewStatus === 0) willRenew = false;
    if (renewal.autoRenewStatus === 1) willRenew = true;
    if (renewal.gracePeriodExpiresDate) {
      const graceExpiry = new Date(renewal.gracePeriodExpiresDate);
      if (!Number.isNaN(graceExpiry.getTime()) && graceExpiry > expiresAt) expiresAt = graceExpiry;
    }
  }
  const forcedRevocation = ['REFUND', 'REVOKE'].includes(notification.notificationType);
  const forcedExpiration = ['EXPIRED', 'GRACE_PERIOD_EXPIRED'].includes(notification.notificationType);
  const transactionRevoked = transaction.revocationDate !== undefined && transaction.revocationDate !== null;
  const active = !forcedRevocation && !forcedExpiration && !transactionRevoked && expiresAt > new Date();
  const state = forcedRevocation || transactionRevoked ? 'revoked' : active ? 'active' : 'expired';

  await StoreSubscription.findOneAndUpdate(
    { store: 'apple', transactionKey: originalId },
    { $set: {
      userId: user._id,
      productId: transaction.productId,
      latestTransactionId: transaction.transactionId,
      ...(willRenew !== null ? { willRenew } : {}),
      purchaseTokenHash: crypto.createHash('sha256').update(notification.signedTransactionInfo).digest('hex'),
      state,
      expiresAt,
      lastVerifiedAt: new Date(),
      lastStoreEventAt: eventTime,
    } },
    { upsert: true, new: true, runValidators: true }
  );
  await syncSubscriptionEntitlement(user);
};

export const appleStoreNotification = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const signedPayload = req.body?.signedPayload;
    if (typeof signedPayload !== 'string' || signedPayload.length > 100_000) {
      return next(new BadRequestError('Apple signed notification is missing or invalid'));
    }
    const notification = await verifyAppleNotification(signedPayload);
    const existing = await claimEvent('apple', notification.notificationUUID);
    if (existing?.state === 'processed') { res.sendStatus(200); return; }
    await reconcileApple(notification);
    await markProcessed('apple', notification.notificationUUID);
    res.sendStatus(200);
  } catch (err) { next(err); }
};

type GooglePush = {
  message?: { data?: string; messageId?: string; message_id?: string };
};

const authorizeGooglePush = async (authorization: string | undefined): Promise<void> => {
  if (!env.GOOGLE_PUBSUB_AUDIENCE || !env.GOOGLE_PUBSUB_SERVICE_ACCOUNT_EMAIL) {
    throw new AppError('Google Pub/Sub authentication is not configured', 503);
  }
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) throw new AppError('Unauthorized store notification', 401);
  let response: globalThis.Response;
  try {
    response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token)}`, {
      signal: AbortSignal.timeout(10_000),
    });
  } catch { throw new AppError('Google Pub/Sub authentication is temporarily unavailable', 503); }
  if (!response.ok) throw new AppError('Unauthorized store notification', 401);
  const claims = await response.json() as { aud?: string; email?: string; email_verified?: boolean | string; iss?: string; exp?: string };
  const expiry = Number(claims.exp || 0) * 1000;
  if (
    claims.aud !== env.GOOGLE_PUBSUB_AUDIENCE ||
    claims.email?.toLowerCase() !== env.GOOGLE_PUBSUB_SERVICE_ACCOUNT_EMAIL.toLowerCase() ||
    !(claims.email_verified === true || claims.email_verified === 'true') ||
    !['accounts.google.com', 'https://accounts.google.com'].includes(claims.iss || '') ||
    expiry <= Date.now()
  ) throw new AppError('Unauthorized store notification', 401);
};

const reconcileGoogle = async (event: Record<string, unknown>) => {
  const subscriptionNotification = event.subscriptionNotification as {
    purchaseToken?: string; subscriptionId?: string;
  } | undefined;
  const voidedNotification = event.voidedPurchaseNotification as { purchaseToken?: string; refundType?: number } | undefined;
  const purchaseToken = subscriptionNotification?.purchaseToken || voidedNotification?.purchaseToken;
  if (!purchaseToken) return;
  if (event.packageName !== 'com.happinotes.app') throw new BadRequestError('Google notification package is invalid');

  const purchaseTokenHash = crypto.createHash('sha256').update(purchaseToken).digest('hex');
  const current = await StoreSubscription.findOne({ store: 'google', purchaseTokenHash });
  const productId = subscriptionNotification?.subscriptionId || current?.productId;
  if (!productId) return;
  // RTDN is only a signal. Ask Google Play for canonical state and the account binding.
  const verified = await verifyGoogleNotificationPurchase(productId, purchaseToken);
  const user = (current
    ? await User.findById(current.userId).select('+storeAccountToken +googleObfuscatedAccountId')
    : await User.findOne({ googleObfuscatedAccountId: verified.accountId }).select('+storeAccountToken +googleObfuscatedAccountId')) as unknown as IUser | null;
  if (!user?.storeAccountToken || !verified.accountId || getGoogleObfuscatedAccountId(user.storeAccountToken) !== verified.accountId) return;
  await StoreSubscription.findOneAndUpdate(
    { store: 'google', transactionKey: verified.transactionKey },
    { $set: {
      userId: user._id,
      productId: verified.productId,
      latestTransactionId: verified.latestTransactionId,
      willRenew: verified.willRenew ?? null,
      purchaseTokenHash: verified.purchaseTokenHash,
      state: voidedNotification?.refundType === 1 ? 'revoked' : verified.active ? 'active' : 'expired',
      expiresAt: verified.expiresAt,
      lastVerifiedAt: new Date(),
      lastStoreEventAt: new Date(),
    } },
    { upsert: true, new: true, runValidators: true }
  );
  await syncSubscriptionEntitlement(user);
};

export const googleStoreNotification = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    await authorizeGooglePush(req.header('authorization'));
    const push = req.body as GooglePush;
    const messageId = push?.message?.messageId || push?.message?.message_id;
    const encoded = push?.message?.data;
    if (!messageId || !encoded || encoded.length > 100_000) {
      return next(new BadRequestError('Google Pub/Sub message is missing or invalid'));
    }
    let event: Record<string, unknown>;
    try { event = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8')) as Record<string, unknown>; }
    catch { return next(new BadRequestError('Google Pub/Sub message data is invalid')); }

    const existing = await claimEvent('google', messageId);
    if (existing?.state === 'processed') { res.sendStatus(200); return; }
    await reconcileGoogle(event);
    await markProcessed('google', messageId);
    res.sendStatus(200);
  } catch (err) { next(err); }
};
