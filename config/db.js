import mongoose from 'mongoose';

let connectionPromise;

export const connectDB = async (uri = process.env.MONGODB_URI) => {
  if (!uri) {
    throw new Error('MONGODB_URI is not configured');
  }
  if (mongoose.connection.readyState === 1) return;

  if (!connectionPromise) {
    connectionPromise = mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  }

  try {
    await connectionPromise;
  } catch (error) {
    console.error('MongoDB connection failed:', error.name, error.code || '');
    throw error;
  } finally {
    connectionPromise = undefined;
  }
};

export const disconnectDB = async () => {
  await mongoose.disconnect();
};
