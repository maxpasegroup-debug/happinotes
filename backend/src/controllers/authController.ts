import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { validationResult } from 'express-validator';
import { User } from '../models';
import { PasswordResetToken } from '../models/passwordResetToken';
import { env } from '../config/env';
import { sendOTPEmail } from '../services/emailService';
import { BadRequestError, UnauthorizedError } from '../utils/errors';

const OTP_EXPIRY_MINUTES = 10;
const PRIMARY_ADMIN_EMAIL = 'admin@happinotes.in';

const signToken = (id: string): string => {
  return jwt.sign({ id }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
};

export const signup = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new BadRequestError(errors.array()[0].msg));
    }

    const { name, email, password } = req.body;
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return next(new BadRequestError('Email already registered'));
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const role = email.toLowerCase() === PRIMARY_ADMIN_EMAIL ? 'admin' : 'user';

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      role,
    });

    const token = signToken(user._id.toString());
    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isPremium: user.subscriptionActive,
        subscriptionActive: user.subscriptionActive,
        subscriptionExpiry: user.subscriptionExpiry,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new BadRequestError(errors.array()[0].msg));
    }

    const { email, password } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) {
      return next(new UnauthorizedError('Invalid email or password'));
    }
    if (user.blocked) {
      return next(new UnauthorizedError('Account is blocked'));
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return next(new UnauthorizedError('Invalid email or password'));
    }

    const token = signToken(user._id.toString());
    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isPremium: user.subscriptionActive,
        subscriptionActive: user.subscriptionActive,
        subscriptionExpiry: user.subscriptionExpiry,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const getMe = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      return next(new UnauthorizedError('Not authenticated'));
    }
    const user = await User.findById(req.user._id)
      .select('-password')
      .populate('bookCollection', 'title coverImage type status');
    const u = user?.toObject() as Record<string, unknown> | undefined;
    if (u && 'bookCollection' in u) {
      u.collection = u.bookCollection;
      delete u.bookCollection;
    }
    if (u) {
      u.isPremium = Boolean(u.subscriptionActive);
    }
    res.json({ success: true, user: u || user });
  } catch (err) {
    next(err);
  }
};

export const forgotPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new BadRequestError(errors.array()[0].msg));
    }

    const email = (req.body.email ?? '').toString().trim().toLowerCase();
    const user = await User.findOne({ email });

    if (!user) {
      res.status(200).json({
        message: 'If an account exists, an OTP has been sent.',
      });
      return;
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await PasswordResetToken.deleteMany({ userId: user._id });
    await PasswordResetToken.create({
      userId: user._id,
      otpHash,
      expiresAt,
    });

    await sendOTPEmail(email, otp);

    res.status(200).json({
      message: 'If an account exists, an OTP has been sent.',
    });
  } catch (err) {
    next(err);
  }
};

const MAX_OTP_ATTEMPTS = 5;

export const verifyOTP = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new BadRequestError(errors.array()[0].msg));
    }

    const email = (req.body.email ?? '').toString().trim().toLowerCase();
    const otp = (req.body.otp ?? '').toString().trim();

    const user = await User.findOne({ email });
    if (!user) {
      res.status(400).json({ message: 'Invalid or expired OTP' });
      return;
    }

    const token = await PasswordResetToken.findOne({ userId: user._id });
    if (!token) {
      res.status(400).json({ message: 'Invalid or expired OTP' });
      return;
    }

    if (token.expiresAt < new Date()) {
      res.status(400).json({ message: 'OTP expired' });
      return;
    }

    if (token.attempts >= MAX_OTP_ATTEMPTS) {
      res.status(400).json({ message: 'Too many attempts' });
      return;
    }

    const match = await bcrypt.compare(otp, token.otpHash);
    if (!match) {
      token.attempts += 1;
      await token.save();
      res.status(400).json({ message: 'Invalid OTP' });
      return;
    }

    res.status(200).json({ message: 'OTP verified successfully' });
  } catch (err) {
    next(err);
  }
};

export const resetPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new BadRequestError(errors.array()[0].msg));
    }

    const email = (req.body.email ?? '').toString().trim().toLowerCase();
    const otp = (req.body.otp ?? '').toString().trim();
    const newPassword = (req.body.newPassword ?? '').toString();

    const user = await User.findOne({ email });
    if (!user) {
      res.status(400).json({ message: 'Invalid request' });
      return;
    }

    const token = await PasswordResetToken.findOne({ userId: user._id });
    if (!token) {
      res.status(400).json({ message: 'Invalid or expired OTP' });
      return;
    }

    if (token.expiresAt < new Date()) {
      res.status(400).json({ message: 'OTP expired' });
      return;
    }

    const match = await bcrypt.compare(otp, token.otpHash);
    if (!match) {
      res.status(400).json({ message: 'Invalid OTP' });
      return;
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    user.password = hashedPassword;
    await user.save();

    await PasswordResetToken.deleteMany({ userId: user._id });

    res.status(200).json({ message: 'Password reset successful' });
  } catch (err) {
    next(err);
  }
};
