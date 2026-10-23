import { Router } from 'express';
import { body } from 'express-validator';
import {
  addChapter,
  deleteChapter,
  deleteUser,
  getUsers,
  getAdminBooks,
  getAdminBookById,
  getStats,
  getUserById,
  createBook,
  updateBook,
  deleteBook,
  updateChapter,
  updateUserSubscription,
} from '../controllers/adminController';
import { authenticate, requireAdmin, validateRequest } from '../middleware';
import { sendNotification } from '../controllers/notificationsController';
import { uploadBookAudio, uploadBookCover } from '../controllers/uploadsController';
import { audioUpload, imageUpload } from '../middleware/upload';

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
  body('introAudioFileName').optional().trim().isLength({ max: 255 }),
  body('totalDurationSeconds').optional().isNumeric(),
  body('accessType').optional().isIn(['free', 'premium']).withMessage('Invalid access type'),
  body('status').optional().isIn(['draft', 'upcoming', 'live']).withMessage('Invalid status'),
  body('isFeatured').optional().isBoolean(),
  body('isTrending').optional().isBoolean(),
  body('sortOrder').optional().isNumeric(),
  body('tags').optional().isArray(),
];

const chapterValidation = [
  body('title').trim().notEmpty().withMessage('Chapter title is required'),
  body('chapterNumber').isNumeric().withMessage('Chapter number is required'),
  body('description').optional().trim(),
  body('audioUrl').optional().trim(),
  body('audioPublicId').optional().trim(),
  body('durationSeconds').optional().isNumeric(),
  body('isFreePreview').optional().isBoolean(),
];

const subscriptionValidation = [
  body('subscriptionStatus')
    .isIn(['free', 'premium', 'lifetime'])
    .withMessage('Invalid subscription status'),
  body('subscriptionExpiry').optional({ nullable: true }).isISO8601(),
];

router.get('/stats', getStats);
router.get('/users', getUsers);
router.get('/users/:id', getUserById);
router.put('/users/:id/subscription', subscriptionValidation, updateUserSubscription);
router.delete('/users/:id', deleteUser);
router.get('/books', getAdminBooks);
router.get('/books/:id', getAdminBookById);
router.post('/uploads/cover', imageUpload.single('file'), uploadBookCover);
router.post('/uploads/audio', audioUpload.single('file'), uploadBookAudio);
router.post('/books', bookValidation, createBook);
router.put('/books/:id', bookValidation, updateBook);
router.delete('/books/:id', deleteBook);
router.post('/books/:id/chapters', chapterValidation, addChapter);
router.put('/chapters/:id', chapterValidation, updateChapter);
router.delete('/chapters/:id', deleteChapter);
router.post('/notify', [
  body('title').trim().isLength({ min: 1, max: 100 }).withMessage('Title must be between 1 and 100 characters'),
  body('message').trim().isLength({ min: 1, max: 500 }).withMessage('Message must be between 1 and 500 characters'),
  body('target').optional().isIn(['all', 'free', 'premium']).withMessage('Invalid notification audience'),
], validateRequest, sendNotification);

export default router;
