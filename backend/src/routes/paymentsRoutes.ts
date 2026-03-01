import { Router } from 'express';
import { verifyGoogleSubscription } from '../controllers/paymentsController';
import { authenticate } from '../middleware';

const router = Router();

router.post('/google/verify', authenticate, verifyGoogleSubscription);

export default router;
