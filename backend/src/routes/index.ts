import { Router } from 'express';
import authRoutes from './authRoutes';
import contentRoutes from './contentRoutes';
import collectionRoutes from './collectionRoutes';
import adminRoutes from './adminRoutes';
import adminContentRoutes from './adminContentRoutes';
import favouritesRoutes from './favouritesRoutes';
import { authenticate } from '../middleware';

const router = Router();

router.use('/auth', authRoutes);
router.use('/contents', contentRoutes);
router.use('/collection', collectionRoutes);
router.use('/admin', adminRoutes);
router.use('/admin/contents', adminContentRoutes);
router.use('/favourites', authenticate, favouritesRoutes);

export default router;
