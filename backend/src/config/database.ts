import mongoose from 'mongoose';
import path from 'path';
import { mkdir } from 'fs/promises';
import { env } from './env';

const ensureBookIndexes = async (connection: mongoose.Connection): Promise<void> => {
  const books = connection.collection('books');
  const indexes = await books.indexes().catch((error: { codeName?: string }) => {
    if (error.codeName === 'NamespaceNotFound') return [];
    throw error;
  });

  for (const index of indexes) {
    const isTextIndex = Object.values(index.key).includes('text');
    if (isTextIndex && index.name !== 'book_search_text_v2' && index.name) {
      await books.dropIndex(index.name);
    }
  }

  await books.createIndex(
    { title: 'text', description: 'text', tags: 'text' },
    {
      name: 'book_search_text_v2',
      default_language: 'none',
      language_override: 'searchIndexLanguage',
    }
  );
  await books.createIndex(
    { status: 1, sortOrder: 1, createdAt: -1 },
    { name: 'status_1_sortOrder_1_createdAt_-1' }
  );
};

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
    await ensureBookIndexes(conn.connection);
    console.log(`MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};
