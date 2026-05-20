import { Router } from 'express';
import { body } from 'express-validator';
import {
  changePassword,
  forgotPassword,
  getMe,
  login,
  resetPassword,
  signup,
  verifyOtp,
} from '../controllers/authController';
import { authenticate, validateRequest } from '../middleware';

const router = Router();

const signupValidation = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters'),
];

const loginValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
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
router.get('/me', authenticate, getMe);
router.post('/change-password', authenticate, changePasswordValidation, validateRequest, changePassword);
router.post('/forgot-password', forgotPasswordValidation, validateRequest, forgotPassword);
router.post('/verify-otp', otpValidation, validateRequest, verifyOtp);
router.post('/reset-password', resetPasswordValidation, validateRequest, resetPassword);

export default router;
