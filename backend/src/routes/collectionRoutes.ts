import { Router } from 'express';
import {
  getCollection,
  addToCollection,
  removeFromCollection,
  addHappyBiteToCollection,
  removeHappyBiteFromCollection,
} from '../controllers/collectionController';
import { authenticate } from '../middleware';

const router = Router();

router.use(authenticate);

router.get('/', getCollection);
router.post('/happy-bites/:biteId', addHappyBiteToCollection);
router.delete('/happy-bites/:biteId', removeHappyBiteFromCollection);
router.post('/:bookId', addToCollection);
router.delete('/:bookId', removeFromCollection);

export default router;
