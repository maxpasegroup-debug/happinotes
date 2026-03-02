import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { body } from 'express-validator';
import { signup, login, getMe, forgotPassword, verifyOTP, resetPassword } from '../controllers/authController';
import { authenticate } from '../middleware';

const router = Router();

const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { success: false, message: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const signupValidation = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
];

const loginValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
];

const forgotPasswordValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
];

const verifyOTPValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('otp')
    .isLength({ min: 6, max: 6 })
    .withMessage('OTP must be 6 digits')
    .matches(/^\d+$/)
    .withMessage('OTP must be numeric'),
];

const resetPasswordValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('otp')
    .isLength({ min: 6, max: 6 })
    .withMessage('OTP must be 6 digits')
    .matches(/^\d+$/)
    .withMessage('OTP must be numeric'),
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
];

router.post('/signup', signupValidation, signup);
router.post('/login', authRateLimiter, loginValidation, login);
router.post('/forgot-password', authRateLimiter, forgotPasswordValidation, forgotPassword);
router.post('/verify-otp', authRateLimiter, verifyOTPValidation, verifyOTP);
router.post('/reset-password', resetPasswordValidation, resetPassword);
router.get('/me', authenticate, getMe);

export default router;
