import { getFirebaseMessaging } from './firebaseAdmin';

export type PushNotificationResult = {
  configured: boolean;
  sent: number;
  failed: number;
  removed: number;
  invalidTokens: string[];
  failureCodes: Record<string, number>;
  error?: string;
};

const INVALID_TOKEN_ERRORS = new Set([
  'messaging/invalid-registration-token',
  'messaging/registration-token-not-registered',
]);

export async function sendPushNotification(input: {
  tokens: string[];
  title: string;
  message: string;
  imageUrl?: string;
  target: string;
  data?: Record<string, string>;
}): Promise<PushNotificationResult> {
  const messaging = getFirebaseMessaging();
  if (!messaging) {
    console.warn('[FCM] FIREBASE_SERVICE_ACCOUNT_JSON is not configured; push skipped');
    return {
      configured: false,
      sent: 0,
      failed: 0,
      removed: 0,
      invalidTokens: [],
      failureCodes: {},
    };
  }

  const tokens = [...new Set(input.tokens.filter(Boolean))];
  if (tokens.length === 0) {
    console.info('[FCM] No recipient tokens found', {
      target: input.target,
      title: input.title,
    });
    return {
      configured: true,
      sent: 0,
      failed: 0,
      removed: 0,
      invalidTokens: [],
      failureCodes: {},
    };
  }

  let sent = 0;
  let failed = 0;
  const invalidTokens = new Set<string>();
  const failureCodes: Record<string, number> = {};

  try {
    for (let start = 0; start < tokens.length; start += 500) {
      const batch = tokens.slice(start, start + 500);
      const response = await messaging.sendEachForMulticast({
        tokens: batch,
        notification: {
          title: input.title,
          body: input.message,
          ...(input.imageUrl ? { imageUrl: input.imageUrl } : {}),
        },
        data: {
          type: 'admin_notification',
          target: input.target,
          ...(input.data ?? {}),
          ...(input.imageUrl ? { imageUrl: input.imageUrl } : {}),
        },
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
          },
        },
      });

      sent += response.successCount;
      failed += response.failureCount;
      response.responses.forEach((result, index) => {
        const code = result.error?.code;
        if (code) {
          failureCodes[code] = (failureCodes[code] ?? 0) + 1;
          if (INVALID_TOKEN_ERRORS.has(code)) invalidTokens.add(batch[index]);
        }
      });
    }

    console.info('[FCM] Notification delivery complete', {
      target: input.target,
      title: input.title,
      tokensFound: tokens.length,
      sent,
      failed,
      invalidTokens: invalidTokens.size,
      failureCodes,
    });

    return {
      configured: true,
      sent,
      failed,
      removed: invalidTokens.size,
      invalidTokens: [...invalidTokens],
      failureCodes,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[FCM] Push delivery failed:', message);
    return {
      configured: true,
      sent,
      failed: failed || tokens.length,
      removed: 0,
      invalidTokens: [],
      failureCodes,
      error: message,
    };
  }
}
