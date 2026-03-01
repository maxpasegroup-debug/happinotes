import { Request, Response, NextFunction } from 'express';
import { User } from '../models';
import { ForbiddenError, NotFoundError } from '../utils/errors';

const SUBSCRIPTION_DAYS = 30;

export const activate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      return next(new ForbiddenError('Authentication required'));
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return next(new NotFoundError('User not found'));
    }

    const expiry = new Date();
    expiry.setDate(expiry.getDate() + SUBSCRIPTION_DAYS);

    user.subscriptionActive = true;
    user.subscriptionExpiry = expiry;
    await user.save();

    res.json({
      success: true,
      subscriptionActive: user.subscriptionActive,
      subscriptionExpiry: user.subscriptionExpiry,
    });
  } catch (err) {
    next(err);
  }
};
