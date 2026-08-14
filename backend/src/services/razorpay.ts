import Razorpay from 'razorpay';
import crypto from 'crypto';
import { env } from '../config/env';

let razorpayClient: Razorpay | null = null;

export const getRazorpay = (): Razorpay | null => {
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) return null;

  if (!razorpayClient) {
    razorpayClient = new Razorpay({
      key_id: env.RAZORPAY_KEY_ID,
      key_secret: env.RAZORPAY_KEY_SECRET,
    });
  }

  return razorpayClient;
};

export const verifyPaymentSignature = (
  orderId: string,
  paymentId: string,
  signature: string
) => {
  if (!env.RAZORPAY_KEY_SECRET) return false;

  const expected = crypto
    .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);
  return expectedBuffer.length === actualBuffer.length && crypto.timingSafeEqual(expectedBuffer, actualBuffer);
};

export const verifyWebhookSignature = (payload: Buffer, signature: string) => {
  if (!env.RAZORPAY_WEBHOOK_SECRET || !signature) return false;

  const expected = crypto
    .createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');

  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);
  return expectedBuffer.length === actualBuffer.length && crypto.timingSafeEqual(expectedBuffer, actualBuffer);
};
