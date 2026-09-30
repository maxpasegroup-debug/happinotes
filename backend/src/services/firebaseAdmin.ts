import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getMessaging, type Messaging } from 'firebase-admin/messaging';
import { env } from '../config/env';

type ServiceAccountJson = {
  project_id?: string;
  client_email?: string;
  private_key?: string;
};

let firebaseApp: App | null | undefined;

function getFirebaseApp(): App | null {
  if (firebaseApp !== undefined) return firebaseApp;

  const raw = env.FIREBASE_SERVICE_ACCOUNT_JSON.trim();
  if (!raw) {
    firebaseApp = null;
    return firebaseApp;
  }

  try {
    const account = JSON.parse(raw) as ServiceAccountJson;
    if (!account.project_id || !account.client_email || !account.private_key) {
      throw new Error('Firebase service account is missing required fields');
    }

    firebaseApp = getApps()[0] ?? initializeApp({
      credential: cert({
        projectId: account.project_id,
        clientEmail: account.client_email,
        privateKey: account.private_key.replace(/\\n/g, '\n'),
      }),
    });
    return firebaseApp;
  } catch (error) {
    console.error('[FCM] Firebase Admin initialization failed:', error);
    firebaseApp = null;
    return firebaseApp;
  }
}

export function getFirebaseMessaging(): Messaging | null {
  const app = getFirebaseApp();
  return app ? getMessaging(app) : null;
}
