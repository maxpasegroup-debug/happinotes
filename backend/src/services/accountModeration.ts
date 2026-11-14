import type { IUser } from '../models/User';
import { User } from '../models/User';
import { AppError, BadRequestError } from '../utils/errors';

export function moderationStatus(user: { blocked?: boolean; banExpiresAt?: Date | string | null; banReason?: string; deletionState?: string }, now = Date.now()) {
  if (user.deletionState && user.deletionState !== 'active') return { status: 'deletion_pending', message: 'Your account is scheduled for deletion.' };
  const expiry = user.banExpiresAt ? new Date(user.banExpiresAt).getTime() : null;
  if (user.blocked && (expiry === null || !Number.isFinite(expiry) || expiry > now)) {
    return { status: expiry === null ? 'permanent_ban' : 'temporary_ban', expiresAt: expiry && Number.isFinite(expiry) ? new Date(expiry).toISOString() : null, message: expiry ? 'Your account is temporarily suspended.' : 'Your account has been banned.', reason: user.banReason || undefined };
  }
  return { status: 'active', message: 'Account active' };
}

/** A permanent re-ban racing with expiry must never be overwritten. */
export async function releaseExpiredBan(user: IUser): Promise<void> {
  if (!user.blocked || !user.banExpiresAt || user.banExpiresAt.getTime() > Date.now()) return;
  await User.updateOne({ _id: user._id, blocked: true, banExpiresAt: user.banExpiresAt }, { $set: { blocked: false }, $unset: { banExpiresAt: 1, banReason: 1 } });
  const current = await User.findById(user._id).select('blocked banExpiresAt banReason sessionVersion deletionState');
  if (current) {
    user.blocked = current.blocked;
    user.banExpiresAt = current.banExpiresAt;
    user.banReason = current.banReason;
    user.sessionVersion = current.sessionVersion;
    user.deletionState = current.deletionState;
  }
}

export function assertNotBanned(user: IUser): void {
  const status = moderationStatus(user);
  if (status.status === 'temporary_ban' || status.status === 'permanent_ban') {
    throw new AppError(`${status.message}${status.expiresAt ? ` Until ${status.expiresAt}.` : ''}${status.reason ? ` ${status.reason}` : ''}`, 403);
  }
}

export function parseBan(input: Record<string, unknown>) {
  const action = input.action;
  if (!['temporary', 'permanent', 'unban'].includes(String(action))) throw new BadRequestError('Choose a temporary ban, permanent ban, or unban.');
  const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
  if (!reason || reason.length > 500) throw new BadRequestError('Add a reason between 1 and 500 characters.');
  const expiry = action === 'temporary' && typeof input.expiresAt === 'string' ? new Date(input.expiresAt) : null;
  if (action === 'temporary' && (!expiry || !Number.isFinite(expiry.getTime()) || expiry.getTime() <= Date.now())) throw new BadRequestError('Choose a future temporary-ban expiry.');
  return { action: action as 'temporary' | 'permanent' | 'unban', reason, expiry };
}
