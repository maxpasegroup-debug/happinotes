import { Router } from 'express';
import { body } from 'express-validator';
import {
  getAllContents,
  createContent,
  updateContent,
  deleteContent,
  updateContentStatus,
  featureContent,
  unfeatureContent,
  uploadContentMedia,
} from '../controllers/adminContentController';
import { authenticate, requireAdmin } from '../middleware';
import { upload } from '../middleware/upload';

const router = Router();

router.use(authenticate);
router.use(requireAdmin);

const createContentValidation = [
  body('contentType')
    .isIn(['lifebook', 'note', 'silence', 'happiness'])
    .withMessage('contentType must be lifebook, note, or silence'),
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('description').optional().trim(),
  body('language').trim().notEmpty().withMessage('language is required'),
  body('type')
    .isIn(['free', 'premium'])
    .withMessage('type must be free or premium'),
  body('webDisplayOrder').optional().isInt({ min: 0 }),
  body('mobileDisplayOrder').optional().isInt({ min: 0 }),
];

const updateContentValidation = [
  body('contentType')
    .optional()
    .isIn(['lifebook', 'note', 'silence', 'happiness'])
    .withMessage('contentType must be lifebook, note, or silence'),
  body('title').optional().trim().notEmpty(),
  body('description').optional().trim(),
  body('language').optional().trim(),
  body('type')
    .optional()
    .isIn(['free', 'premium'])
    .withMessage('Invalid type'),
  body('webDisplayOrder').optional().isInt({ min: 0 }),
  body('mobileDisplayOrder').optional().isInt({ min: 0 }),
  body('intro').optional(),
  body('conclusion').optional(),
  body('lessons')
    .optional()
    .custom((value) => {
      if (Array.isArray(value)) return true;
      if (typeof value === 'string') {
        try {
          const parsed = JSON.parse(value);
          return Array.isArray(parsed);
        } catch {
          return false;
        }
      }
      return false;
    })
    .withMessage('lessons must be an array or JSON array string'),
];

const updateStatusValidation = [
  body('status')
    .isIn(['draft', 'coming_soon', 'live'])
    .withMessage('status must be draft, coming_soon, or live'),
];

router.get('/', getAllContents);
router.post('/upload-media', upload.single('media'), uploadContentMedia);
router.post(
  '/',
  upload.fields([
    { name: 'thumbnail', maxCount: 1 },
    { name: 'introMedia', maxCount: 1 },
    { name: 'lessonMedia', maxCount: 50 },
    { name: 'conclusionMedia', maxCount: 1 },
    { name: 'media', maxCount: 1 },
  ]),
  createContentValidation,
  createContent
);
router.put(
  '/:id',
  upload.fields([
    { name: 'thumbnail', maxCount: 1 },
    { name: 'introMedia', maxCount: 1 },
    { name: 'lessonMedia', maxCount: 50 },
    { name: 'conclusionMedia', maxCount: 1 },
    { name: 'media', maxCount: 1 },
  ]),
  updateContentValidation,
  updateContent
);
router.delete('/:id', deleteContent);
router.patch('/:id/status', updateStatusValidation, updateContentStatus);
router.patch('/:id/feature', featureContent);
router.patch('/:id/unfeature', unfeatureContent);

export default router;

