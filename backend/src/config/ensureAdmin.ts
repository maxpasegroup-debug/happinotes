import bcrypt from 'bcryptjs';
import { User } from '../models';

const ADMIN_DEFAULT_PASSWORD = '@Identity#2055';
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
  const adminEmail = process.env.ADMIN_EMAIL?.trim();
  if (!adminEmail) {
    console.log('[ensureAdmin] ADMIN_EMAIL not set, skipping');
    return;
  }

  const email = adminEmail.toLowerCase();
  console.log('[ensureAdmin] Checking for admin:', email);

  try {
    const existing = await User.findOne({ email });
    console.log('[ensureAdmin] Admin found?', !!existing);

    if (existing) {
      return; // Do not overwrite password
    }

    const hashedPassword = await bcrypt.hash(ADMIN_DEFAULT_PASSWORD, BCRYPT_ROUNDS);
    await User.create({
      name: 'Admin',
      email,
      password: hashedPassword,
      role: 'admin',
    });
    console.log('[ensureAdmin] Admin user created');
  } catch (err) {
    if (err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 11000) {
      return;
    }
    console.error('[ensureAdmin] ensureAdminUser failed:', err);
  }
}
