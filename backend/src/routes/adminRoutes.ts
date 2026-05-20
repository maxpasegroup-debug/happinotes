import { Router } from 'express';
import { body } from 'express-validator';
import {
  getUsers,
  getAdminBooks,
  createBook,
  updateBook,
  deleteBook,
} from '../controllers/adminController';
import { authenticate, requireAdmin } from '../middleware';

const router = Router();

router.use(authenticate);

router.use(requireAdmin);

const bookValidation = [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('description').trim().notEmpty().withMessage('Description is required'),
  body('language').isIn(['english', 'malayalam', 'hindi']).withMessage('Invalid language'),
  body('category').isIn(['health', 'wealth', 'happiness', 'mindfulness']).withMessage('Invalid category'),
  body('coverImageUrl').optional().trim(),
  body('coverPublicId').optional().trim(),
  body('introAudioUrl').optional().trim(),
  body('introAudioPublicId').optional().trim(),
  body('totalDurationSeconds').optional().isNumeric(),
  body('accessType').optional().isIn(['free', 'premium']).withMessage('Invalid access type'),
  body('status').optional().isIn(['draft', 'upcoming', 'live']).withMessage('Invalid status'),
  body('isFeatured').optional().isBoolean(),
  body('isTrending').optional().isBoolean(),
  body('sortOrder').optional().isNumeric(),
  body('tags').optional().isArray(),
];

router.get('/users', getUsers);
router.get('/books', getAdminBooks);
router.post('/books', bookValidation, createBook);
router.put('/books/:id', bookValidation, updateBook);
router.delete('/books/:id', deleteBook);

export default router;
