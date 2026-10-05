import { Router } from 'express';
import { createHash } from 'crypto';
import { Types } from 'mongoose';
import { OAuth2Client } from 'google-auth-library';
import { Type } from '@apple/app-store-server-library';
import { StorePurchase } from '../models/StorePurchase';
import { User } from '../models';
import { applePurchaseClient, googlePurchase, accountToken } from '../services/storePurchase';
import { AppError, BadRequestError, UnauthorizedError } from '../utils/errors';

const router = Router();
const googleIdentity = new OAuth2Client();

async function updateAccess(claim: { _id: Types.ObjectId; userId: Types.ObjectId; bookId: Types.ObjectId }, active: boolean) {
  await StorePurchase.updateOne({ _id: claim._id }, { $set: { active } });
  if (active) {
    await User.updateOne({ _id: claim.userId }, { $addToSet: { purchasedBooks: claim.bookId } });
  } else {
    const anotherPurchase = await StorePurchase.exists({
      userId: claim.userId, bookId: claim.bookId, active: { $ne: false },
    });
    if (!anotherPurchase) {
      await User.updateOne({ _id: claim.userId }, { $pull: { purchasedBooks: claim.bookId } });
    }
  }
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
    const proof = event.oneTimeProductNotification?.purchaseToken ?? event.voidedPurchaseNotification?.purchaseToken;
    if (typeof proof !== 'string') { res.sendStatus(204); return; }
    const transactionKey = createHash('sha256').update(proof).digest('hex');
    const claim = await StorePurchase.findOne({ store: 'android', transactionKey });
    if (claim) {
      // Fetch current state so duplicate and out-of-order notifications are safe.
      const { purchase } = await googlePurchase(claim.productId, proof);
      const active = purchase.purchaseState === 0 && purchase.consumptionState === 0 &&
        purchase.obfuscatedExternalAccountId === accountToken(String(claim.userId));
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
    if (!signedTransaction) { res.sendStatus(204); return; }
    const transaction = await verifier.verifyAndDecodeTransaction(signedTransaction);
    if (!transaction.originalTransactionId || !transaction.transactionId) throw new BadRequestError('Missing transaction');
    const claim = await StorePurchase.findOne({ store: 'ios',
      transactionKey: `${environment}:${transaction.originalTransactionId}` });
    if (claim) {
      const latest = await client.getTransactionInfo(transaction.transactionId);
      if (!latest.signedTransactionInfo) throw new AppError('Transaction lookup failed', 503);
      const current = await verifier.verifyAndDecodeTransaction(latest.signedTransactionInfo);
      const active = current.revocationDate == null && current.type === Type.NON_CONSUMABLE &&
        current.productId === claim.productId && current.appAccountToken === accountToken(String(claim.userId));
      await updateAccess(claim, active);
    }
    res.sendStatus(204);
  } catch (error) {
    next(error instanceof AppError ? error : new AppError('Store notification processing failed', 503));
  }
});

export default router;
