import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import routes from './routes';
import debugRoutes from './routes/debugRoutes';
import { User } from './models';
import { errorHandler } from './middleware';

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: [
      'http://localhost:8081',
      'https://happinotes-production.up.railway.app',
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (_req, res) => {
  res.json({ success: true, message: 'Happinotes Backend is running' });
});

app.get('/debug/admin-status', async (_req, res) => {
  console.log('ADMIN STATUS ROUTE HIT');

  const ADMIN_EMAIL = process.env.ADMIN_EMAIL?.trim()?.toLowerCase();

  if (!ADMIN_EMAIL) {
    return res.json({
      exists: false,
      email: null,
      role: null,
      message: 'ADMIN_EMAIL not set',
    });
  }

  const admin = await User.findOne({ email: ADMIN_EMAIL });

  if (!admin) {
    return res.json({
      exists: false,
      email: ADMIN_EMAIL,
      role: null,
    });
  }

  return res.json({
    exists: true,
    email: admin.email,
    role: admin.role,
  });
});

app.get('/test-route', (_req, res) => {
  console.log('TEST ROUTE HIT');
  res.json({ ok: true, source: 'app.ts direct route' });
});

// GET /debug/admin-status — defined on app so it always exists (no dependency on debugRoutes load)
const ADMIN_EMAIL = process.env.ADMIN_EMAIL?.trim()?.toLowerCase();
app.get('/debug/admin-status', async (_req, res) => {
  console.log('ADMIN STATUS ROUTE HIT');
  if (!ADMIN_EMAIL) {
    res.json({ exists: false, email: null, role: null, message: 'ADMIN_EMAIL not set' });
    return;
  }
  console.log('Before DB query');
  const admin = await User.findOne({ email: ADMIN_EMAIL }).select('email role').lean();
  console.log('After DB query');
  if (!admin) {
    res.json({ exists: false, email: ADMIN_EMAIL, role: null });
    return;
  }
  res.json({ exists: true, email: admin.email, role: admin.role });
});

// Mount rest of debug routes (users, test-login, test-email)
app.use('/debug', debugRoutes);

app.use(routes);

app.use(errorHandler);

export default app;
