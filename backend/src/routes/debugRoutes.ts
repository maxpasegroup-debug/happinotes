import bcrypt from 'bcryptjs';
import { Router, Request, Response } from 'express';
import { User } from '../models';
import { sendOTPEmail } from '../services/emailService';

const router = Router();

const ADMIN_EMAIL = process.env.ADMIN_EMAIL?.trim()?.toLowerCase();

/**
 * GET /debug/users
 * Temporary: returns all users with only email and role (no password).
 */
router.get('/users', async (_req: Request, res: Response): Promise<void> => {
  const users = await User.find({}).select('email role').lean();
  const list = users.map((u) => ({ email: u.email, role: u.role }));
  res.json(list);
});

/**
 * GET /debug/admin-status
 * Temporary: returns whether admin user (ADMIN_EMAIL) exists. Does NOT return password.
 */
router.get('/admin-status', async (_req: Request, res: Response): Promise<void> => {
  console.log('ADMIN STATUS ROUTE HIT');
  if (!ADMIN_EMAIL) {
    res.json({ exists: false, email: null, role: null, message: 'ADMIN_EMAIL not set' });
    return;
  }
  console.log('Before DB query');
  const admin = await User.findOne({ email: ADMIN_EMAIL }).select('email role').lean();
  console.log('After DB query');
  if (!admin) {
    res.json({ exists: false, email: ADMIN_EMAIL, role: null });
    return;
  }
  res.json({ exists: true, email: admin.email, role: admin.role });
  return;
});

/**
 * POST /debug/test-login
 * Temporary: tests login with same logic as auth. Body: { email, password }.
 * Returns { success, message } to verify bcrypt.compare.
 */
router.post('/test-login', async (req: Request, res: Response): Promise<void> => {
  try {
    const email = (req.body?.email ?? '').toString().trim().toLowerCase();
    const password = (req.body?.password ?? '').toString();
    if (!email || !password) {
      res.json({ success: false, message: 'Missing email or password in body' });
      return;
    }
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      res.json({ success: false, message: 'User not found' });
      return;
    }
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      res.json({ success: false, message: 'Password mismatch (bcrypt.compare failed)' });
      return;
    }
    res.json({ success: true, message: 'Login OK' });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.json({ success: false, message: `Error: ${message}` });
  }
});

/**
 * GET /debug/test-email
 * Temporary: sends a test OTP email to arundasmd@gmail.com.
 */
router.get('/test-email', async (_req: Request, res: Response): Promise<void> => {
  const testTo = 'arundasmd@gmail.com';
  try {
    await sendOTPEmail(testTo, '999999');
    res.json({ success: true, message: `Test email sent to ${testTo}` });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.json({ success: false, message: `Email failed: ${message}` });
  }
});

export default router;
