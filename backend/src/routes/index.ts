import { Router } from 'express';
import authRoutes from './authRoutes';
import booksRoutes from './booksRoutes';
import collectionRoutes from './collectionRoutes';
import adminRoutes from './adminRoutes';
import progressRoutes from './progressRoutes';
import paymentsRoutes from './paymentsRoutes';
import offersRoutes from './offersRoutes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/books', booksRoutes);
router.use('/collection', collectionRoutes);
router.use('/progress', progressRoutes);
router.use('/payments', paymentsRoutes);
router.use('/offers', offersRoutes);
router.use('/admin', adminRoutes);

export default router;
