import { Request, Response, NextFunction } from 'express';
import { User } from '../models';
import { BadRequestError } from '../utils/errors';
import { env } from '../config/env';

type Target = 'all' | 'premium' | 'free';

const getTargetFilter = (target: Target) => {
  if (target === 'premium') return { subscriptionStatus: { $in: ['premium', 'lifetime'] } };
  if (target === 'free') return { subscriptionStatus: 'free' };
  return {};
};

export const sendNotification = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { title, message, target = 'all' } = req.body as {
      title?: string;
      message?: string;
      target?: Target;
    };

    if (!title || !message) return next(new BadRequestError('Title and message are required'));

    const users = await User.find({
      ...getTargetFilter(target),
      expoPushToken: { $ne: null },
    }).select('expoPushToken');

    const messages = users
      .map((user) => user.expoPushToken)
      .filter(Boolean)
      .map((to) => ({
        to,
        sound: 'default',
        title,
        body: message,
      }));

    if (messages.length) {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(env.EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${env.EXPO_ACCESS_TOKEN}` } : {}),
        },
        body: JSON.stringify(messages),
      });
    }

    res.json({ success: true, sent: messages.length });
  } catch (err) {
    next(err);
  }
};
