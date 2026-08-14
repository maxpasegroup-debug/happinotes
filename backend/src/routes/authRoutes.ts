import { Router } from 'express';
import { body } from 'express-validator';
import {
  changePassword,
  changeLoginPhone,
  forgotPassword,
  getMe,
  requestSignupOtp,
  requestLoginOtp,
  verifyLoginOtp,
  forgotPin,
  resetPin,
  login,
  resetPassword,
  signup,
  updateMe,
  verifyOtp,
} from '../controllers/authController';
import { authenticate, validateRequest } from '../middleware';

const router = Router();

const phone = body('phoneNumber').matches(/^\+[1-9]\d{7,14}$/).withMessage('Use a valid WhatsApp number with country code');
const sixDigitPin = (field: string) => body(field).matches(/^\d{6}$/).withMessage('PIN must be exactly 6 digits');

const signupValidation = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body().custom((value) => {
    if (value.phoneNumber) {
      if (!/^\+[1-9]\d{7,14}$/.test(value.phoneNumber) || !/^\d{6}$/.test(value.pin) || !/^\d{6}$/.test(value.otp)) throw new Error('Valid WhatsApp number, OTP and 6-digit PIN are required');
    } else if (!value.email || !value.password || value.password.length < 8) throw new Error('Valid email and password are required');
    return true;
  }),
];

const loginValidation = [
  body().custom((value) => {
    if (value.phoneNumber) {
      if (!/^\+[1-9]\d{7,14}$/.test(value.phoneNumber) || !/^\d{6}$/.test(value.pin) || !value.loginChallenge) throw new Error('OTP verification and a valid 6-digit PIN are required');
    } else if (!value.email || !value.password) throw new Error('Email and password are required');
    return true;
  }),
];

const changePasswordValidation = [
  body('oldPassword').notEmpty().withMessage('Old password is required'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters'),
];

const forgotPasswordValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
];

const otpValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('otp')
    .isLength({ min: 6, max: 6 })
    .isNumeric()
    .withMessage('Valid 6-digit OTP is required'),
];

const resetPasswordValidation = [
  ...otpValidation,
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters'),
];

router.post('/signup', signupValidation, validateRequest, signup);
router.post('/login', loginValidation, validateRequest, login);
router.post('/request-signup-otp', [phone], validateRequest, requestSignupOtp);
router.post('/request-login-otp', [phone], validateRequest, requestLoginOtp);
router.post('/verify-login-otp', [phone, body('otp').matches(/^\d{6}$/)], validateRequest, verifyLoginOtp);
router.post('/forgot-pin', [phone], validateRequest, forgotPin);
router.post('/reset-pin', [phone, body('otp').matches(/^\d{6}$/), sixDigitPin('newPin')], validateRequest, resetPin);
router.get('/me', authenticate, getMe);
router.put('/me', authenticate, updateMe);
router.post('/change-login-phone', authenticate, [phone, sixDigitPin('currentPin')], validateRequest, changeLoginPhone);
router.post('/change-password', authenticate, changePasswordValidation, validateRequest, changePassword);
router.post('/forgot-password', forgotPasswordValidation, validateRequest, forgotPassword);
router.post('/verify-otp', otpValidation, validateRequest, verifyOtp);
router.post('/reset-password', resetPasswordValidation, validateRequest, resetPassword);

export default router;
