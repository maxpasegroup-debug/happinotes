import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';
import * as Sentry from '@sentry/node';
import routes from './routes';
import { errorHandler } from './middleware';
import { env } from './config/env';
import { handleWebhook } from './controllers/paymentsController';
import { mediaStoragePath } from './services/cloudinary';

const app = express();
app.set('trust proxy', 1);
const allowedOrigins = env.CORS_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean);

if (env.SENTRY_DSN) {
  Sentry.init({ dsn: env.SENTRY_DSN, environment: env.NODE_ENV });
}

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || env.NODE_ENV === 'development' || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error('Origin not allowed by CORS'));
  },
  credentials: true,
}));
app.post('/api/payments/webhook', express.raw({ type: 'application/json' }), handleWebhook);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(mediaStoragePath));
app.use(mongoSanitize());
app.use('/api/auth', authLimiter);

app.get('/health', (_req, res) => {
  res.json({ success: true, message: 'Happinotes Backend is running' });
});

app.use('/api', routes);

app.use(errorHandler);

export default app;
