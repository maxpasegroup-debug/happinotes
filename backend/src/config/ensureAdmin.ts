import bcrypt from 'bcryptjs';
import { User } from '../models';

const ADMIN_DEFAULT_PASSWORD = '@Identity#2055';
const BCRYPT_ROUNDS = 12;

/**
 * Ensures an admin user exists for process.env.ADMIN_EMAIL.
 * Called after MongoDB connects. Safe to call on every startup:
 * - No duplicate: checks by email first.
 * - Password is hashed. Does not crash if admin already exists.
 */
export async function ensureAdminUser(): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL?.trim();
  if (!adminEmail) {
    return;
  }

  const email = adminEmail.toLowerCase();

  try {
    const existing = await User.findOne({ email });
    if (existing) {
      return;
    }

    const hashedPassword = await bcrypt.hash(ADMIN_DEFAULT_PASSWORD, BCRYPT_ROUNDS);
    await User.create({
      name: 'Admin',
      email,
      password: hashedPassword,
      role: 'admin',
    });
    console.log('Admin user created');
  } catch (err) {
    // Avoid crash on duplicate (e.g. concurrent startup) or any DB error
    if (err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 11000) {
      return; // duplicate key, admin already created
    }
    console.error('ensureAdminUser failed:', err);
  }
}
