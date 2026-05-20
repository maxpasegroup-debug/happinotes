import { Router } from 'express';
import { body } from 'express-validator';
import {
  addChapter,
  createOffer,
  deleteChapter,
  deleteOffer,
  deleteUser,
  getUsers,
  getAdminBooks,
  getAdminBookById,
  getOffers,
  getPayments,
  getStats,
  getUserById,
  createBook,
  updateBook,
  deleteBook,
  updateOffer,
  updateChapter,
  updateUserSubscription,
} from '../controllers/adminController';
import { authenticate, requireAdmin } from '../middleware';
import { sendNotification } from '../controllers/notificationsController';

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

const offerValidation = [
  body('code').optional().trim(),
  body('discountPercent')
    .isFloat({ min: 1, max: 100 })
    .withMessage('Discount must be between 1 and 100'),
  body('validFrom').isISO8601().withMessage('Valid start date is required'),
  body('validUntil').isISO8601().withMessage('Valid end date is required'),
  body('isActive').optional().isBoolean(),
  body('appliesToPlan')
    .optional()
    .isIn(['monthly', 'yearly', 'lifetime', 'all'])
    .withMessage('Invalid plan target'),
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
router.post('/books', bookValidation, createBook);
router.put('/books/:id', bookValidation, updateBook);
router.delete('/books/:id', deleteBook);
router.post('/books/:id/chapters', chapterValidation, addChapter);
router.put('/chapters/:id', chapterValidation, updateChapter);
router.delete('/chapters/:id', deleteChapter);
router.get('/payments', getPayments);
router.get('/offers', getOffers);
router.post('/offers', offerValidation, createOffer);
router.put('/offers/:id', offerValidation, updateOffer);
router.delete('/offers/:id', deleteOffer);
router.post('/notify', sendNotification);

export default router;
