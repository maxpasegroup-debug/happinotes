import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { Otp, User } from '../models';
import { env } from '../config/env';
import { BadRequestError, NotFoundError, UnauthorizedError } from '../utils/errors';
import { sendPasswordResetOtp } from '../services/email';

const signToken = (id: string): string => {
  return jwt.sign({ id }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
};

const serializeUser = (user: {
  _id: unknown;
  name: string;
  email: string;
  role: string;
  languagePreference: string;
  subscriptionStatus: string;
  subscriptionExpiry: Date | null;
  razorpaySubscriptionId?: string | null;
}) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  languagePreference: user.languagePreference,
  subscriptionStatus: user.subscriptionStatus,
  subscriptionExpiry: user.subscriptionExpiry,
  razorpaySubscriptionId: user.razorpaySubscriptionId ?? null,
});

const hashOtp = (email: string, otp: string): string => {
  return crypto
    .createHash('sha256')
    .update(`${email.toLowerCase()}:${otp}:${env.JWT_SECRET}`)
    .digest('hex');
};

export const signup = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { name, email, password } = req.body;
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return next(new BadRequestError('Email already registered'));
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const role = email.toLowerCase() === env.ADMIN_EMAIL ? 'admin' : 'user';

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
      user: serializeUser(user),
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
    const { email, password } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) {
      return next(new UnauthorizedError('Invalid email or password'));
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return next(new UnauthorizedError('Invalid email or password'));
    }

    const token = signToken(user._id.toString());
    res.json({
      success: true,
      token,
      user: serializeUser(user),
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
      .populate('bookCollection', 'title coverImageUrl accessType status');
    const u = user?.toObject() as Record<string, unknown> | undefined;
    if (u && 'bookCollection' in u) {
      u.collection = u.bookCollection;
      delete u.bookCollection;
    }
    res.json({ success: true, user: u || user });
  } catch (err) {
    next(err);
  }
};

export const changePassword = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) return next(new UnauthorizedError('Not authenticated'));

    const { oldPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id).select('+password');
    if (!user) return next(new UnauthorizedError('Not authenticated'));

    const match = await bcrypt.compare(oldPassword, user.password);
    if (!match) return next(new UnauthorizedError('Old password is incorrect'));

    user.password = await bcrypt.hash(newPassword, 12);
    await user.save();

    res.json({ success: true, message: 'Password changed successfully' });
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
    const email = req.body.email.toLowerCase();
    const user = await User.findOne({ email });
    if (!user) return next(new NotFoundError('User not found'));

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await Otp.updateMany({ email, used: false }, { used: true });
    await Otp.create({
      email,
      otp: hashOtp(email, otp),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });
    await sendPasswordResetOtp(email, otp);

    res.json({ success: true, message: 'OTP sent to email' });
  } catch (err) {
    next(err);
  }
};

export const verifyOtp = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const email = req.body.email.toLowerCase();
    const otp = await Otp.findOne({
      email,
      otp: hashOtp(email, req.body.otp),
      used: false,
      expiresAt: { $gt: new Date() },
    });

    if (!otp) return next(new BadRequestError('Invalid or expired OTP'));

    res.json({ success: true, message: 'OTP verified' });
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
    const email = req.body.email.toLowerCase();
    const otp = await Otp.findOne({
      email,
      otp: hashOtp(email, req.body.otp),
      used: false,
      expiresAt: { $gt: new Date() },
    });

    if (!otp) return next(new BadRequestError('Invalid or expired OTP'));

    const user = await User.findOne({ email }).select('+password');
    if (!user) return next(new NotFoundError('User not found'));

    user.password = await bcrypt.hash(req.body.newPassword, 12);
    await user.save();
    otp.used = true;
    await otp.save();

    res.json({ success: true, message: 'Password reset successfully' });
  } catch (err) {
    next(err);
  }
};
