import { Router } from 'express';
import {
  getCollection,
  addToCollection,
  removeFromCollection,
} from '../controllers/collectionController';
import { authenticate } from '../middleware';

const router = Router();

router.use(authenticate);

router.get('/', getCollection);
router.post('/:bookId', addToCollection);
router.delete('/:bookId', removeFromCollection);

export default router;
