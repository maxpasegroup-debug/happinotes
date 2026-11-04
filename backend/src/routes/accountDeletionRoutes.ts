import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { body } from 'express-validator';
import {
  getExternalDeletionStatus,
  requestExternalDeletionOtp,
  verifyExternalDeletionOtp,
} from '../controllers/accountDeletionController';

const router = Router();
const deletionRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many deletion requests. Please try again later.' },
});

router.post('/request-otp', deletionRequestLimiter, body('email').isEmail().trim().toLowerCase(), requestExternalDeletionOtp);
router.post(
  '/verify-otp',
  deletionRequestLimiter,
  body('email').isEmail().trim().toLowerCase(),
  body('otp').isLength({ min: 6, max: 6 }).matches(/^\d{6}$/),
  verifyExternalDeletionOtp,
);
router.post(
  '/status',
  deletionRequestLimiter,
  body('reference').isString().matches(/^HN-DEL-[A-Fa-f0-9]{20}$/),
  body('statusToken').isString().isLength({ min: 32, max: 128 }),
  getExternalDeletionStatus,
);

export default router;
