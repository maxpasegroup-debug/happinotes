import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
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
    }
  }
}

const userFromToken = async (req: Request): Promise<IUser> => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) throw new UnauthorizedError('Access token required');
  const decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] }) as { id?: unknown; sessionVersion?: unknown };
  if (!decoded || typeof decoded !== 'object' || typeof decoded.id !== 'string') {
    throw new UnauthorizedError('Invalid token claims');
  }
  const user = await User.findById(decoded.id);
  if (!user) throw new UnauthorizedError('User not found');
  const currentVersion = user.sessionVersion ?? 0;
  const hasValidVersion = Number.isSafeInteger(currentVersion) && currentVersion >= 0;
  const tokenVersionMatches = decoded.sessionVersion === undefined
    ? currentVersion === 0
    : Number.isSafeInteger(decoded.sessionVersion) && decoded.sessionVersion === currentVersion;
  if (!hasValidVersion || !tokenVersionMatches) {
    throw new UnauthorizedError('Access token has been revoked');
  }
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
  } catch {
    next(new UnauthorizedError('Invalid or expired token'));
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
    const user = await userFromToken(req);
    if (user.blocked) return next(new UnauthorizedError('Account is blocked'));
    if (!isDeletionStateActive(user.deletionState) &&
        !(await AccountDeletionRequest.exists({ userId: user._id }))) {
      return next(new UnauthorizedError('Account deletion is no longer available'));
    }
    req.user = user;
    next();
  } catch {
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
