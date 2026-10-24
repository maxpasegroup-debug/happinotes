import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { createHash } from 'crypto';
import { Content, User } from '../models';
import { StorePurchase } from '../models/StorePurchase';
import { authenticate } from '../middleware';
import { accountToken, verifyStorePurchase, Store } from '../services/storePurchase';
import { databaseProductMapping } from '../services/storeProductProvisioning';
import { BadRequestError, ForbiddenError, AppError } from '../utils/errors';
import { ensureSubscriptionPlans } from '../services/subscriptionPlans';
import { SubscriptionPurchase } from '../models/SubscriptionPurchase';
import { verifySubscriptionPurchase } from '../services/subscriptionPurchase';
import { applySubscriptionEntitlement } from '../services/subscriptionEntitlement';
import { assertAccountWritable } from '../services/accountDeletion';
import { resolveSubscriptionPlanForStoreProduct } from '../services/subscriptionProductMapping';

const router = Router();
router.use(authenticate);
router.use(rateLimit({ windowMs: 60000, limit: 30 }));

router.get('/subscription-plans', async (req, res, next) => {
  try {
    // Prices can be changed from the admin panel at any time. Do not let a
    // browser, proxy, or mobile HTTP cache keep returning an older plan.
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    const plans = await ensureSubscriptionPlans();
    res.json({ success: true, accountToken: accountToken(String(req.user!._id)), plans: plans.filter((plan) => plan.active) });
  } catch (error) { next(error); }
});

router.post('/subscription-verify', async (req, res, next) => {
  try {
    await assertAccountWritable(req.user!._id);
    const { store, productId, verificationData, transactionId, restore } = req.body ?? {};
    if (!['android', 'ios'].includes(store) || typeof productId !== 'string' || productId.length > 200) {
      throw new BadRequestError('A valid store and subscription productId are required');
    }
    const proof = store === 'android' ? verificationData : transactionId;
    if (typeof proof !== 'string' || !proof || proof.length > 10000) {
      throw new BadRequestError('Subscription verification data is required');
    }
    const plans = await ensureSubscriptionPlans();
    let plan = resolveSubscriptionPlanForStoreProduct(plans, store, productId);
    if (!plan && restore === true) {
      // Legacy shared IDs can only be resolved for this authenticated user when
      // a persisted ledger claim already links that exact store/product/plan.
      const legacyClaim = await SubscriptionPurchase.findOne({
        store, userId: req.user!._id, productId,
      }).select('store productId planKey');
      plan = resolveSubscriptionPlanForStoreProduct(plans, store, productId, legacyClaim);
    }
    if (!plan) throw new BadRequestError('Unknown subscription plan');
    const expectedAccount = accountToken(String(req.user!._id));
    // Play may omit the obfuscated account identifier for an older purchase.
    // Only an explicit restore of a transaction already owned by this user may
    // use that compatibility path. Unknown transactions still require a
    // matching account identifier, and a mismatched identifier never bypasses.
    const allowUnboundAccount = store === 'android' && restore === true
      ? Boolean(await SubscriptionPurchase.exists({
        store: 'android',
        transactionKey: createHash('sha256').update(proof).digest('hex'),
        userId: req.user!._id,
        productId,
      }))
      : false;
    const verified = await verifySubscriptionPurchase(
      store as Store, plan.key, productId, proof, expectedAccount, { allowUnboundAccount },
    );
    await assertAccountWritable(req.user!._id);
    await SubscriptionPurchase.init();
    let claim;
    try {
      claim = await SubscriptionPurchase.findOneAndUpdate(
        { store, transactionKey: verified.transactionKey },
        { $setOnInsert: { userId: req.user!._id, planKey: plan.key, productId, store } },
        { upsert: true, new: true },
      );
    } catch (error) {
      if ((error as { code?: number }).code !== 11000) throw error;
      claim = await SubscriptionPurchase.findOne({ store, transactionKey: verified.transactionKey });
    }
    if (!claim || String(claim.userId) !== String(req.user!._id) || claim.productId !== productId) {
      throw new ForbiddenError('This subscription is linked to another account');
    }
    await assertAccountWritable(req.user!._id);
    const stateFilter: Record<string, unknown> = { _id: claim._id };
    if (verified.providerStateSignedAt) stateFilter.$or = [
      { providerStateSignedAt: { $lte: verified.providerStateSignedAt } },
      { providerStateSignedAt: { $exists: false } },
    ];
    const stateWrite = await SubscriptionPurchase.updateOne(stateFilter, { $set: {
      active: verified.active, expiresAt: verified.expiresAt, autoRenewing: verified.autoRenewing,
      ...(verified.providerStateSignedAt ? { providerStateSignedAt: verified.providerStateSignedAt } : {}),
    } });
    const stateWriteResult = stateWrite as unknown as { matchedCount?: number; n?: number } | undefined;
    if (verified.providerStateSignedAt && stateWriteResult &&
        (stateWriteResult.matchedCount ?? stateWriteResult.n ?? 0) === 0) {
      const currentUser = await User.findById(req.user!._id).select('subscription');
      const current = currentUser?.subscription;
      const currentActive = current?.active === true &&
        Boolean(!current.expiresAt || current.expiresAt.getTime() > Date.now());
      res.json({ success: true, subscriptionActive: currentActive,
        subscriptionPlan: current?.planKey ?? plan.key,
        subscriptionExpiresAt: current?.expiresAt ?? null });
      return;
    }
    await applySubscriptionEntitlement(req.user!._id, {
        store, planKey: plan.key, productId, transactionKey: verified.transactionKey,
        active: verified.active, expiresAt: verified.expiresAt, autoRenewing: verified.autoRenewing,
        providerStateSignedAt: verified.providerStateSignedAt,
        lastVerifiedAt: new Date(),
    });
    // Return the currently stored entitlement. A stale verification request
    // must not make the client believe a newer entitlement was downgraded.
    const currentUser = await User.findById(req.user!._id).select('subscription');
    const current = currentUser?.subscription;
    const currentActive = current?.active === true &&
      Boolean(!current.expiresAt || current.expiresAt.getTime() > Date.now());
    res.json({ success: true, subscriptionActive: currentActive,
      subscriptionPlan: current?.planKey ?? plan.key,
      subscriptionExpiresAt: current?.expiresAt ?? null });
  } catch (error) {
    next(error instanceof AppError ? error : new AppError('Could not verify subscription. Please restore purchases to retry.', 503));
  }
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
    await assertAccountWritable(req.user!._id);
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
    await assertAccountWritable(req.user!._id);
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
    await assertAccountWritable(req.user!._id);
    await StorePurchase.updateOne({ _id: claim._id }, { $set: { active: true } });
    // Idempotent and retryable even if a previous request stopped after recording the claim.
    await User.updateOne({
      _id: req.user!._id,
      $or: [{ deletionState: 'active' }, { deletionState: { $exists: false } }],
    }, { $addToSet: { purchasedBooks: bookId } });
    const user = await User.findById(req.user!._id).select('purchasedBooks');
    res.json({ success: true, bookId, purchasedBookIds: user!.purchasedBooks.map(String) });
  } catch (error) {
    // Provider errors can contain purchase tokens or credentials; never return those to clients.
    next(error instanceof AppError ? error : new AppError('Could not verify purchase. Please restore purchases to retry.', 503));
  }
});

export default router;
