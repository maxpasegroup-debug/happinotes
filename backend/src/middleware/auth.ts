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
    const user = await User.findById(decoded.id).select('+password');

    if (!user) {
      return next(new UnauthorizedError('User not found'));
    }

    req.user = user;
    next();
  } catch {
    next(new UnauthorizedError('Invalid or expired token'));
  }
};
