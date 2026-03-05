import bcrypt from 'bcryptjs';
import { User } from '../models';

const ADMIN_DEFAULT_PASSWORD = '@Identity#2055';
const PRIMARY_ADMIN_EMAIL = 'admin@happinotes.in';
const LEGACY_ADMIN_EMAILS = ['arundasmd@gmail.com'];
// Must match signup (authController uses bcrypt.hash(password, 12))
const BCRYPT_ROUNDS = 12;

/**
 * Ensures an admin user exists for process.env.ADMIN_EMAIL.
 * Called after MongoDB connects. Safe to call on every startup:
 * - No duplicate: checks by email first.
 * - If admin exists, do NOT overwrite password.
 * - Password is hashed with same rounds as signup.
 */
export async function ensureAdminUser(): Promise<void> {
  const email = PRIMARY_ADMIN_EMAIL.toLowerCase();
  console.log('[ensureAdmin] Checking for admin:', email);

  try {
    const existing = await User.findOne({ email }).select('+password');
    console.log('[ensureAdmin] Primary admin found?', !!existing);

    if (existing) {
      if (existing.role !== 'admin') {
        existing.role = 'admin';
        await existing.save();
      }
    } else {
      const hashedPassword = await bcrypt.hash(ADMIN_DEFAULT_PASSWORD, BCRYPT_ROUNDS);
      await User.create({
        name: 'Admin',
        email,
        password: hashedPassword,
        role: 'admin',
      });
      console.log('[ensureAdmin] Primary admin user created');
    }

    // Keep only the primary admin email as admin.
    await User.updateMany(
      { email: { $in: LEGACY_ADMIN_EMAILS.map((e) => e.toLowerCase()) } },
      { $set: { role: 'user' } }
    );
  } catch (err: unknown) {
    const isDuplicateKey =
      err !== null &&
      typeof err === 'object' &&
      'code' in err &&
      (err as { code: number }).code === 11000;
    if (isDuplicateKey) {
      console.log('[ensureAdmin] Duplicate key error (admin already exists)');
      return;
    }
    console.error('[ensureAdmin] Failed to create admin:', err);
    throw err;
  }
}
