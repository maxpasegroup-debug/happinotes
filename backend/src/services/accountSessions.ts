import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { User, type IUser } from '../models/User';
import { env } from '../config/env';
import { UnauthorizedError } from '../utils/errors';
import { emitUserSecurityChanged } from './realtime';

/** Credentials must have been verified before calling this. One atomic account
 * update elects the newest login and appends its history, even before telemetry. */
export async function startAccountSession(user: IUser): Promise<string> {
  const options: jwt.SignOptions = { algorithm: 'HS256', expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] };
  if (user.role === 'admin') return jwt.sign({ id: String(user._id), sessionVersion: user.sessionVersion ?? 0 }, env.JWT_SECRET, options);
  const loginSessionId = randomUUID();
  const startedAt = new Date();
  const expiry = jwt.decode(jwt.sign({ id: String(user._id) }, env.JWT_SECRET, options)) as jwt.JwtPayload;
  const updated = await User.findOneAndUpdate({
    _id: user._id, role: 'user', blocked: { $ne: true },
    // Do not let a password reset/deletion racing password verification win back access.
    ...(user.password ? { password: user.password } : {}),
    $or: [{ deletionState: 'active' }, { deletionState: { $exists: false } }],
  }, {
    $inc: { sessionVersion: 1 },
    $set: { activeLoginSessionId: loginSessionId },
    $push: { loginHistory: { $each: [{ sessionId: loginSessionId, startedAt, expiresAt: new Date(expiry.exp! * 1000) }], $slice: -50 } },
  }, { new: true, runValidators: true });
  if (!updated) throw new UnauthorizedError('Account access changed. Please sign in again.');
  const token = jwt.sign({ id: String(updated._id), sessionVersion: updated.sessionVersion, loginSessionId, exp: expiry.exp }, env.JWT_SECRET, { algorithm: 'HS256' });
  emitUserSecurityChanged(String(updated._id));
  return token;
}

export function sessionHistory(user: Pick<IUser, 'loginHistory' | 'activeLoginSessionId' | 'blocked' | 'deletionState'>, now = Date.now()) {
  const entries = user.loginHistory || [];
  return entries.map((entry, index) => {
    const replacement = entries[index + 1];
    const expired = new Date(entry.expiresAt).getTime() <= now;
    const current = entry.sessionId === user.activeLoginSessionId && !entry.endedAt && !expired && !user.blocked && (!user.deletionState || user.deletionState === 'active');
    return { id: entry.sessionId, deviceId: entry.deviceId, deviceModel: entry.deviceModel, os: entry.os, osVersion: entry.osVersion,
      publicIp: entry.publicIp, startedAt: entry.startedAt, lastSeen: entry.lastSeen, expiresAt: entry.expiresAt,
      endedAt: entry.endedAt || (replacement ? new Date(Math.min(new Date(replacement.startedAt).getTime(), new Date(entry.expiresAt).getTime())) : expired ? entry.expiresAt : undefined),
      status: current ? 'current' : entry.endedAt ? 'signed_out' : replacement && new Date(replacement.startedAt).getTime() < new Date(entry.expiresAt).getTime() ? 'replaced' : expired ? 'expired' : 'revoked',
    };
  }).reverse();
}
