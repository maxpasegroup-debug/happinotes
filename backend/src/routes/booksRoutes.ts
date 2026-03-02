import { Router } from 'express';
import { getBooks, getBookById, getBookAudio } from '../controllers/booksController';
import { authenticate, optionalAuthenticate } from '../middleware';

const router = Router();

router.get('/', optionalAuthenticate, getBooks);
router.get('/:id/audio', authenticate, getBookAudio);
router.get('/:id', optionalAuthenticate, getBookById);

export default router;
