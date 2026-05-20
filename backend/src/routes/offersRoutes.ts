import { Router } from 'express';
import { getActiveOffers } from '../controllers/offersController';

const router = Router();

router.get('/active', getActiveOffers);

export default router;
