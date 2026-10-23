import { Router } from 'express';
import { body } from 'express-validator';
import rateLimit from 'express-rate-limit';
import {
  changePassword,
  forgotPassword,
  getMe,
  login,
  resetPassword,
  signup,
  updateMe,
} from '../controllers/authController';
import { authenticate, validateRequest } from '../middleware';

const router = Router();

const email = (field = 'email') =>
  body(field).trim().toLowerCase().isEmail().withMessage('Enter a valid email address');

const password = (field: string) =>
  body(field)
    .isString()
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be between 8 and 128 characters');

const passwordResetRequestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: true,
    message: 'If an account exists for that email, a reset code will be sent shortly.',
  },
});

router.post(
  '/signup',
  [body('name').trim().isLength({ min: 1, max: 100 }), email(), password('password')],
  validateRequest,
  signup
);
router.post('/login', [email(), body('password').isString().notEmpty()], validateRequest, login);
router.get('/me', authenticate, getMe);
router.put('/me', authenticate, updateMe);
router.post(
  '/change-password',
  authenticate,
  [body('oldPassword').isString().notEmpty(), password('newPassword')],
  validateRequest,
  changePassword
);
router.post(
  '/forgot-password',
  passwordResetRequestLimiter,
  [email()],
  validateRequest,
  forgotPassword
);
router.post(
  '/reset-password',
  [email(), body('otp').matches(/^\d{6}$/).withMessage('Enter the 6-digit reset code'), password('newPassword')],
  validateRequest,
  resetPassword
);

export default router;
