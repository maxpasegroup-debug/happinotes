import { Router } from 'express';
import { getHappyBite, listHappyBites } from '../controllers/happyBitesController';
import { optionalAuthenticate } from '../middleware';

const router = Router();
router.get('/', optionalAuthenticate, listHappyBites);
router.get('/:id', optionalAuthenticate, getHappyBite);
export default router;
