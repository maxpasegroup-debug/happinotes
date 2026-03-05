import { Router } from 'express';
import {
  verifyGoogleSubscription,
  createRazorpaySubscription,
  verifyRazorpaySubscription,
} from '../controllers/paymentsController';
import { authenticate } from '../middleware';

const router = Router();

router.post('/google/verify', authenticate, verifyGoogleSubscription);
router.post('/razorpay/subscription', authenticate, createRazorpaySubscription);
router.post('/razorpay/verify', authenticate, verifyRazorpaySubscription);

export default router;
