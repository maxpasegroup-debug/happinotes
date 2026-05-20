import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate, validateRequest } from '../middleware';
import {
  createOrder,
  getPaymentHistory,
  getPaymentPlans,
  verifyPayment,
} from '../controllers/paymentsController';

const router = Router();

router.get('/plans', getPaymentPlans);
router.post(
  '/create-order',
  authenticate,
  [body('planId').isIn(['monthly', 'yearly', 'lifetime']).withMessage('Valid plan is required')],
  validateRequest,
  createOrder
);
router.post('/verify', authenticate, verifyPayment);
router.get('/history', authenticate, getPaymentHistory);

export default router;
