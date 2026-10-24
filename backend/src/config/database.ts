import mongoose from 'mongoose';

export const connectDB = async (): Promise<void> => {
  const uri = process.env.MONGODB_URI;
  if (!uri || uri.trim() === '') {
    throw new Error('MONGODB_URI not defined');
  }
  try {
    console.log('Connecting to MongoDB');
    const conn = await mongoose.connect(uri);
    console.log(`MongoDB connected: ${conn.connection.host}`);
  } catch {
    console.error('MongoDB connection failed');
    process.exit(1);
  }
};
