import { Router } from 'express';
import { body } from 'express-validator';
import rateLimit from 'express-rate-limit';
import { authenticate, validateRequest } from '../middleware';
import {
  getStoreAccountToken,
  restoreSubscriptions,
  verifySubscriptionPurchase,
} from '../controllers/subscriptionsController';

const router = Router();
const storeEvidenceLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

router.get('/account-token', authenticate, getStoreAccountToken);
router.post(
  '/verify',
  storeEvidenceLimiter,
  authenticate,
  [
    body('store').isIn(['apple', 'google']),
    body('productId').isString().isLength({ min: 3, max: 200 }),
    body('purchaseToken').isString().isLength({ min: 20, max: 20_000 }),
  ],
  validateRequest,
  verifySubscriptionPurchase
);
router.post(
  '/restore',
  storeEvidenceLimiter,
  authenticate,
  [
    body('purchases').isArray({ max: 20 }),
    body('purchases.*.store').isIn(['apple', 'google']),
    body('purchases.*.productId').isString().isLength({ min: 3, max: 200 }),
    body('purchases.*.purchaseToken').isString().isLength({ min: 20, max: 20_000 }),
  ],
  validateRequest,
  restoreSubscriptions
);

export default router;
