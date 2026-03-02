import { Router } from 'express';
import authRoutes from './authRoutes';
import contentRoutes from './contentRoutes';
import collectionRoutes from './collectionRoutes';
import subscriptionRoutes from './subscriptionRoutes';
import adminRoutes from './adminRoutes';
import adminContentRoutes from './adminContentRoutes';
import paymentsRoutes from './paymentsRoutes';
import favouritesRoutes from './favouritesRoutes';
import { authenticate } from '../middleware';

const router = Router();

router.use('/auth', authRoutes);
router.use('/contents', contentRoutes);
router.use('/collection', collectionRoutes);
router.use('/subscription', subscriptionRoutes);
router.use('/admin', adminRoutes);
router.use('/admin/contents', adminContentRoutes);
router.use('/payments', paymentsRoutes);
router.use('/favourites', authenticate, favouritesRoutes);

export default router;
