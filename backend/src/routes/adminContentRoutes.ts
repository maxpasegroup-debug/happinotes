import { Router } from 'express';
import { body } from 'express-validator';
import {
  getAllContents,
  createContent,
  updateContent,
  deleteContent,
  updateContentStatus,
} from '../controllers/adminContentController';
import { authenticate, requireAdmin } from '../middleware';
import { upload } from '../middleware/upload';

const router = Router();

router.use(authenticate);
router.use(requireAdmin);

const createLifebookValidation = [
  body('contentType')
    .equals('lifebook')
    .withMessage('contentType must be lifebook'),
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('description').optional().trim(),
  body('language').trim().notEmpty().withMessage('language is required'),
  body('type')
    .isIn(['free', 'premium'])
    .withMessage('type must be free or premium'),
  body('intro').exists().withMessage('intro is required'),
  body('conclusion').exists().withMessage('conclusion is required'),
  body('lessons').isArray().withMessage('lessons must be an array'),
];

const updateLifebookValidation = [
  body('title').optional().trim().notEmpty(),
  body('description').optional().trim(),
  body('language').optional().trim(),
  body('type')
    .optional()
    .isIn(['free', 'premium'])
    .withMessage('Invalid type'),
  body('intro').optional(),
  body('conclusion').optional(),
  body('lessons').optional().isArray(),
];

const updateStatusValidation = [
  body('status')
    .isIn(['draft', 'coming_soon', 'live'])
    .withMessage('status must be draft, coming_soon, or live'),
];

router.get('/', getAllContents);
router.post(
  '/',
  upload.fields([
    { name: 'thumbnail', maxCount: 1 },
    { name: 'introMedia', maxCount: 1 },
    { name: 'lessonMedia', maxCount: 50 },
    { name: 'conclusionMedia', maxCount: 1 },
    { name: 'media', maxCount: 1 },
  ]),
  createLifebookValidation,
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
  updateLifebookValidation,
  updateContent
);
router.delete('/:id', deleteContent);
router.patch('/:id/status', updateStatusValidation, updateContentStatus);

export default router;

