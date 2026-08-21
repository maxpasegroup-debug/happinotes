import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  verifyGoogleSubscription,
  createRazorpaySubscription,
  createRazorpayOrder,
  verifyRazorpaySubscription,
  verifyAppleSubscription,
  getPaymentPlans,
} from '../controllers/paymentsController';
import { authenticate } from '../middleware';

const router = Router();
const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});
const verifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/google/verify', verifyLimiter, authenticate, verifyGoogleSubscription);
router.get('/plans', getPaymentPlans);
router.post('/apple/verify', verifyLimiter, authenticate, verifyAppleSubscription);
router.post('/razorpay/subscription', paymentLimiter, authenticate, createRazorpaySubscription);
router.post('/razorpay/create-order', paymentLimiter, authenticate, createRazorpayOrder);
router.post('/razorpay/verify', verifyLimiter, authenticate, verifyRazorpaySubscription);

export default router;
