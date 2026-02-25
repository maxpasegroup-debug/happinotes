import { Router } from 'express';
import authRoutes from './authRoutes';
import booksRoutes from './booksRoutes';
import collectionRoutes from './collectionRoutes';
import subscriptionRoutes from './subscriptionRoutes';
import adminRoutes from './adminRoutes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/books', booksRoutes);
router.use('/collection', collectionRoutes);
router.use('/subscription', subscriptionRoutes);
router.use('/admin', adminRoutes);

export default router;
