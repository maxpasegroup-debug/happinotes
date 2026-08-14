import mongoose from 'mongoose';
import path from 'path';
import { mkdir } from 'fs/promises';
import { env } from './env';

export const connectDB = async (): Promise<void> => {
  try {
    let mongoUri = env.MONGODB_URI;

    if (env.NODE_ENV === 'development' && env.USE_EMBEDDED_MONGODB) {
      const { MongoMemoryServer } = await import('mongodb-memory-server');
      const dbPath = path.resolve(process.cwd(), '.local-mongodb');
      await mkdir(dbPath, { recursive: true });
      const embeddedMongo = await MongoMemoryServer.create({
        instance: {
          dbName: 'happinotes',
          dbPath,
          storageEngine: 'wiredTiger',
        },
      });
      mongoUri = embeddedMongo.getUri();
      console.log('Embedded local MongoDB started');
    }

    const conn = await mongoose.connect(mongoUri);
    console.log(`MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};
