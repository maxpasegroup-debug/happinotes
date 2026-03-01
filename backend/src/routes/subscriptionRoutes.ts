import { Router } from 'express';
import { activate } from '../controllers/subscriptionController';
import { authenticate } from '../middleware';

const router = Router();

router.post('/activate', authenticate, activate);

export default router;
