import app from './app';
import { connectDB } from './config/database';
import { ensureAdminUser } from './config/ensureAdmin';
import { env } from './config/env';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { registerRealtimeServer } from './services/realtime';

if (!process.env.PORT && process.env.NODE_ENV === 'production') {
  throw new Error('PORT is not defined in production');
}

const PORT = Number(process.env.PORT);

const start = async (): Promise<void> => {
  console.log('ADMIN_EMAIL:', process.env.ADMIN_EMAIL ? 'SET' : 'MISSING');
  console.log('BREVO_API_KEY:', process.env.BREVO_API_KEY ? 'SET' : 'MISSING');
  console.log('EMAIL_USER:', process.env.EMAIL_USER ? 'SET' : 'MISSING');
  console.log('EMAIL_PASS:', process.env.EMAIL_PASS ? 'SET' : 'MISSING');
  if (!process.env.BREVO_API_KEY?.trim()) {
    console.error('BREVO_API_KEY is MISSING - forgot-password OTP emails will fail');
  }

  await connectDB();
  await ensureAdminUser();
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
