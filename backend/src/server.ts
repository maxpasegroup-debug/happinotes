import app from './app';
import { connectDB } from './config/database';
import { ensureAdminUser } from './config/ensureAdmin';
import { env } from './config/env';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { registerAdminRealtime } from './services/adminRealtime';
import { registerRealtimeServer, watchUserSecurityChanges } from './services/realtime';
import { startProductProvisioningWorker } from './services/storeProductProvisioning';
import { startAccountDeletionWorker } from './services/accountDeletionWorker';
import { startStoreNotificationInboxWorker } from './services/storeNotificationInboxWorker';
import { StoreNotificationInbox } from './models/StoreNotificationInbox';
import { StoreNotificationReconciliationLease } from './models/StoreNotificationReconciliationLease';
import { StoreNotificationOpsAudit } from './models/StoreNotificationOpsAudit';
import { StorePurchase } from './models/StorePurchase';
import { SubscriptionPurchase } from './models/SubscriptionPurchase';
import { configureCloudinary, isCloudinaryConfigured } from './config/cloudinary';
import { corsConfiguration } from './config/cors';

const start = async (): Promise<void> => {
  if (env.RATE_LIMIT_STORE_WARNING) {
    console.warn('auth_rate_limit_store_mode', { mode: env.RATE_LIMIT_STORE_MODE, shared: env.RATE_LIMIT_STORE_SHARED });
  }
  configureCloudinary();
  console.log('ADMIN_EMAIL:', process.env.ADMIN_EMAIL ? 'SET' : 'MISSING');
  console.log('RESEND_API_KEY:', process.env.RESEND_API_KEY ? 'SET' : 'MISSING');
  console.log('RESEND_FROM_EMAIL:', process.env.RESEND_FROM_EMAIL ? 'SET' : 'MISSING');
  console.log('FIREBASE_SERVICE_ACCOUNT_JSON:', process.env.FIREBASE_SERVICE_ACCOUNT_JSON ? 'SET' : 'MISSING');
  console.log('CLOUDINARY_MEDIA_STORAGE:', isCloudinaryConfigured() ? 'SET' : 'MISSING');
  if (!isCloudinaryConfigured()) {
    console.error('Cloudinary media storage is MISSING - admin image/audio uploads will fail');
  }
  if (!process.env.RESEND_API_KEY?.trim()) {
    console.error('RESEND_API_KEY is MISSING - email OTP delivery will fail');
  }

  await connectDB();
  await ensureAdminUser();
  // Do not accept provider events until the inbox collection and required
  // indexes are ready. Mongoose autoIndex remains enabled in this app.
  await StoreNotificationInbox.init();
  await StoreNotificationReconciliationLease.init();
  await StoreNotificationOpsAudit.init();
  // Transaction claim uniqueness must be ready before any purchase or
  // notification route can accept requests.
  await StorePurchase.init();
  await SubscriptionPurchase.init();
  startProductProvisioningWorker();
  startAccountDeletionWorker();
  startStoreNotificationInboxWorker();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: corsConfiguration.socketIoOptions,
  });
  registerAdminRealtime(io);
  registerRealtimeServer(io);
  const stopSecurityWatch = watchUserSecurityChanges();
  httpServer.once('close', stopSecurityWatch);
  io.on('connection', (socket) => {
    console.log('realtime_client_connected');
  });

  httpServer.listen(env.PORT, () => {
    console.log('server_listening', { port: env.PORT });
  });
};

start().catch(() => {
  console.error('server_start_failed', { category: 'startup_error' });
  process.exit(1);
});
