import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { validationResult } from 'express-validator';
import { Otp, User } from '../models';
import { PasswordResetToken } from '../models/passwordResetToken';
import { env } from '../config/env';
import { sendOTPEmail } from '../services/emailService';
import { BadRequestError, RateLimitError, UnauthorizedError } from '../utils/errors';

const OTP_EXPIRY_MINUTES = 5;
const EMAIL_OTP_RESEND_COOLDOWN_SECONDS = 60;
const PRIMARY_ADMIN_EMAIL = 'admin@happinotes.in';

const hashOtp = (identifier: string, otp: string): string =>
  crypto
    .createHmac('sha256', env.JWT_SECRET)
    .update(`${identifier}:${otp}`)
    .digest('hex');

const generateOtp = (): string =>
  crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');

const userResponse = (user: typeof User.prototype) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  phoneNumber: user.phoneNumber,
  role: user.role,
  purchasedBookIds: (user.purchasedBooks ?? []).map((id: unknown) => String(id)),
  languagePreference: user.languagePreference ?? 'all',
});

export const updateLanguage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) return next(new UnauthorizedError('Not authenticated'));
    const language = req.body?.languagePreference;
    if (!['all', 'english', 'malayalam', 'hindi'].includes(language)) {
      return next(new BadRequestError('languagePreference must be all, english, malayalam, or hindi'));
    }
    req.user.languagePreference = language;
    await req.user.save();
    res.json({ success: true, user: userResponse(req.user) });
  } catch (err) { next(err); }
};

const createPhoneOtp = async (phoneNumber: string, purpose: 'signup' | 'login' | 'reset-pin') => {
  const otp = generateOtp();
  await Otp.updateMany({ identifier: phoneNumber, purpose, used: false }, { used: true });
  await Otp.create({
    identifier: phoneNumber,
    purpose,
    otp: hashOtp(phoneNumber, otp),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  });
  return otp;
};

const createEmailOtp = async (email: string, purpose: 'email-signup' | 'email-login') => {
  const now = Date.now();
  const latest = await Otp.findOne({
    identifier: email,
    purpose,
    used: false,
    expiresAt: { $gt: new Date(now) },
  }).sort({ createdAt: -1 });
  if (latest?.createdAt) {
    const retryAfter = Math.ceil(
      (latest.createdAt.getTime() + EMAIL_OTP_RESEND_COOLDOWN_SECONDS * 1000 - now) / 1000,
    );
    if (retryAfter > 0) {
      throw new RateLimitError(`Please wait ${retryAfter} seconds before requesting another OTP`);
    }
  }

  const otp = generateOtp();
  await Otp.updateMany({ identifier: email, purpose, used: false }, { used: true });
  const record = await Otp.create({
    identifier: email,
    purpose,
    otp: hashOtp(email, otp),
    expiresAt: new Date(now + OTP_EXPIRY_MINUTES * 60 * 1000),
  });

  try {
    await sendOTPEmail(email, otp);
  } catch (error) {
    record.used = true;
    await record.save();
    throw error;
  }
};

const verifyEmailChallenge = (token: string, email: string, type: 'email-signup' | 'email-login') => {
  try {
    const challenge = jwt.verify(token, env.JWT_SECRET) as { email?: string; type?: string };
    if (challenge.type !== type || challenge.email !== email) return false;
    return true;
  } catch { return false; }
};

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

    const { name, email, password, phoneNumber, pin, otp, emailChallenge } = req.body;
    if (phoneNumber) {
      if (await User.exists({ phoneNumber })) {
        return next(new BadRequestError('WhatsApp number already registered'));
      }
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
        role: phoneNumber === env.ADMIN_PHONE_NUMBER ? 'admin' : 'user',
      });
      otpRecord.used = true;
      await otpRecord.save();
      res.status(201).json({ success: true, token: signToken(user.id), user: userResponse(user) });
      return;
    }
    const normalizedEmail = email.toLowerCase();
    if (!verifyEmailChallenge(emailChallenge, normalizedEmail, 'email-signup')) {
      return next(new UnauthorizedError('Verify the email OTP before creating your account'));
    }
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return next(new BadRequestError('Email already registered'));
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const role = email.toLowerCase() === PRIMARY_ADMIN_EMAIL ? 'admin' : 'user';

    const user = await User.create({
      name,
      email: normalizedEmail,
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
        purchasedBookIds: (user.purchasedBooks ?? []).map((id) => id.toString()),
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

    const { email, password, phoneNumber, pin, loginChallenge, emailChallenge } = req.body;
    if (phoneNumber) {
      try {
        const challenge = jwt.verify(loginChallenge, env.JWT_SECRET) as {
          phoneNumber?: string;
          type?: string;
        };
        if (challenge.type !== 'phone-login' || challenge.phoneNumber !== phoneNumber) {
          return next(new UnauthorizedError('Verify the WhatsApp OTP before entering your PIN'));
        }
      } catch {
        return next(new UnauthorizedError('OTP verification expired. Request a new OTP'));
      }
      const phoneUser = await User.findOne({ phoneNumber }).select('+password');
      if (!phoneUser || !(await bcrypt.compare(pin, phoneUser.password))) {
        return next(new UnauthorizedError('Invalid WhatsApp number or PIN'));
      }
      if (phoneUser.blocked) return next(new UnauthorizedError('Account is blocked'));
      if (phoneNumber === env.ADMIN_PHONE_NUMBER && phoneUser.role !== 'admin') {
        phoneUser.role = 'admin';
        await phoneUser.save();
      }
      res.json({ success: true, token: signToken(phoneUser.id), user: userResponse(phoneUser) });
      return;
    }
    const normalizedEmail = email.toLowerCase();
    // The admin dashboard uses a dedicated email/password login. Regular
    // users still require the email OTP challenge from the mobile flow.
    if (normalizedEmail !== PRIMARY_ADMIN_EMAIL &&
        !verifyEmailChallenge(emailChallenge, normalizedEmail, 'email-login')) {
      return next(new UnauthorizedError('Verify the email OTP before signing in'));
    }
    const user = await User.findOne({ email: normalizedEmail }).select('+password');
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
        purchasedBookIds: (user.purchasedBooks ?? []).map((id) => id.toString()),
      },
    });
  } catch (err) {
    next(err);
  }
};

export const requestSignupOtp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phoneNumber } = req.body;
    if (await User.exists({ phoneNumber })) {
      return next(new BadRequestError('WhatsApp number already registered'));
    }
    const otp = await createPhoneOtp(phoneNumber, 'signup');
    res.json({
      success: true,
      message: 'OTP generated',
      ...(env.WHATSAPP_OTP_MODE === 'test' ? { testOtp: otp } : {}),
    });
  } catch (err) { next(err); }
};

export const requestLoginOtp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phoneNumber } = req.body;
    if (!(await User.exists({ phoneNumber }))) {
      return next(new BadRequestError('No account found for this WhatsApp number'));
    }
    const otp = await createPhoneOtp(phoneNumber, 'login');
    res.json({
      success: true,
      message: 'OTP generated',
      ...(env.WHATSAPP_OTP_MODE === 'test' ? { testOtp: otp } : {}),
    });
  } catch (err) { next(err); }
};

export const requestEmailOtp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const email = (req.body.email ?? '').toString().trim().toLowerCase();
    const purpose = req.body.purpose === 'signup' ? 'email-signup' : 'email-login';
    const exists = await User.exists({ email });
    if (purpose === 'email-signup' && exists) return next(new BadRequestError('Email already registered'));
    if (purpose === 'email-login' && !exists) return next(new UnauthorizedError('No account found for this email'));
    await createEmailOtp(email, purpose);
    res.json({
      success: true,
      message: 'OTP sent to your email',
      expiresInSeconds: OTP_EXPIRY_MINUTES * 60,
      resendAfterSeconds: EMAIL_OTP_RESEND_COOLDOWN_SECONDS,
    });
  } catch (err) { next(err); }
};

export const verifyEmailOtp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const email = (req.body.email ?? '').toString().trim().toLowerCase();
    const otp = (req.body.otp ?? '').toString().trim();
    const purpose = req.body.purpose === 'signup' ? 'email-signup' : 'email-login';
    const record = await Otp.findOne({ identifier: email, purpose, used: false, otp: hashOtp(email, otp), expiresAt: { $gt: new Date() } });
    if (!record) return next(new BadRequestError('Invalid or expired OTP'));
    const emailChallenge = jwt.sign({ email, type: purpose }, env.JWT_SECRET, { expiresIn: '10m' });
    record.used = true;
    await record.save();
    res.json({ success: true, emailChallenge });
  } catch (err) { next(err); }
};

export const requestResetPinOtp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const phoneNumber = (req.body.phoneNumber ?? '').toString().trim();
    if (!(await User.exists({ phoneNumber }))) {
      return next(new BadRequestError('No account found for this WhatsApp number'));
    }
    const otp = await createPhoneOtp(phoneNumber, 'reset-pin');
    res.json({
      success: true,
      message: 'OTP generated',
      ...(env.WHATSAPP_OTP_MODE === 'test' ? { testOtp: otp } : {}),
    });
  } catch (err) { next(err); }
};

export const resetPin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const phoneNumber = (req.body.phoneNumber ?? '').toString().trim();
    const otp = (req.body.otp ?? '').toString().trim();
    const pin = (req.body.pin ?? '').toString().trim();
    if (!/^\+\d{8,15}$/.test(phoneNumber) || !/^\d{6}$/.test(otp) || !/^\d{6}$/.test(pin)) {
      return next(new BadRequestError('Phone number, OTP, and PIN must be valid'));
    }
    const user = await User.findOne({ phoneNumber });
    const record = await Otp.findOne({
      identifier: phoneNumber,
      purpose: 'reset-pin',
      otp: hashOtp(phoneNumber, otp),
      used: false,
      expiresAt: { $gt: new Date() },
    });
    if (!user || !record) return next(new BadRequestError('Invalid or expired OTP'));
    user.password = await bcrypt.hash(pin, 12);
    await user.save();
    record.used = true;
    await record.save();
    res.json({ success: true, message: 'PIN reset successfully' });
  } catch (err) { next(err); }
};

export const verifyLoginOtp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phoneNumber, otp } = req.body;
    const record = await Otp.findOne({
      identifier: phoneNumber,
      purpose: 'login',
      otp: hashOtp(phoneNumber, otp),
      used: false,
      expiresAt: { $gt: new Date() },
    });
    if (!record) return next(new BadRequestError('Invalid or expired OTP'));
    record.used = true;
    await record.save();
    const loginChallenge = jwt.sign(
      { phoneNumber, type: 'phone-login' },
      env.JWT_SECRET,
      { expiresIn: '5m' }
    );
    res.json({ success: true, message: 'OTP verified', loginChallenge });
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
      .populate('bookCollection', 'title coverImage type status');
    const u = user?.toObject() as Record<string, unknown> | undefined;
    if (u && 'bookCollection' in u) {
      u.collection = u.bookCollection;
      delete u.bookCollection;
    }
    if (u) {
      u.purchasedBookIds = Array.isArray(u.purchasedBooks)
        ? (u.purchasedBooks as unknown[]).map((id) => String(id))
        : [];
      delete u.purchasedBooks;
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

    const otp = generateOtp();
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
