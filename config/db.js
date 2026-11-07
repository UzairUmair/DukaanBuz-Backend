import mongoose from 'mongoose';

let connectionPromise;

const connectionOptions = {
  serverSelectionTimeoutMS: 8000,
  connectTimeoutMS: 8000,
  socketTimeoutMS: 20000,
  maxPoolSize: 10,
  bufferCommands: false,
};

export const connectDB = async (uri = process.env.MONGODB_URI) => {
  if (typeof uri !== 'string' || !uri.trim()) {
    throw new Error('MONGODB_URI is not configured');
  }
  if (!uri.startsWith('mongodb://') && !uri.startsWith('mongodb+srv://')) {
    throw new Error('MONGODB_URI must use a MongoDB connection scheme');
  }

  if (mongoose.connection.readyState === 1) return;
  if (mongoose.connection.readyState === 2 && connectionPromise) return connectionPromise;

  if (!connectionPromise) {
    connectionPromise = mongoose.connect(uri, connectionOptions)
      .then(() => undefined)
      .catch((error) => {
        console.error('MongoDB connection failed:', error.name, error.code || '');
        throw error;
      })
      .finally(() => {
        connectionPromise = undefined;
      });
  }

  return connectionPromise;
};

export const checkDatabaseReady = async () => {
  try {
    await connectDB();
    await mongoose.connection.db.admin().ping();
    return true;
  } catch (error) {
    console.error('MongoDB readiness check failed:', error.name, error.code || '');
    return false;
  }
};

export const disconnectDB = async () => {
  await mongoose.disconnect();
  connectionPromise = undefined;
};
