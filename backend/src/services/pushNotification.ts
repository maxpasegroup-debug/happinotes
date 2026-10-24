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

const TRANSIENT_FIREBASE_ERRORS = new Set([
  'messaging/server-unavailable',
  'messaging/internal-error',
  'messaging/unknown-error',
]);
const RATE_LIMIT_FIREBASE_ERRORS = new Set([
  'messaging/message-rate-exceeded',
  'messaging/device-message-rate-exceeded',
  'messaging/topics-message-rate-exceeded',
]);
const AUTH_FIREBASE_ERRORS = new Set([
  'messaging/authentication-error',
  'messaging/third-party-auth-error',
  'messaging/mismatched-credential',
  'messaging/invalid-apns-credentials',
]);
const REQUEST_FIREBASE_ERRORS = new Set([
  'messaging/invalid-argument',
  'messaging/invalid-recipient',
  'messaging/invalid-options',
  'messaging/payload-size-limit-exceeded',
]);

function firebaseFailureCategory(error: unknown): string {
  const code = error && typeof error === 'object' && 'code' in error
    ? (error as { code?: unknown }).code
    : undefined;
  if (typeof code !== 'string') return 'provider_error';
  if (INVALID_TOKEN_ERRORS.has(code)) return 'invalid_token';
  if (TRANSIENT_FIREBASE_ERRORS.has(code)) return 'transient_provider_error';
  if (RATE_LIMIT_FIREBASE_ERRORS.has(code)) return 'rate_limited';
  if (AUTH_FIREBASE_ERRORS.has(code)) return 'provider_authentication_error';
  if (REQUEST_FIREBASE_ERRORS.has(code)) return 'invalid_request';
  return 'provider_error';
}

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
    console.warn('push_delivery_skipped', { provider: 'firebase', reason: 'not_configured' });
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
    console.info('push_delivery_skipped', { provider: 'firebase', reason: 'no_recipients' });
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
          const category = firebaseFailureCategory(result.error);
          failureCodes[category] = (failureCodes[category] ?? 0) + 1;
          if (INVALID_TOKEN_ERRORS.has(code)) invalidTokens.add(batch[index]);
        }
      });
    }

    console.info('push_delivery_completed', {
      provider: 'firebase',
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
    const category = firebaseFailureCategory(error);
    console.error('push_delivery_failed', {
      provider: 'firebase',
      category,
      sent,
      failed,
    });
    return {
      configured: true,
      sent,
      failed: failed || tokens.length,
      removed: 0,
      invalidTokens: [],
      failureCodes,
      error: 'Push delivery failed',
    };
  }
}
