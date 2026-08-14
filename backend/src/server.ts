import app from './app';
import { connectDB } from './config/database';
import { env } from './config/env';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { setRealtimeServer } from './realtime';
import mongoose from 'mongoose';

const start = async (): Promise<void> => {
  await connectDB();
  const httpServer = createServer(app);
  const allowedOrigins = env.CORS_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean);
  const io = new Server(httpServer, {
    cors: {
      origin: env.NODE_ENV === 'development' || !allowedOrigins.length ? true : allowedOrigins,
      credentials: true,
    },
  });
  setRealtimeServer(io);
  httpServer.listen(env.PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${env.PORT} (${env.NODE_ENV})`);
  });

  const shutdown = (signal: string) => {
    console.log(`${signal} received; closing server`);
    httpServer.close(async () => {
      await mongoose.disconnect();
      process.exit(0);
    });
  };
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));
};

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
