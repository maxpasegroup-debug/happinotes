import mongoose from 'mongoose';
import {
  Notification,
  type NotificationTarget,
  type NotificationType,
} from '../models';

export type CreateNotificationInput = {
  title: string;
  message: string;
  type: NotificationType;
  target: NotificationTarget;
  bookId?: string;
  episodeId?: string;
  imageUrl?: string;
};

function objectIdOrUndefined(value: string | undefined): mongoose.Types.ObjectId | undefined {
  return value && mongoose.isValidObjectId(value)
    ? new mongoose.Types.ObjectId(value)
    : undefined;
}

export async function createInAppNotification(
  input: CreateNotificationInput,
): Promise<void> {
  await Notification.create({
    title: input.title,
    message: input.message,
    type: input.type,
    target: input.target,
    ...(objectIdOrUndefined(input.bookId)
      ? { bookId: objectIdOrUndefined(input.bookId) }
      : {}),
    ...(objectIdOrUndefined(input.episodeId)
      ? { episodeId: objectIdOrUndefined(input.episodeId) }
      : {}),
    ...(input.imageUrl ? { imageUrl: input.imageUrl } : {}),
  });
}
