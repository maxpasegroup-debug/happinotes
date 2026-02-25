import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { User } from '../models';
import { UnauthorizedError } from '../utils/errors';
import type { IUser } from '../models/User';

declare global {
  namespace Express {
    interface Request {
      user?: IUser;
    }
  }
}

/**
 * If subscription is active but expiry has passed, set subscriptionActive = false and save.
 * Runs silently; does not affect request outcome.
 */
async function expireSubscriptionIfNeeded(user: IUser): Promise<void> {
  if (
    user.subscriptionActive === true &&
    user.subscriptionExpiry != null &&
    user.subscriptionExpiry <= new Date()
  ) {
    user.subscriptionActive = false;
    await user.save();
  }
}

export const authenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return next(new UnauthorizedError('Access token required'));
    }

    const decoded = jwt.verify(token, env.JWT_SECRET) as { id: string };
    const user = await User.findById(decoded.id);

    if (!user) {
      return next(new UnauthorizedError('User not found'));
    }

    await expireSubscriptionIfNeeded(user);
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

    const decoded = jwt.verify(token, env.JWT_SECRET) as { id: string };
    const user = await User.findById(decoded.id);

    if (user) {
      await expireSubscriptionIfNeeded(user);
      req.user = user;
    }
    next();
  } catch {
    next();
  }
};
