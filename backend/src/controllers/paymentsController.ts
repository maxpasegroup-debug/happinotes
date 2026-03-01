/// <reference path="../types/googleapis.d.ts" />
import { Request, Response, NextFunction } from 'express';
import { google } from 'googleapis';
import { BadRequestError } from '../utils/errors';

const PACKAGE_NAME = 'com.happinotes.app';
const ANDROID_PUBLISHER_SCOPE = 'https://www.googleapis.com/auth/androidpublisher';

interface SubscriptionPurchaseV3 {
  paymentState?: number;
  expiryTimeMillis?: string;
}

export const verifyGoogleSubscription = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      next(new BadRequestError('Authentication required'));
      return;
    }

    const { purchaseToken, productId } = req.body as { purchaseToken?: string; productId?: string };
    if (!purchaseToken || typeof purchaseToken !== 'string' || !productId || typeof productId !== 'string') {
      next(new BadRequestError('purchaseToken and productId are required'));
      return;
    }

    const rawCredentials = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT;
    if (!rawCredentials || typeof rawCredentials !== 'string') {
      next(new BadRequestError('Google Play service account not configured'));
      return;
    }

    let credentials: { client_email: string; private_key: string };
    try {
      credentials = JSON.parse(rawCredentials) as { client_email: string; private_key: string };
    } catch {
      next(new BadRequestError('Invalid GOOGLE_PLAY_SERVICE_ACCOUNT JSON'));
      return;
    }

    if (!credentials.client_email || !credentials.private_key) {
      next(new BadRequestError('GOOGLE_PLAY_SERVICE_ACCOUNT must include client_email and private_key'));
      return;
    }

    const auth = new google.auth.JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: [ANDROID_PUBLISHER_SCOPE],
    });

    const androidpublisher = google.androidpublisher({ version: 'v3', auth });

    let subscription: SubscriptionPurchaseV3;
    try {
      const response = await androidpublisher.purchases.subscriptions.get({
        packageName: PACKAGE_NAME,
        subscriptionId: productId,
        token: purchaseToken,
      });
      subscription = response.data as SubscriptionPurchaseV3;
    } catch (err) {
      next(new BadRequestError('Invalid or expired purchase'));
      return;
    }

    const paymentState = subscription.paymentState;
    const expiryTimeMillis = subscription.expiryTimeMillis;

    if (paymentState === undefined || expiryTimeMillis === undefined) {
      next(new BadRequestError('Invalid subscription data'));
      return;
    }

    const isPaid = paymentState === 1 || paymentState === 2;
    const expiryMs = Number(expiryTimeMillis);
    const isNotExpired = !Number.isNaN(expiryMs) && expiryMs > Date.now();

    if (!isPaid || !isNotExpired) {
      next(new BadRequestError('Subscription is not active or has expired'));
      return;
    }

    req.user.subscriptionActive = true;
    req.user.subscriptionExpiry = new Date(expiryMs);
    await req.user.save();

    void res.json({
      success: true,
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        subscriptionActive: req.user.subscriptionActive,
        subscriptionExpiry: req.user.subscriptionExpiry,
      },
    });
    return;
  } catch (err) {
    next(err);
    return;
  }
};
