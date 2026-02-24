import { Router } from 'express';
import { body } from 'express-validator';
import {
  getUsers,
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
  body('description').optional().trim(),
  body('coverImage').optional().trim(),
  body('audioUrl').optional().trim(),
  body('status').optional().isIn(['upcoming', 'live']).withMessage('Invalid status'),
  body('type').optional().isIn(['free', 'premium']).withMessage('Invalid type'),
];

router.get('/users', getUsers);
router.post('/books', bookValidation, createBook);
router.put('/books/:id', bookValidation, updateBook);
router.delete('/books/:id', deleteBook);

export default router;
