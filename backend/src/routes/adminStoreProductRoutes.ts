import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate, requireAdmin } from '../middleware';
import { StoreProduct } from '../models/StoreProduct';
import { migrateLegacyMappings, stableProductId } from '../services/storeProductProvisioning';
import { BadRequestError, NotFoundError } from '../utils/errors';

const router = Router();
router.use(authenticate, requireAdmin);
router.use(rateLimit({ windowMs: 60000, limit: 30 }));
router.post('/migrate', async (_req, res, next) => {
  try { res.json({ success: true, migrated: await migrateLegacyMappings() }); }
  catch (error) { next(error); }
});
router.get('/:bookId', async (req, res, next) => {
  try {
    stableProductId(req.params.bookId);
    const product = await StoreProduct.findOne({ bookId: req.params.bookId }).select('-android.leaseOwner -ios.leaseOwner').lean();
    if (!product) throw new NotFoundError('Store product mapping not found');
    res.json({ success: true, product });
  } catch (error) { next(error); }
});
router.post('/:bookId/retry', async (_req, _res, next) => {
  try {
    throw new BadRequestError('Individual book purchase provisioning is retired; Premium access uses monthly subscriptions');
  } catch (error) { next(error); }
});
export default router;
