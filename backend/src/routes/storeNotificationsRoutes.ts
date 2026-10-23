import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { appleStoreNotification, googleStoreNotification } from '../controllers/storeNotificationsController';

const router = Router();
const storeNotificationLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/apple', storeNotificationLimiter, appleStoreNotification);
router.post('/google', storeNotificationLimiter, googleStoreNotification);

export default router;
