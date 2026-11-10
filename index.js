import orderRoutes from './routes/orderRoutes.js';
import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import express from 'express';
import { checkDatabaseReady, connectDB } from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import productRoutes from './routes/productRoutes.js';
import publicRoutes from './routes/publicRoutes.js';
import storeRoutes from './routes/storeRoutes.js';
import { errorHandler, notFound } from './middleware/errorMiddleware.js';
import { productUploadDirectory } from './middleware/uploadMiddleware.js';
import { getGridImage } from './config/imageStorage.js';

const app = express();
const currentFile = fileURLToPath(import.meta.url);
const allowedClientOrigins = new Set([
  'http://localhost:5173',
  ...(process.env.CLIENT_URL || '').split(',').map((origin) => origin.trim()).filter(Boolean),
]);

app.disable('x-powered-by');
if (process.env.VERCEL === '1') app.set('trust proxy', 1);
app.use(
  cors({
    origin: (origin, callback) => callback(null, !origin || allowedClientOrigins.has(origin)),
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use((req, res, next) => {
  if (req.body !== undefined && (req.body === null || Array.isArray(req.body) || typeof req.body !== 'object')) {
    return res.status(400).json({ success: false, message: 'Request body must be a JSON object', errors: [] });
  }
  req.body ??= {};
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});

app.get('/', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'DukaanBuz Backend API is running successfully!',
    version: '1.0.0',
  });
});

if (process.env.VERCEL === '1') {
  app.use(async (_req, res, next) => {
    try {
      if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
        throw new Error('JWT_SECRET must contain at least 32 characters');
      }
      await connectDB();
      next();
    } catch (error) {
      console.error('Unable to initialize backend: check JWT_SECRET, MONGODB_URI and Atlas access.', error.name);
      res.status(503).json({ success: false, message: 'Backend service is unavailable', errors: [] });
    }
  });
  app.get('/uploads/products/:filename', getGridImage);
} else {
  app.use('/uploads/products', express.static(productUploadDirectory, { index: false }));
}

app.get('/api/health', async (_req, res) => {
  if (!(await checkDatabaseReady())) {
    return res.status(503).json({
      success: false,
      message: 'Database service is unavailable',
      data: { status: 'unavailable', database: 'unavailable' },
      errors: [],
    });
  }

  res.json({
    success: true,
    message: 'DukaanSaz API is healthy',
    data: { status: 'ok', database: 'ready' },
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/stores', storeRoutes);
app.use('/api/products', productRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/dashboard', dashboardRoutes);

app.use(notFound);
app.use(errorHandler);

const startServer = async () => {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must contain at least 32 characters');
  }

  await connectDB();
  const port = Number(process.env.PORT) || 5000;
  app.listen(port, () => {
    console.log(`DukaanSaz API running at http://localhost:${port}`);
  });
};

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(currentFile)) {
  startServer().catch((error) => {
    console.error('Unable to start server: check JWT_SECRET, MONGODB_URI and Atlas access.', error.name);
    process.exit(1);
  });
}

export { app, startServer };
export default app;
