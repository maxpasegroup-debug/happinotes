import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { releaseExpiredBan, assertNotBanned } from '../services/accountModeration';
import { AppError } from '../utils/errors';
import { env } from '../config/env';
import { User } from '../models';
import { UnauthorizedError } from '../utils/errors';
import type { IUser } from '../models/User';
import { hasActiveDeletionRequest, isDeletionStateActive } from '../services/accountDeletion';
import { AccountDeletionRequest } from '../models/AccountDeletionRequest';

declare global {
  namespace Express {
    interface Request {
      user?: IUser;
      authSessionId?: string;
    }
  }
}

const userFromToken = async (req: Request, allowRevokedSession = false): Promise<IUser> => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) throw new UnauthorizedError('Access token required');
  const decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] }) as { id?: unknown; sessionVersion?: unknown; loginSessionId?: unknown };
  if (!decoded || typeof decoded !== 'object' || typeof decoded.id !== 'string') {
    throw new UnauthorizedError('Invalid token claims');
  }
  const user = await User.findById(decoded.id);
  if (!user) throw new UnauthorizedError('User not found');
  await releaseExpiredBan(user);
  assertNotBanned(user);
  const currentVersion = user.sessionVersion ?? 0;
  const hasValidVersion = Number.isSafeInteger(currentVersion) && currentVersion >= 0;
  const tokenVersionMatches = decoded.sessionVersion === undefined
    ? currentVersion === 0
    : Number.isSafeInteger(decoded.sessionVersion) && decoded.sessionVersion === currentVersion;
  if (!hasValidVersion || (!tokenVersionMatches && !allowRevokedSession)) {
    throw new UnauthorizedError('Your session ended. The account may have been signed in on another device. Please sign in again.');
  }
  if (!allowRevokedSession && decoded.loginSessionId !== undefined && decoded.loginSessionId !== user.activeLoginSessionId) {
    throw new UnauthorizedError('Your account was signed in on another device. Please sign in again.');
  }
  if (typeof decoded.loginSessionId === 'string') req.authSessionId = decoded.loginSessionId;
  return user;
};

const rejectInactiveAccount = async (user: IUser): Promise<void> => {
  if (user.blocked) throw new UnauthorizedError('Account is blocked');
  if (!isDeletionStateActive(user.deletionState) || await hasActiveDeletionRequest(user._id)) {
    throw new UnauthorizedError('Account deletion is in progress');
  }
};

export const authenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = await userFromToken(req);
    await rejectInactiveAccount(user);
    req.user = user;
    next();
  } catch (error) {
    if (error instanceof AppError && error.statusCode === 403) { next(error); return; }
    next(error instanceof UnauthorizedError ? error : new UnauthorizedError('Invalid or expired token'));
  }
};

/**
 * Deletion retry/status calls are allowed to reach their controller after the
 * account has been marked pending. No other route uses this middleware.
 */
export const authenticateDeletionFlow = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    // Authentication artifacts are removed during deletion, so a revoked
    // sessionVersion may still read only the deletion status endpoints.
    const user = await userFromToken(req, true);
    if (user.blocked) return next(new UnauthorizedError('Account is blocked'));
    const existingRequest = await AccountDeletionRequest.exists({ userId: user._id });
    if (!existingRequest) {
      // First submission must use a current, active session. The relaxed
      // session-version check above is only for existing deletion workflows.
      const activeUser = await userFromToken(req);
      await rejectInactiveAccount(activeUser);
      req.user = activeUser;
    } else {
      req.user = user;
    }
    next();
  } catch (error) {
    if (error instanceof AppError && error.statusCode === 403) { next(error); return; }
    next(new UnauthorizedError('Invalid or expired token'));
  }
};

/**
 * Optional auth: if Bearer token present and valid, sets req.user; otherwise leaves req.user undefined.
 * Never fails the request (used for routes that return different data when authenticated).
 */
export const optionalAuthenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return next();
    }

    const user = await userFromToken(req);

    if (user.blocked || !isDeletionStateActive(user.deletionState) || await hasActiveDeletionRequest(user._id)) {
      return next();
    }
    req.user = user;
    next();
  } catch {
    next();
  }
};
