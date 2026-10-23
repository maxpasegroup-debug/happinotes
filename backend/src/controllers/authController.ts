import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { Otp, User } from '../models';
import { env } from '../config/env';
import { BadRequestError, UnauthorizedError } from '../utils/errors';
import { sendPasswordResetOtp } from '../services/email';

const PASSWORD_RESET_TTL_MS = 10 * 60 * 1000;
const PASSWORD_RESET_REQUEST_WINDOW_MS = 10 * 60 * 1000;
const PASSWORD_RESET_REQUEST_LIMIT = 3;
const PASSWORD_RESET_ATTEMPT_LIMIT = 5;
const PASSWORD_MIN_LENGTH = 8;

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

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
  subscriptionSource?: 'admin' | 'apple' | 'google' | null;
}) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  languagePreference: user.languagePreference,
  subscriptionStatus: user.subscriptionStatus,
  subscriptionExpiry: user.subscriptionExpiry,
  subscriptionSource: user.subscriptionSource ?? null,
});

const hashOtp = (email: string, otp: string): string =>
  crypto.createHmac('sha256', env.JWT_SECRET).update(`${email}:${otp}`).digest('hex');

const isOtpMatch = (storedHash: string, email: string, otp: string): boolean => {
  const expected = Buffer.from(storedHash, 'hex');
  const actual = Buffer.from(hashOtp(email, otp), 'hex');
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
};

export const signup = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const name = req.body.name.trim();
    const email = normalizeEmail(req.body.email);
    const { password } = req.body as { password: string };

    if (await User.exists({ email })) {
      return next(new BadRequestError('Email already registered'));
    }

    const user = await User.create({
      name,
      email,
      password: await bcrypt.hash(password, 12),
    });

    const token = signToken(user._id.toString());
    res.status(201).json({ success: true, token, user: serializeUser(user) });
  } catch (err) {
    if (typeof err === 'object' && err !== null && 'code' in err && err.code === 11000) {
      return next(new BadRequestError('Email already registered'));
    }
    next(err);
  }
};

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const email = normalizeEmail(req.body.email);
    const { password } = req.body as { password: string };
    const user = await User.findOne({ email }).select('+password');

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return next(new UnauthorizedError('Invalid email or password'));
    }

    const token = signToken(user._id.toString());
    res.json({ success: true, token, user: serializeUser(user) });
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
    if (!req.user) return next(new UnauthorizedError('Not authenticated'));
    const user = await User.findById(req.user._id)
      .select('-password')
      .populate('bookCollection', 'title coverImageUrl accessType status');
    const value = user?.toObject() as Record<string, unknown> | undefined;
    if (value && 'bookCollection' in value) {
      value.collection = value.bookCollection;
      delete value.bookCollection;
    }
    res.json({ success: true, user: value || user });
  } catch (err) {
    next(err);
  }
};

export const updateMe = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) return next(new UnauthorizedError('Not authenticated'));

    const allowed = ['name', 'languagePreference', 'expoPushToken'] as const;
    const update: Partial<Record<(typeof allowed)[number], string>> = {};
    allowed.forEach((key) => {
      if (req.body[key] !== undefined) update[key] = req.body[key];
    });

    if (update.expoPushToken) {
      await User.updateMany(
        { _id: { $ne: req.user._id }, expoPushToken: update.expoPushToken },
        { $set: { expoPushToken: null } }
      );
    }

    const user = await User.findByIdAndUpdate(req.user._id, update, {
      new: true,
      runValidators: true,
    }).select('-password');

    if (!user) return next(new UnauthorizedError('Not authenticated'));
    res.json({ success: true, user: serializeUser(user) });
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

    const { oldPassword, newPassword } = req.body as {
      oldPassword: string;
      newPassword: string;
    };
    const user = await User.findById(req.user._id).select('+password');
    if (!user) return next(new UnauthorizedError('Not authenticated'));
    if (!(await bcrypt.compare(oldPassword, user.password))) {
      return next(new UnauthorizedError('Current password is incorrect'));
    }

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
    const email = normalizeEmail(req.body.email);
    const genericResponse = {
      success: true,
      message: 'If an account exists for that email, a reset code will be sent shortly.',
    };
    const userExists = await User.exists({ email });

    if (userExists) {
      const windowStart = new Date(Date.now() - PASSWORD_RESET_REQUEST_WINDOW_MS);
      const recentRequests = await Otp.countDocuments({
        identifier: email,
        purpose: 'password-reset',
        createdAt: { $gte: windowStart },
      });

      if (recentRequests < PASSWORD_RESET_REQUEST_LIMIT) {
        const now = new Date();
        const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
        await Otp.updateMany(
          { identifier: email, purpose: 'password-reset', used: false },
          { $set: { used: true } }
        );
        const otpRecord = await Otp.create({
          identifier: email,
          purpose: 'password-reset',
          codeHash: hashOtp(email, code),
          attempts: 0,
          expiresAt: new Date(now.getTime() + PASSWORD_RESET_TTL_MS),
        });

        try {
          await sendPasswordResetOtp(email, code);
        } catch (error) {
          await Otp.findByIdAndUpdate(otpRecord._id, { $set: { used: true } });
          console.error('Password reset email delivery failed:', error);
        }
      }
    }

    res.json(genericResponse);
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
    const email = normalizeEmail(req.body.email);
    const { otp, newPassword } = req.body as { otp: string; newPassword: string };
    const now = new Date();
    const record = await Otp.findOne({
      identifier: email,
      purpose: 'password-reset',
      used: false,
      attempts: { $lt: PASSWORD_RESET_ATTEMPT_LIMIT },
      expiresAt: { $gt: now },
    }).select('+codeHash').sort({ createdAt: -1 });

    if (!record) return next(new BadRequestError('Invalid or expired reset code'));

    if (!isOtpMatch(record.codeHash, email, otp)) {
      await Otp.findOneAndUpdate(
        {
          _id: record._id,
          used: false,
          attempts: { $lt: PASSWORD_RESET_ATTEMPT_LIMIT },
          expiresAt: { $gt: now },
        },
        { $inc: { attempts: 1 } }
      );
      return next(new BadRequestError('Invalid or expired reset code'));
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user) return next(new BadRequestError('Invalid or expired reset code'));

    const consumed = await Otp.findOneAndUpdate(
      {
        _id: record._id,
        codeHash: record.codeHash,
        used: false,
        attempts: { $lt: PASSWORD_RESET_ATTEMPT_LIMIT },
        expiresAt: { $gt: now },
      },
      { $set: { used: true } },
      { new: true }
    );
    if (!consumed) return next(new BadRequestError('Invalid or expired reset code'));

    user.password = await bcrypt.hash(newPassword, 12);
    await user.save();
    res.json({ success: true, message: 'Password reset successfully' });
  } catch (err) {
    next(err);
  }
};
