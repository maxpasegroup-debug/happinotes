import bcrypt from 'bcryptjs';
import { User } from '../models';
import { env } from './env';

// Must match signup (authController uses bcrypt.hash(password, 12))
const BCRYPT_ROUNDS = 12;

export function normalizeAdminEmail(value: unknown): string {
  if (typeof value !== 'string') {
    throw new Error('ADMIN_EMAIL must be configured with a valid email address');
  }
  const email = value.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('ADMIN_EMAIL must be configured with a valid email address');
  }
  return email;
}

/**
 * Ensures an admin user exists for the explicitly configured ADMIN_EMAIL.
 * Called after MongoDB connects. Safe to call on every startup:
 * - No duplicate: checks by email first.
 * - If admin exists, do NOT overwrite password.
 * - A missing admin fails closed unless ADMIN_BOOTSTRAP_PASSWORD is supplied
 *   for the one-time bootstrap. The bootstrap variable must then be removed.
 */
export async function ensureAdminUser(): Promise<void> {
  const email = normalizeAdminEmail(env.ADMIN_EMAIL);

  try {
    const existing = await User.findOne({ email }).select('+password');

    if (existing) {
      if (existing.role !== 'admin') {
        throw new Error(
          'ADMIN_EMAIL belongs to an existing non-admin account. Choose an administrator email or promote the account manually before restarting.',
        );
      }
      return;
    } else {
      if (!env.ADMIN_BOOTSTRAP_PASSWORD) {
        throw new Error(
          'Configured administrator does not exist. Set ADMIN_BOOTSTRAP_PASSWORD for one startup, then remove it.',
        );
      }
      const hashedPassword = await bcrypt.hash(env.ADMIN_BOOTSTRAP_PASSWORD, BCRYPT_ROUNDS);
      await User.create({
        name: 'Admin',
        email,
        password: hashedPassword,
        role: 'admin',
      });
    }
  } catch (err: unknown) {
    const isDuplicateKey =
      err !== null &&
      typeof err === 'object' &&
      'code' in err &&
      (err as { code: number }).code === 11000;
    if (isDuplicateKey) {
      // A concurrent bootstrap may have created the same administrator. Re-read
      // it before treating the duplicate as harmless; never accept a race with
      // an existing non-admin account.
      const concurrent = await User.findOne({ email }).select('+password');
      if (concurrent?.role === 'admin') return;
      throw new Error(
        'ADMIN_EMAIL belongs to an existing non-admin account. Choose an administrator email or promote the account manually before restarting.',
      );
    }
    throw err;
  }
}
