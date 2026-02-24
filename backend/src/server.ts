import app from './app';
import { connectDB } from './config/database';
import { env } from './config/env';

const PORT = process.env.PORT || 8080;

const start = async (): Promise<void> => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
