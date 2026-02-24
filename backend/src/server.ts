import app from './app';
import { connectDB } from './config/database';
import { env } from './config/env';

const start = async (): Promise<void> => {
  await connectDB();
  app.listen(env.PORT, () => {
    console.log(`Server running on port ${env.PORT} (${env.NODE_ENV})`);
  });
};

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
