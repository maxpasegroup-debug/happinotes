import { Request, Response, NextFunction } from 'express';
import { User } from '../models';
import { BadRequestError, ForbiddenError, NotFoundError } from '../utils/errors';
import { computeSubscriptionExpiry, parseSubscriptionPlan, subscriptionDays } from '../utils/subscription';

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

    const plan = parseSubscriptionPlan(req.body?.plan ?? 'monthly');
    if (!plan) return next(new BadRequestError('plan must be monthly or yearly'));
    const expiry = computeSubscriptionExpiry(subscriptionDays(plan));

    user.subscriptionActive = true;
    user.subscriptionExpiry = expiry;
    user.subscriptionPlan = plan;
    await user.save();

    res.json({
      success: true,
      subscriptionActive: user.subscriptionActive,
      subscriptionExpiry: user.subscriptionExpiry,
      subscriptionPlan: user.subscriptionPlan,
    });
  } catch (err) {
    next(err);
  }
};
