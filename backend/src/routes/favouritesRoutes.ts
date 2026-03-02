import { Router } from 'express';
import {
  getFavourites,
  addFavourite,
  removeFavourite,
} from '../controllers/favouritesController';

const router = Router();

router.get('/', getFavourites);
router.post('/:contentId', addFavourite);
router.delete('/:contentId', removeFavourite);

export default router;

