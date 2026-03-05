/// <reference path="../types/googleapis.d.ts" />
import { Request, Response, NextFunction } from 'express';
import { google } from 'googleapis';
import crypto from 'crypto';
import { BadRequestError } from '../utils/errors';
import { User } from '../models';

const PACKAGE_NAME = 'com.happinotes.app';
const ANDROID_PUBLISHER_SCOPE = 'https://www.googleapis.com/auth/androidpublisher';

interface SubscriptionPurchaseV3 {
  paymentState?: number;
  expiryTimeMillis?: string;
}

type RazorpaySubscriptionCreateResponse = {
  id: string;
  status: string;
  plan_id: string;
  current_start?: number;
  current_end?: number;
};

type RazorpaySubscriptionDetailsResponse = {
  id: string;
  status: string;
  current_start?: number;
  current_end?: number;
  notes?: Record<string, string>;
};

const RAZORPAY_API_BASE = 'https://api.razorpay.com/v1';
const DEFAULT_MONTHLY_PLAN_INR_PAISE = 49900;

function getRazorpayConfig(): { keyId: string; keySecret: string; monthlyPlanId: string } | null {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim();
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
  const monthlyPlanId = process.env.RAZORPAY_MONTHLY_PLAN_ID?.trim();
  if (!keyId || !keySecret || !monthlyPlanId) {
    return null;
  }
  return { keyId, keySecret, monthlyPlanId };
}

function getRazorpayAuthHeader(keyId: string, keySecret: string): string {
  return `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`;
}

function verifyRazorpaySubscriptionSignature(params: {
  paymentId: string;
  subscriptionId: string;
  signature: string;
  keySecret: string;
}): boolean {
  const payload = `${params.paymentId}|${params.subscriptionId}`;
  const expected = crypto
    .createHmac('sha256', params.keySecret)
    .update(payload)
    .digest('hex');
  return expected === params.signature;
}

function verifyRazorpayWebhookSignature(params: {
  rawBody: Buffer;
  signature: string;
  webhookSecret: string;
}): boolean {
  const expected = crypto
    .createHmac('sha256', params.webhookSecret)
    .update(params.rawBody)
    .digest('hex');
  return expected === params.signature;
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

/** POST /payments/razorpay/subscription */
export const createRazorpaySubscription = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      next(new BadRequestError('Authentication required'));
      return;
    }

    const config = getRazorpayConfig();
    if (!config) {
      next(
        new BadRequestError(
          'Razorpay is not configured. Set RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET and RAZORPAY_MONTHLY_PLAN_ID.'
        )
      );
      return;
    }

    const response = await fetch(`${RAZORPAY_API_BASE}/subscriptions`, {
      method: 'POST',
      headers: {
        Authorization: getRazorpayAuthHeader(config.keyId, config.keySecret),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        plan_id: config.monthlyPlanId,
        customer_notify: 1,
        total_count: 120,
        notes: {
          userId: req.user._id.toString(),
          app: 'happinotes',
          amountInPaise: String(DEFAULT_MONTHLY_PLAN_INR_PAISE),
        },
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      next(new BadRequestError(`Failed to create Razorpay subscription: ${text || response.statusText}`));
      return;
    }

    const data = (await response.json()) as RazorpaySubscriptionCreateResponse;
    res.json({
      success: true,
      subscriptionId: data.id,
      status: data.status,
      key: config.keyId,
      amount: DEFAULT_MONTHLY_PLAN_INR_PAISE,
      currency: 'INR',
      planId: data.plan_id,
    });
  } catch (err) {
    next(err);
  }
};

/** POST /payments/razorpay/webhook */
export const handleRazorpayWebhook = async (req: Request, res: Response): Promise<void> => {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();
  const signature = (req.headers['x-razorpay-signature'] ?? '').toString();

  if (!webhookSecret || !signature) {
    res.status(400).json({ success: false, message: 'Webhook secret/signature missing' });
    return;
  }

  if (!Buffer.isBuffer(req.body)) {
    res.status(400).json({ success: false, message: 'Invalid webhook body format' });
    return;
  }

  const valid = verifyRazorpayWebhookSignature({
    rawBody: req.body,
    signature,
    webhookSecret,
  });
  if (!valid) {
    res.status(400).json({ success: false, message: 'Invalid webhook signature' });
    return;
  }

  let payload:
    | {
        event?: string;
        payload?: {
          subscription?: {
            entity?: {
              id?: string;
              status?: string;
              current_end?: number;
              notes?: Record<string, string>;
            };
          };
        };
      }
    | undefined;
  try {
    payload = JSON.parse(req.body.toString('utf8')) as typeof payload;
  } catch {
    res.status(400).json({ success: false, message: 'Invalid webhook JSON payload' });
    return;
  }

  const subscription = payload?.payload?.subscription?.entity;
  const subscriptionId = subscription?.id;
  if (!subscriptionId) {
    res.status(200).json({ success: true, skipped: true });
    return;
  }

  const event = payload?.event || '';
  const deactivateEvents = new Set([
    'subscription.cancelled',
    'subscription.halted',
    'subscription.completed',
    'subscription.paused',
  ]);
  const activateEvents = new Set([
    'subscription.activated',
    'subscription.charged',
    'invoice.paid',
  ]);

  let user = await User.findOne({ razorpaySubscriptionId: subscriptionId });
  if (!user) {
    const userIdFromNotes = subscription?.notes?.userId;
    if (userIdFromNotes) {
      user = await User.findById(userIdFromNotes);
      if (user && !user.razorpaySubscriptionId) {
        user.razorpaySubscriptionId = subscriptionId;
      }
    }
  }

  if (!user) {
    res.status(200).json({ success: true, skipped: true });
    return;
  }

  if (deactivateEvents.has(event)) {
    user.subscriptionActive = false;
    user.subscriptionExpiry = null;
    await user.save();
    res.status(200).json({ success: true });
    return;
  }

  if (activateEvents.has(event)) {
    const currentEnd = subscription?.current_end;
    const fallbackExpiryMs = Date.now() + 30 * 24 * 60 * 60 * 1000;
    const expiryMs = typeof currentEnd === 'number' ? currentEnd * 1000 : fallbackExpiryMs;
    user.subscriptionActive = true;
    user.subscriptionExpiry = new Date(expiryMs);
    user.razorpaySubscriptionId = subscriptionId;
    await user.save();
  }

  res.status(200).json({ success: true });
};

/** POST /payments/razorpay/verify */
export const verifyRazorpaySubscription = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      next(new BadRequestError('Authentication required'));
      return;
    }

    const config = getRazorpayConfig();
    if (!config) {
      next(
        new BadRequestError(
          'Razorpay is not configured. Set RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET and RAZORPAY_MONTHLY_PLAN_ID.'
        )
      );
      return;
    }

    const razorpayPaymentId = (req.body?.razorpay_payment_id ?? '').toString().trim();
    const razorpaySubscriptionId = (req.body?.razorpay_subscription_id ?? '').toString().trim();
    const razorpaySignature = (req.body?.razorpay_signature ?? '').toString().trim();

    if (!razorpayPaymentId || !razorpaySubscriptionId || !razorpaySignature) {
      next(
        new BadRequestError(
          'Missing Razorpay verification fields: razorpay_payment_id, razorpay_subscription_id, razorpay_signature'
        )
      );
      return;
    }

    const isValidSignature = verifyRazorpaySubscriptionSignature({
      paymentId: razorpayPaymentId,
      subscriptionId: razorpaySubscriptionId,
      signature: razorpaySignature,
      keySecret: config.keySecret,
    });
    if (!isValidSignature) {
      next(new BadRequestError('Invalid Razorpay signature'));
      return;
    }

    const detailsRes = await fetch(`${RAZORPAY_API_BASE}/subscriptions/${razorpaySubscriptionId}`, {
      method: 'GET',
      headers: {
        Authorization: getRazorpayAuthHeader(config.keyId, config.keySecret),
      },
    });

    if (!detailsRes.ok) {
      const text = await detailsRes.text().catch(() => '');
      next(new BadRequestError(`Unable to verify Razorpay subscription state: ${text || detailsRes.statusText}`));
      return;
    }

    const details = (await detailsRes.json()) as RazorpaySubscriptionDetailsResponse;
    const status = details.status;
    if (!['active', 'authenticated'].includes(status)) {
      next(new BadRequestError(`Subscription not active (status: ${status})`));
      return;
    }

    const expirySeconds = details.current_end;
    const fallbackExpiryMs = Date.now() + 30 * 24 * 60 * 60 * 1000;
    const expiryMs = typeof expirySeconds === 'number' ? expirySeconds * 1000 : fallbackExpiryMs;

    req.user.subscriptionActive = true;
    req.user.subscriptionExpiry = new Date(expiryMs);
    await req.user.save();

    res.json({
      success: true,
      subscription: {
        id: details.id,
        status: details.status,
        currentEnd: details.current_end ?? null,
      },
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
