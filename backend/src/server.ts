import app from './app';
import { connectDB } from './config/database';
import { ensureAdminUser } from './config/ensureAdmin';
import { env } from './config/env';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { registerRealtimeServer } from './services/realtime';
import { startProductProvisioningWorker } from './services/storeProductProvisioning';
import { startAccountDeletionWorker } from './services/accountDeletionWorker';
import { configureCloudinary, isCloudinaryConfigured } from './config/cloudinary';

if (!process.env.PORT && process.env.NODE_ENV === 'production') {
  throw new Error('PORT is not defined in production');
}

const PORT = Number(process.env.PORT);

const start = async (): Promise<void> => {
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
  startProductProvisioningWorker();
  startAccountDeletionWorker();
  const httpServer = createServer(app);
  const configuredOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const io = new Server(httpServer, {
    cors: {
      origin: configuredOrigins.length > 0 ? configuredOrigins : true,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });
  registerRealtimeServer(io);
  io.on('connection', (socket) => {
    console.log(`Realtime client connected: ${socket.id}`);
  });

  httpServer.listen(PORT, () => {
    console.log('PORT ENV:', process.env.PORT);
    console.log(`Server running on port ${PORT}`);
  });
};

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
