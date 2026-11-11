import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware';
import { createHappyBite, deleteHappyBite, listAdminHappyBites, updateHappyBite } from '../controllers/happyBitesController';

const router = Router();
router.use(authenticate, requireAdmin);
router.get('/', listAdminHappyBites);
router.post('/', createHappyBite);
router.put('/:id', updateHappyBite);
router.delete('/:id', deleteHappyBite);
export default router;
