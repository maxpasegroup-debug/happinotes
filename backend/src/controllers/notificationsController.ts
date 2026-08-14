import { Request, Response, NextFunction } from 'express';
import { User } from '../models';
import { BadRequestError } from '../utils/errors';
import { env } from '../config/env';

type Target = 'all' | 'premium' | 'free';
type ExpoTicket = { status: 'ok' | 'error'; id?: string; message?: string; details?: { error?: string } };

const getTargetFilter = (target: Target) => {
  if (target === 'premium') return { role: 'user', subscriptionStatus: { $in: ['premium', 'lifetime'] } };
  if (target === 'free') return { role: 'user', subscriptionStatus: 'free' };
  return { role: 'user' };
};

export const sendNotificationToUsers = async ({
  title,
  message,
  target = 'all',
  data,
}: {
  title: string;
  message: string;
  target?: Target;
  data?: Record<string, string>;
}) => {
  const users = await User.find({
    ...getTargetFilter(target),
    expoPushToken: { $ne: null },
  }).select('expoPushToken');

  const recipients = users
    .map((user) => user.expoPushToken)
    .filter((token): token is string => Boolean(token) && /^(ExponentPushToken|ExpoPushToken)\[[^\]]+\]$/.test(token as string));
  const messages = recipients.map((to) => ({
    to,
    sound: 'default',
    channelId: 'default',
    priority: 'high',
    title,
    body: message,
    ...(data ? { data } : {}),
  }));

  let accepted = 0;
  let failed = 0;
  const invalidTokens: string[] = [];
  for (let offset = 0; offset < messages.length; offset += 100) {
    const batch = messages.slice(offset, offset + 100);
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(env.EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${env.EXPO_ACCESS_TOKEN}` } : {}),
      },
      body: JSON.stringify(batch),
    });
    const payload = await response.json() as { data?: ExpoTicket[]; errors?: { message?: string }[] };
    if (!response.ok || payload.errors?.length) {
      throw new Error(payload.errors?.[0]?.message || `Expo Push Service returned ${response.status}`);
    }
    (payload.data || []).forEach((ticket, index) => {
      if (ticket.status === 'ok') accepted += 1;
      else {
        failed += 1;
        if (ticket.details?.error === 'DeviceNotRegistered') invalidTokens.push(batch[index].to);
      }
    });
  }
  if (invalidTokens.length) {
    await User.updateMany({ expoPushToken: { $in: invalidTokens } }, { $set: { expoPushToken: null } });
  }
  return { recipients: messages.length, accepted, failed };
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

    const result = await sendNotificationToUsers({ title, message, target });
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};
