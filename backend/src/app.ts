import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import routes from './routes';
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

app.use(routes);

app.use(errorHandler);

export default app;
