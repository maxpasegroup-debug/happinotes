import { Router } from 'express';
import { activate } from '../controllers/subscriptionController';
import { authenticate } from '../middleware';
import { requireAdmin } from '../middleware/admin';

const router = Router();

router.post('/activate', authenticate, requireAdmin, activate);

export default router;
