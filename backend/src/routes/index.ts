import { Router } from 'express';
import authRoutes from './authRoutes';
import booksRoutes from './booksRoutes';
import collectionRoutes from './collectionRoutes';
import adminRoutes from './adminRoutes';
import progressRoutes from './progressRoutes';
import subscriptionsRoutes from './subscriptionsRoutes';
import storeNotificationsRoutes from './storeNotificationsRoutes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/books', booksRoutes);
router.use('/collection', collectionRoutes);
router.use('/progress', progressRoutes);
router.use('/subscriptions', subscriptionsRoutes);
router.use('/store-notifications', storeNotificationsRoutes);
router.use('/admin', adminRoutes);

export default router;
