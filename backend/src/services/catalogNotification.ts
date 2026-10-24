import { User } from '../models';
import { sendPushNotification } from './pushNotification';
import { createInAppNotification } from './inAppNotification';

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
    const imageUrl = toAbsoluteImageUrl(input.imageUrl, input.baseUrl);
    try {
      await createInAppNotification({
        type: input.eventType,
        title: input.title,
        message: input.message,
        target: 'all',
        bookId: input.bookId,
        ...(input.episodeId ? { episodeId: input.episodeId } : {}),
        ...(imageUrl ? { imageUrl } : {}),
      });
    } catch {
      console.error('catalog_notification_persist_failed', { eventType: input.eventType });
    }
    const recipients = await User.find({
      $or: [{ deletionState: 'active' }, { deletionState: { $exists: false } }],
    }).select({ fcmTokens: 1 }).lean();
    const tokens = [...new Set(recipients.flatMap((user) => user.fcmTokens ?? []))];
    if (tokens.length === 0) {
      console.info('catalog_push_skipped', { eventType: input.eventType, reason: 'no_recipients' });
      return;
    }
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

    console.info('catalog_push_completed', {
      eventType: input.eventType,
      tokensFound: tokens.length,
      sent: push.sent,
      failed: push.failed,
      invalidTokens: push.invalidTokens.length,
      failureCodes: push.failureCodes,
    });

    if (push.failed > 0 || !push.configured) {
      console.warn('[FCM] Catalog notification was not delivered to all devices', {
        configured: push.configured,
        sent: push.sent,
        failed: push.failed,
        failureCodes: push.failureCodes,
      });
    }
  } catch {
    console.error('catalog_notification_failed', { eventType: input.eventType });
  }
}
