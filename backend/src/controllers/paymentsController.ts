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
      return next(new BadRequestError('Authentication required'));
    }

    const { purchaseToken, productId } = req.body as { purchaseToken?: string; productId?: string };
    if (!purchaseToken || typeof purchaseToken !== 'string' || !productId || typeof productId !== 'string') {
      return next(new BadRequestError('purchaseToken and productId are required'));
    }

    const rawCredentials = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT;
    if (!rawCredentials || typeof rawCredentials !== 'string') {
      return next(new BadRequestError('Google Play service account not configured'));
    }

    let credentials: { client_email: string; private_key: string };
    try {
      credentials = JSON.parse(rawCredentials) as { client_email: string; private_key: string };
    } catch {
      return next(new BadRequestError('Invalid GOOGLE_PLAY_SERVICE_ACCOUNT JSON'));
    }

    if (!credentials.client_email || !credentials.private_key) {
      return next(new BadRequestError('GOOGLE_PLAY_SERVICE_ACCOUNT must include client_email and private_key'));
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
      return next(new BadRequestError('Invalid or expired purchase'));
    }

    const paymentState = subscription.paymentState;
    const expiryTimeMillis = subscription.expiryTimeMillis;

    if (paymentState === undefined || expiryTimeMillis === undefined) {
      return next(new BadRequestError('Invalid subscription data'));
    }

    const isPaid = paymentState === 1 || paymentState === 2;
    const expiryMs = Number(expiryTimeMillis);
    const isNotExpired = !Number.isNaN(expiryMs) && expiryMs > Date.now();

    if (!isPaid || !isNotExpired) {
      return next(new BadRequestError('Subscription is not active or has expired'));
    }

    req.user.subscriptionActive = true;
    req.user.subscriptionExpiry = new Date(expiryMs);
    await req.user.save();

    res.json({
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
  } catch (err) {
    next(err);
  }
};
