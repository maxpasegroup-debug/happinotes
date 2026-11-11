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
import storeNotificationOpsRoutes from './storeNotificationOpsRoutes';
import adminStoreProductRoutes from './adminStoreProductRoutes';
import adminSubscriptionPlanRoutes from './adminSubscriptionPlanRoutes';
import accountDeletionRoutes from './accountDeletionRoutes';
import happyBiteRoutes from './happyBiteRoutes';
import adminHappyBiteRoutes from './adminHappyBiteRoutes';
import { authenticate } from '../middleware';

const router = Router();

router.use('/auth', authRoutes);
router.use('/account-deletion', accountDeletionRoutes);
router.use('/contents', contentRoutes);
router.use('/happy-bites', happyBiteRoutes);
router.use('/collection', collectionRoutes);
router.use('/admin', adminRoutes);
router.use('/admin/store-products', adminStoreProductRoutes);
router.use('/admin/subscription-plans', adminSubscriptionPlanRoutes);
router.use('/admin/contents', adminContentRoutes);
router.use('/admin/happy-bites', adminHappyBiteRoutes);
router.use('/favourites', authenticate, favouritesRoutes);
router.use('/payments/test', testPurchaseRoutes);
router.use('/payments/store', storePurchaseRoutes);
router.use('/payments/notifications', storeNotificationRoutes);
router.use('/internal/store-notification-inbox', storeNotificationOpsRoutes);
router.use('/notifications', authenticate, notificationRoutes);

export default router;
