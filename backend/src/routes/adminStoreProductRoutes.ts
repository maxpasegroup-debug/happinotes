import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate, requireAdmin } from '../middleware';
import { Content } from '../models';
import { StoreProduct } from '../models/StoreProduct';
import { ensureBookProducts, migrateLegacyMappings, retryBookProvisioning, stableProductId } from '../services/storeProductProvisioning';
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
router.post('/:bookId/retry', async (req, res, next) => {
  try {
    stableProductId(req.params.bookId);
    const store = req.body?.store;
    if (store !== undefined && store !== 'android' && store !== 'ios') throw new BadRequestError('store must be android or ios');
    const book = await Content.findById(req.params.bookId);
    if (!book) throw new NotFoundError('Book not found');
    const existing = await StoreProduct.findOne({ bookId: book.id });
    if (!existing && !await ensureBookProducts(book)) throw new BadRequestError('Book is not premium');
    await retryBookProvisioning(book.id, store);
    res.status(202).json({ success: true, message: 'Provisioning queued; ready and legacy products are preserved' });
  } catch (error) { next(error); }
});
export default router;
