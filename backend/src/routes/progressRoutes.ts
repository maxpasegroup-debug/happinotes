import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate } from '../middleware';
import {
  getBookProgress,
  getRecentProgress,
  saveProgress,
} from '../controllers/progressController';

const router = Router();

router.use(authenticate);

router.get('/recent', getRecentProgress);
router.get('/:bookId', getBookProgress);
router.post(
  '/',
  [
    body('bookId').isMongoId().withMessage('Valid bookId is required'),
    body('chapterId').isMongoId().withMessage('Valid chapterId is required'),
    body('positionSeconds').isNumeric().withMessage('positionSeconds is required'),
    body('completed').optional().isBoolean(),
  ],
  saveProgress
);

export default router;
