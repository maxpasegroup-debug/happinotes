import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import routes from './routes';
import { handleRazorpayWebhook } from './controllers/paymentsController';
import { errorHandler } from './middleware';

const app = express();
const configuredOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((x) => x.trim())
  .filter(Boolean);
const staticOrigins = [
  'http://localhost:8081',
  'http://localhost:3000',
  'https://happinotes-production.up.railway.app',
];
const allowedOrigins = new Set([...staticOrigins, ...configuredOrigins]);

app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.has(origin)) return callback(null, true);
      // Allow common frontend hosting domains unless restricted via CORS_ORIGINS.
      if (origin.endsWith('.vercel.app') || origin.endsWith('.railway.app')) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true,
  })
);
// Razorpay webhook needs raw body for signature verification.
app.post('/payments/razorpay/webhook', express.raw({ type: 'application/json' }), handleRazorpayWebhook);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (_req, res) => {
  res.json({ success: true, message: 'Happinotes Backend is running' });
});

app.use(routes);

app.use(errorHandler);

export default app;
