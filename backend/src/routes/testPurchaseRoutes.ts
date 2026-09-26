import { Router } from 'express';
import { authenticate } from '../middleware';
import { testPurchaseBook } from '../controllers/testPurchaseController';

const router = Router();

// Test-only entitlement simulation. Replace with a real provider before release.
router.post('/purchase-book', authenticate, testPurchaseBook);

export default router;
