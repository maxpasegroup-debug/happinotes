import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { Content, User } from '../models';
import { StorePurchase } from '../models/StorePurchase';
import { authenticate } from '../middleware';
import { accountToken, verifyStorePurchase, Store } from '../services/storePurchase';
import { databaseProductMapping } from '../services/storeProductProvisioning';
import { BadRequestError, ForbiddenError, AppError } from '../utils/errors';
import { ensureSubscriptionPlans } from '../services/subscriptionPlans';

const router = Router();
router.use(authenticate);
router.use(rateLimit({ windowMs: 60000, limit: 30 }));

// Subscription settings are shared by the monthly and yearly plans. Purchase
// verification is still handled by the existing one-time product flow until
// the subscription checkout is enabled in the mobile client.
router.get('/subscription-plans', async (_req, res, next) => {
  try {
    const plans = await ensureSubscriptionPlans();
    res.json({ success: true, plans: plans.filter((plan) => plan.active) });
  } catch (error) { next(error); }
});

router.get('/products', async (req, res, next) => {
  try {
    const mapping = await databaseProductMapping(true);
    const books = await Content.find({ _id: { $in: Object.keys(mapping) }, contentType: 'lifebook', status: 'live',
      $or: [{ type: 'premium' }, { priceInr: { $gt: 0 } }] }).select('_id');
    res.json({ accountToken: accountToken(String(req.user!._id)),
      products: books.map((book) => ({ bookId: book.id, ...mapping[book.id] })) });
  } catch (error) { next(error); }
});

router.post('/verify', async (req, res, next) => {
  try {
    const { store, productId, verificationData, transactionId } = req.body ?? {};
    if (!['android', 'ios'].includes(store) || typeof productId !== 'string' || productId.length > 200) {
      throw new BadRequestError('A valid store and productId are required');
    }
    const proof = store === 'android' ? verificationData : transactionId;
    if (typeof proof !== 'string' || !proof || proof.length > 10000) {
      throw new BadRequestError('Purchase verification data is required');
    }
    const bookId = Object.entries(await databaseProductMapping()).find(([, ids]) => ids[store as Store] === productId)?.[0];
    if (!bookId) throw new BadRequestError('Unknown store product');
    // Historical mapped transactions remain verifiable after unpublishing or making a book free.
    const book = await Content.findOne({ _id: bookId, contentType: 'lifebook' });
    if (!book) throw new BadRequestError('Book no longer exists');
    const verified = await verifyStorePurchase(store, productId, proof, accountToken(String(req.user!._id)));
    // Initialize the unique index before the first claim; simultaneous retries cannot transfer ownership.
    await StorePurchase.init();
    let claim;
    try {
      claim = await StorePurchase.findOneAndUpdate(
        { store, transactionKey: verified.transactionKey },
        { $setOnInsert: { userId: req.user!._id, bookId, productId } },
        { upsert: true, new: true },
      );
    } catch (error) {
      if ((error as { code?: number }).code !== 11000) throw error;
      claim = await StorePurchase.findOne({ store, transactionKey: verified.transactionKey });
    }
    if (!claim || String(claim.userId) !== String(req.user!._id) || String(claim.bookId) !== bookId) {
      throw new ForbiddenError('This purchase is linked to another account');
    }
    await StorePurchase.updateOne({ _id: claim._id }, { $set: { active: true } });
    // Idempotent and retryable even if a previous request stopped after recording the claim.
    await User.updateOne({ _id: req.user!._id }, { $addToSet: { purchasedBooks: bookId } });
    const user = await User.findById(req.user!._id).select('purchasedBooks');
    res.json({ success: true, bookId, purchasedBookIds: user!.purchasedBooks.map(String) });
  } catch (error) {
    // Provider errors can contain purchase tokens or credentials; never return those to clients.
    next(error instanceof AppError ? error : new AppError('Could not verify purchase. Please restore purchases to retry.', 503));
  }
});

export default router;
