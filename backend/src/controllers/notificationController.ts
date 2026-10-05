import { Request, Response, NextFunction } from 'express';
import { Notification } from '../models';
import { UnauthorizedError } from '../utils/errors';

export const getNotifications = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.user) return next(new UnauthorizedError('Not authenticated'));

    const isPremium = (req.user.purchasedBooks ?? []).length > 0;
    const visibility = req.user.role === 'admin'
      ? {}
      : { $or: [{ target: 'all' }, { target: isPremium ? 'premium' : 'free' }] };
    const notifications = await Notification.find(visibility)
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    res.json({
      success: true,
      notifications: notifications.map((notification) => ({
        id: String(notification._id),
        title: notification.title,
        message: notification.message,
        type: notification.type,
        target: notification.target,
        ...(notification.bookId ? { bookId: String(notification.bookId) } : {}),
        ...(notification.episodeId
          ? { episodeId: String(notification.episodeId) }
          : {}),
        ...(notification.imageUrl ? { imageUrl: notification.imageUrl } : {}),
        createdAt: notification.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    next(error);
  }
};
