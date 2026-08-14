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
  email?: string;
  phoneNumber?: string;
  role: string;
  languagePreference: string;
  subscriptionStatus: string;
  subscriptionExpiry: Date | null;
  razorpaySubscriptionId?: string | null;
}) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  phoneNumber: user.phoneNumber,
  role: user.role,
  languagePreference: user.languagePreference,
  subscriptionStatus: user.subscriptionStatus,
  subscriptionExpiry: user.subscriptionExpiry,
  razorpaySubscriptionId: user.razorpaySubscriptionId ?? null,
});

const hashOtp = (identifier: string, otp: string): string => {
  return crypto
    .createHash('sha256')
    .update(`${identifier}:${otp}:${env.JWT_SECRET}`)
    .digest('hex');
};

export const signup = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { name, email, password, phoneNumber, pin, otp } = req.body;
    if (phoneNumber) {
      const existing = await User.findOne({ phoneNumber });
      if (existing) return next(new BadRequestError('WhatsApp number already registered'));
      const otpRecord = await Otp.findOne({
        identifier: phoneNumber,
        purpose: 'signup',
        otp: hashOtp(phoneNumber, otp),
        used: false,
        expiresAt: { $gt: new Date() },
      });
      if (!otpRecord) return next(new BadRequestError('Invalid or expired OTP'));
      const user = await User.create({
        name,
        phoneNumber,
        password: await bcrypt.hash(pin, 12),
        role: 'user',
      });
      otpRecord.used = true;
      await otpRecord.save();
      const token = signToken(user._id.toString());
      res.status(201).json({ success: true, token, user: serializeUser(user) });
      return;
    }
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
    const { email, password, phoneNumber, pin } = req.body;
    if (phoneNumber) {
      try {
        const challenge = jwt.verify(req.body.loginChallenge, env.JWT_SECRET) as { phoneNumber?: string; type?: string };
        if (challenge.type !== 'phone-login' || challenge.phoneNumber !== phoneNumber) {
          return next(new UnauthorizedError('Verify the WhatsApp OTP before entering your PIN'));
        }
      } catch {
        return next(new UnauthorizedError('OTP verification expired. Request a new OTP'));
      }
      const user = await User.findOne({ phoneNumber }).select('+password');
      if (!user || !(await bcrypt.compare(pin, user.password))) {
        return next(new UnauthorizedError('Invalid WhatsApp number or PIN'));
      }
      const token = signToken(user._id.toString());
      res.json({ success: true, token, user: serializeUser(user) });
      return;
    }
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) {
      return next(new UnauthorizedError('Invalid email or password'));
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return next(new UnauthorizedError('Invalid email or password'));
    }

    const shouldBeAdmin = user.email?.toLowerCase() === env.ADMIN_EMAIL;
    if (shouldBeAdmin && user.role !== 'admin') {
      user.role = 'admin';
      await user.save();
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

const createPhoneOtp = async (phoneNumber: string, purpose: 'signup' | 'reset-pin' | 'login') => {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  await Otp.updateMany({ identifier: phoneNumber, purpose, used: false }, { used: true });
  await Otp.create({
    identifier: phoneNumber,
    purpose,
    otp: hashOtp(phoneNumber, otp),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  });
  return otp;
};

export const requestLoginOtp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phoneNumber } = req.body;
    if (!(await User.exists({ phoneNumber }))) return next(new NotFoundError('No account found for this WhatsApp number'));
    const otp = await createPhoneOtp(phoneNumber, 'login');
    res.json({ success: true, message: 'Demo OTP generated', ...(env.WHATSAPP_OTP_MODE === 'test' ? { testOtp: otp } : {}) });
  } catch (err) { next(err); }
};

export const verifyLoginOtp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phoneNumber, otp } = req.body;
    const record = await Otp.findOne({ identifier: phoneNumber, purpose: 'login', otp: hashOtp(phoneNumber, otp), used: false, expiresAt: { $gt: new Date() } });
    if (!record) return next(new BadRequestError('Invalid or expired OTP'));
    record.used = true;
    await record.save();
    const loginChallenge = jwt.sign({ phoneNumber, type: 'phone-login' }, env.JWT_SECRET, { expiresIn: '5m' });
    res.json({ success: true, message: 'OTP verified', loginChallenge });
  } catch (err) { next(err); }
};

export const requestSignupOtp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phoneNumber } = req.body;
    if (await User.exists({ phoneNumber })) return next(new BadRequestError('WhatsApp number already registered'));
    const otp = await createPhoneOtp(phoneNumber, 'signup');
    res.json({ success: true, message: 'Test OTP generated', ...(env.WHATSAPP_OTP_MODE === 'test' ? { testOtp: otp } : {}) });
  } catch (err) { next(err); }
};

export const forgotPin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phoneNumber } = req.body;
    if (!(await User.exists({ phoneNumber }))) return next(new NotFoundError('User not found'));
    const otp = await createPhoneOtp(phoneNumber, 'reset-pin');
    res.json({ success: true, message: 'Test OTP generated', ...(env.WHATSAPP_OTP_MODE === 'test' ? { testOtp: otp } : {}) });
  } catch (err) { next(err); }
};

export const resetPin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phoneNumber, otp, newPin } = req.body;
    const otpRecord = await Otp.findOne({ identifier: phoneNumber, purpose: 'reset-pin', otp: hashOtp(phoneNumber, otp), used: false, expiresAt: { $gt: new Date() } });
    if (!otpRecord) return next(new BadRequestError('Invalid or expired OTP'));
    const user = await User.findOne({ phoneNumber }).select('+password');
    if (!user) return next(new NotFoundError('User not found'));
    user.password = await bcrypt.hash(newPin, 12);
    await user.save();
    otpRecord.used = true;
    await otpRecord.save();
    res.json({ success: true, message: 'PIN reset successfully' });
  } catch (err) { next(err); }
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

export const changeLoginPhone = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) return next(new UnauthorizedError('Not authenticated'));
    const { currentPin, phoneNumber } = req.body;
    const user = await User.findById(req.user._id).select('+password');
    if (!user || !(await bcrypt.compare(currentPin, user.password))) {
      return next(new UnauthorizedError('Current PIN is incorrect'));
    }
    const inUse = await User.exists({ phoneNumber, _id: { $ne: user._id } });
    if (inUse) return next(new BadRequestError('WhatsApp number already registered'));
    await User.collection.updateOne(
      { _id: user._id },
      { $set: { phoneNumber, email: `phone.${phoneNumber.replace(/\D/g, '')}@local.happinotes` } }
    );
    const updated = await User.findById(user._id);
    if (!updated) return next(new NotFoundError('User not found'));
    res.json({ success: true, message: 'Login changed to WhatsApp number', user: serializeUser(updated) });
  } catch (err) { next(err); }
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
    await Otp.updateMany({ identifier: email, purpose: 'reset-pin', used: false }, { used: true });
    await Otp.create({
      identifier: email,
      purpose: 'reset-pin',
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
      identifier: email,
      purpose: 'reset-pin',
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
      identifier: email,
      purpose: 'reset-pin',
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
