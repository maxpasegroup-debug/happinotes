import { Router } from 'express';
import { getBooks, getBookById } from '../controllers/booksController';
import { optionalAuthenticate } from '../middleware';

const router = Router();

router.get('/', optionalAuthenticate, getBooks);
router.get('/:id', optionalAuthenticate, getBookById);

export default router;
