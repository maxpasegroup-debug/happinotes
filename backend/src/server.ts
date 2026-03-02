import app from './app';
import { connectDB } from './config/database';
import { ensureAdminUser } from './config/ensureAdmin';
import { env } from './config/env';

if (!process.env.PORT && process.env.NODE_ENV === 'production') {
  throw new Error('PORT is not defined in production');
}

const PORT = Number(process.env.PORT);

const start = async (): Promise<void> => {
  await connectDB();
  await ensureAdminUser();
  app.listen(PORT, () => {
    console.log('PORT ENV:', process.env.PORT);
    console.log(`Server running on port ${PORT}`);
  });
};

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
