import { Router } from 'express';
import authRoutes from './authRoutes';
import contentRoutes from './contentRoutes';
import collectionRoutes from './collectionRoutes';
import adminRoutes from './adminRoutes';
import adminContentRoutes from './adminContentRoutes';
import favouritesRoutes from './favouritesRoutes';
import testPurchaseRoutes from './testPurchaseRoutes';
import notificationRoutes from './notificationRoutes';
import storePurchaseRoutes from './storePurchaseRoutes';
import storeNotificationRoutes from './storeNotificationRoutes';
import adminStoreProductRoutes from './adminStoreProductRoutes';
import adminSubscriptionPlanRoutes from './adminSubscriptionPlanRoutes';
import { authenticate } from '../middleware';

const router = Router();

router.use('/auth', authRoutes);
router.use('/contents', contentRoutes);
router.use('/collection', collectionRoutes);
router.use('/admin', adminRoutes);
router.use('/admin/store-products', adminStoreProductRoutes);
router.use('/admin/subscription-plans', adminSubscriptionPlanRoutes);
router.use('/admin/contents', adminContentRoutes);
router.use('/favourites', authenticate, favouritesRoutes);
router.use('/payments/test', testPurchaseRoutes);
router.use('/payments/store', storePurchaseRoutes);
router.use('/payments/notifications', storeNotificationRoutes);
router.use('/notifications', authenticate, notificationRoutes);

export default router;
