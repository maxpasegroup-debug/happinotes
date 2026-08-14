import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { getPlan, PLANS } from '../config/plans';
import { env } from '../config/env';
import { BadRequestError, ForbiddenError, NotFoundError } from '../utils/errors';
import { Offer, PaymentTransaction, User } from '../models';
import { getRazorpay, verifyPaymentSignature, verifyWebhookSignature } from '../services/razorpay';

const getDiscountedAmount = async (planId: string, price: number) => {
  const now = new Date();
  const offer = await Offer.findOne({
    isActive: true,
    validFrom: { $lte: now },
    validUntil: { $gte: now },
    appliesToPlan: { $in: [planId, 'all'] },
  }).sort({ discountPercent: -1, createdAt: -1 });

  if (!offer) return { amount: price, offer: null };

  const amount = Math.max(0, Math.round(price - (price * offer.discountPercent) / 100));
  return { amount, offer };
};

const getExpiryDate = (durationDays: number) => {
  return new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
};

const applySubscription = async (userId: unknown, planId: string) => {
  const plan = getPlan(planId);
  if (!plan) throw new Error('Invalid plan');

  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');

  user.subscriptionStatus = plan.id === 'lifetime' ? 'lifetime' : 'premium';
  user.subscriptionExpiry = getExpiryDate(plan.durationDays);
  await user.save();

  return user;
};

export const getPaymentPlans = (
  _req: Request,
  res: Response
): void => {
  res.json({ success: true, plans: Object.values(PLANS) });
};

export const createOrder = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) return next(new ForbiddenError('Authentication required'));
    const errors = validationResult(req);
    if (!errors.isEmpty()) return next(new BadRequestError(errors.array()[0].msg));

    const plan = getPlan(req.body.planId);
    if (!plan) return next(new BadRequestError('Invalid plan'));

    const razorpay = getRazorpay();
    if (!razorpay) {
      return next(new BadRequestError('Payments are not configured on this server'));
    }

    const { amount, offer } = await getDiscountedAmount(plan.id, plan.price);
    const order = await razorpay.orders.create({
      amount: amount * 100,
      currency: 'INR',
      receipt: `hn_${plan.id}_${Date.now()}`,
      notes: {
        userId: req.user._id.toString(),
        planId: plan.id,
        offerId: offer?._id.toString() || '',
      },
    });

    const transaction = await PaymentTransaction.create({
      userId: req.user._id,
      razorpayOrderId: order.id,
      planId: plan.id,
      amountINR: amount,
      status: 'pending',
    });

    res.status(201).json({
      success: true,
      orderId: order.id,
      amount,
      currency: order.currency,
      keyId: env.RAZORPAY_KEY_ID,
      plan,
      offer,
      transactionId: transaction._id,
    });
  } catch (err) {
    next(err);
  }
};

export const verifyPayment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) return next(new ForbiddenError('Authentication required'));
    const {
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: signature,
    } = req.body;

    if (!orderId || !paymentId || !signature) {
      return next(new BadRequestError('Payment verification details are required'));
    }

    if (!verifyPaymentSignature(orderId, paymentId, signature)) {
      await PaymentTransaction.findOneAndUpdate(
        { razorpayOrderId: orderId, userId: req.user._id },
        { razorpayPaymentId: paymentId, razorpaySignature: signature, status: 'failed' }
      );
      return next(new BadRequestError('Invalid payment signature'));
    }

    const transaction = await PaymentTransaction.findOne({
      razorpayOrderId: orderId,
      userId: req.user._id,
    });
    if (!transaction) return next(new NotFoundError('Payment transaction not found'));

    transaction.razorpayPaymentId = paymentId;
    transaction.razorpaySignature = signature;
    transaction.status = 'completed';
    await transaction.save();

    const user = await applySubscription(req.user._id, transaction.planId);

    res.json({
      success: true,
      transaction,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        languagePreference: user.languagePreference,
        subscriptionStatus: user.subscriptionStatus,
        subscriptionExpiry: user.subscriptionExpiry,
        razorpaySubscriptionId: user.razorpaySubscriptionId,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const handleWebhook = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body));

    if (typeof signature !== 'string' || !verifyWebhookSignature(rawBody, signature)) {
      return next(new BadRequestError('Invalid webhook signature'));
    }

    const event = JSON.parse(rawBody.toString()) as {
      event?: string;
      payload?: {
        payment?: {
          entity?: {
            order_id?: string;
            id?: string;
            status?: string;
          };
        };
      };
    };

    const payment = event.payload?.payment?.entity;
    if (payment?.order_id && payment.id) {
      const status = payment.status === 'captured' ? 'completed' : 'failed';
      const transaction = await PaymentTransaction.findOneAndUpdate(
        { razorpayOrderId: payment.order_id },
        { razorpayPaymentId: payment.id, status },
        { new: true }
      );

      if (transaction && status === 'completed') {
        await applySubscription(transaction.userId, transaction.planId);
      }
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

export const getPaymentHistory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) return next(new ForbiddenError('Authentication required'));

    const payments = await PaymentTransaction.find({ userId: req.user._id }).sort({
      createdAt: -1,
    });

    res.json({ success: true, payments });
  } catch (err) {
    next(err);
  }
};
