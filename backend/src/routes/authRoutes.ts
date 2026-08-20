import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { body } from 'express-validator';
import {
  signup,
  login,
  getMe,
  forgotPassword,
  verifyOTP,
  resetPassword,
  requestSignupOtp,
  requestLoginOtp,
  verifyLoginOtp,
} from '../controllers/authController';
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
  body().custom((value) => {
    if (value.phoneNumber) {
      if (!/^\+[1-9]\d{7,14}$/.test(value.phoneNumber)) throw new Error('Use a valid WhatsApp number with country code');
      if (!/^\d{6}$/.test(value.pin) || !/^\d{6}$/.test(value.otp)) throw new Error('OTP and PIN must be exactly 6 digits');
    } else if (!value.email || !value.password || value.password.length < 6) {
      throw new Error('Valid email and password are required');
    }
    return true;
  }),
];

const loginValidation = [
  body().custom((value) => {
    if (value.phoneNumber) {
      if (!/^\+[1-9]\d{7,14}$/.test(value.phoneNumber) || !/^\d{6}$/.test(value.pin) || !value.loginChallenge) {
        throw new Error('OTP verification and a valid 6-digit PIN are required');
      }
    } else if (!value.email || !value.password) {
      throw new Error('Email and password are required');
    }
    return true;
  }),
];

const phoneValidation = body('phoneNumber')
  .matches(/^\+[1-9]\d{7,14}$/)
  .withMessage('Use a valid WhatsApp number with country code');

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
router.post('/request-signup-otp', authRateLimiter, [phoneValidation], requestSignupOtp);
router.post('/request-login-otp', authRateLimiter, [phoneValidation], requestLoginOtp);
router.post(
  '/verify-login-otp',
  authRateLimiter,
  [phoneValidation, body('otp').matches(/^\d{6}$/).withMessage('OTP must be 6 digits')],
  verifyLoginOtp
);
router.post('/forgot-password', authRateLimiter, forgotPasswordValidation, forgotPassword);
router.post('/verify-otp', authRateLimiter, verifyOTPValidation, verifyOTP);
router.post('/reset-password', resetPasswordValidation, resetPassword);
router.get('/me', authenticate, getMe);

export default router;
