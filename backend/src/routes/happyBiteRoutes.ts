import { Router } from 'express';
import { listHappyBites } from '../controllers/happyBitesController';

const router = Router();
router.get('/', listHappyBites);
export default router;
