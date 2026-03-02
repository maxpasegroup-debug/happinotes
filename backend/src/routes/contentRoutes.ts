import { Router } from 'express';
import { getContents, getContentById } from '../controllers/contentController';
import { optionalAuthenticate } from '../middleware';

const router = Router();

router.get('/', optionalAuthenticate, getContents);
router.get('/:id', optionalAuthenticate, getContentById);

export default router;

