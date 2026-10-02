import { User } from '../models';
import { sendPushNotification } from './pushNotification';

type CatalogNotificationInput = {
  eventType: 'new_book' | 'new_episode';
  bookId: string;
  episodeId?: string;
  title: string;
  message: string;
  imageUrl?: string;
  baseUrl?: string;
};

function toAbsoluteImageUrl(imageUrl: string | undefined, baseUrl: string | undefined): string | undefined {
  const value = imageUrl?.trim();
  if (!value) return undefined;
  try {
    const resolved = new URL(value, baseUrl);
    return resolved.protocol === 'http:' || resolved.protocol === 'https:'
      ? resolved.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Notify every registered device about a newly published catalog item.
 * Notification failures must never make an admin content request fail.
 */
export async function notifyCatalogUsers(
  input: CatalogNotificationInput,
): Promise<void> {
  try {
    const recipients = await User.find().select({ fcmTokens: 1 }).lean();
    const tokens = [...new Set(recipients.flatMap((user) => user.fcmTokens ?? []))];
    if (tokens.length === 0) {
      console.info('[FCM] Catalog notification skipped: no recipient tokens', {
        eventType: input.eventType,
        bookId: input.bookId,
      });
      return;
    }
    const imageUrl = toAbsoluteImageUrl(input.imageUrl, input.baseUrl);

    const push = await sendPushNotification({
      tokens,
      title: input.title,
      message: input.message,
      target: 'all',
      data: {
        eventType: input.eventType,
        bookId: input.bookId,
        ...(input.episodeId ? { episodeId: input.episodeId } : {}),
      },
      ...(imageUrl ? { imageUrl } : {}),
    });

    if (push.invalidTokens.length > 0) {
      await User.updateMany(
        { fcmTokens: { $in: push.invalidTokens } },
        { $pull: { fcmTokens: { $in: push.invalidTokens } } },
      );
    }

    console.info('[FCM] Catalog notification', {
      eventType: input.eventType,
      bookId: input.bookId,
      ...(input.episodeId ? { episodeId: input.episodeId } : {}),
      tokensFound: tokens.length,
      sent: push.sent,
      failed: push.failed,
      invalidTokens: push.invalidTokens.length,
    });

    if (push.failed > 0 || !push.configured) {
      console.warn('[FCM] Catalog notification was not delivered to all devices', {
        configured: push.configured,
        sent: push.sent,
        failed: push.failed,
      });
    }
  } catch (error) {
    console.error('[FCM] Catalog notification failed:', error);
  }
}
