import { Router } from 'express';
import { body } from 'express-validator';
import {
  getUsers,
  getAllBooks,
  createBook,
  updateBook,
  deleteBook,
  updateBookStatus,
  activateUserSubscription,
  deactivateUserSubscription,
  deleteUser,
  blockUser,
  unblockUser,
} from '../controllers/adminController';
import { authenticate, requireAdmin } from '../middleware';

const router = Router();

router.use(authenticate);
router.use(requireAdmin);

const createBookValidation = [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('description').optional().trim(),
  body('thumbnailUrl').trim().notEmpty().withMessage('thumbnailUrl is required'),
  body('language').trim().notEmpty().withMessage('language is required'),
  body('type').isIn(['free', 'premium']).withMessage('type must be free or premium'),
  body('intro').optional().isObject(),
  body('intro.title').optional().trim(),
  body('intro.mediaUrl').optional().trim(),
  body('intro.mediaType').optional().isIn(['audio', 'video']),
  body('intro.description').optional().trim(),
  body('conclusion').optional().isObject(),
  body('conclusion.title').optional().trim(),
  body('conclusion.mediaUrl').optional().trim(),
  body('conclusion.mediaType').optional().isIn(['audio', 'video']),
  body('conclusion.description').optional().trim(),
  body('lessons').isArray().withMessage('lessons must be an array'),
  body('lessons.*.title').optional().trim(),
  body('lessons.*.mediaUrl').optional().trim(),
  body('lessons.*.mediaType').optional().isIn(['audio', 'video']),
  body('lessons.*.description').optional().trim(),
  body('lessons.*.order').optional().isInt({ min: 0 }),
];

const updateBookValidation = [
  body('title').optional().trim().notEmpty(),
  body('description').optional().trim(),
  body('thumbnailUrl').optional().trim(),
  body('language').optional().trim(),
  body('type').optional().isIn(['free', 'premium']).withMessage('Invalid type'),
  body('intro').optional().isObject(),
  body('intro.title').optional().trim().notEmpty(),
  body('intro.mediaUrl').optional().trim(),
  body('intro.mediaType').optional().isIn(['audio', 'video']),
  body('intro.description').optional().trim(),
  body('conclusion').optional().isObject(),
  body('conclusion.title').optional().trim().notEmpty(),
  body('conclusion.mediaUrl').optional().trim(),
  body('conclusion.mediaType').optional().isIn(['audio', 'video']),
  body('conclusion.description').optional().trim(),
  body('lessons').optional().isArray(),
  body('lessons.*.title').optional().trim(),
  body('lessons.*.mediaUrl').optional().trim(),
  body('lessons.*.mediaType').optional().isIn(['audio', 'video']),
  body('lessons.*.description').optional().trim(),
  body('lessons.*.order').optional().isInt({ min: 0 }),
];

const updateStatusValidation = [
  body('status').isIn(['draft', 'coming_soon', 'live']).withMessage('status must be draft, coming_soon, or live'),
];

router.get('/users', getUsers);
router.patch('/users/:id/activate', activateUserSubscription);
router.patch('/users/:id/deactivate', deactivateUserSubscription);
router.patch('/users/:id/block', blockUser);
router.patch('/users/:id/unblock', unblockUser);
router.delete('/users/:id', deleteUser);

router.get('/books', getAllBooks);
router.post('/books', createBookValidation, createBook);
router.put('/books/:id', updateBookValidation, updateBook);
router.delete('/books/:id', deleteBook);
router.patch('/books/:id/status', updateStatusValidation, updateBookStatus);

export default router;
