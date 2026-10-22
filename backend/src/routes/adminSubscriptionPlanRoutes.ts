import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware';
import { AppError, BadRequestError, NotFoundError } from '../utils/errors';
import { ensureSubscriptionPlans } from '../services/subscriptionPlans';
import { SubscriptionPlan, SubscriptionPlanKey } from '../models/SubscriptionPlan';
import { syncGoogleSubscriptionPlan } from '../services/googleSubscriptionCatalog';
import { emitSubscriptionPlansChanged } from '../services/realtime';

const router = Router();
router.use(authenticate, requireAdmin);

router.get('/', async (_req, res, next) => {
  try {
    res.json({ success: true, plans: await ensureSubscriptionPlans() });
  } catch (error) { next(error); }
});

router.patch('/:key', async (req, res, next) => {
  try {
    const key = req.params.key as SubscriptionPlanKey;
    if (key !== 'monthly' && key !== 'yearly') throw new BadRequestError('Plan must be monthly or yearly');
    const priceInr = Number(req.body?.priceInr);
    if (!Number.isFinite(priceInr) || priceInr <= 0 || Math.round(priceInr * 100) !== priceInr * 100) {
      throw new BadRequestError('priceInr must be a positive amount with at most two decimals');
    }
    await ensureSubscriptionPlans();
    const plan = await SubscriptionPlan.findOneAndUpdate(
      { key }, { $set: { priceInr } }, { new: true, runValidators: true },
    ).lean();
    if (!plan) throw new NotFoundError('Subscription plan not found');

    // The database value is available to the mobile app immediately. Emit
    // after the write (and before the potentially slower Play sync) so an open
    // app reloads the backend price without waiting for a page/app refresh.
    emitSubscriptionPlansChanged(key);

    // Persist the admin's price before contacting Google Play. This keeps the
    // mobile app's backend price display working even when Play synchronization
    // is temporarily unavailable or the service account needs attention.
    try {
      await syncGoogleSubscriptionPlan({
        productId: plan.productId,
        basePlanId: key,
        billingPeriod: plan.billingPeriod,
        priceInr,
      });
      console.info('[Subscriptions] Google Play plan synced', { key, priceInr });
      res.json({ success: true, plan, googlePlaySync: 'synced' });
    } catch (error) {
      const warning = error instanceof AppError
        ? error.message
        : 'Google Play synchronization failed; retry it before accepting purchases.';
      console.error('[Subscriptions] Price saved but Google Play plan sync failed', { key, priceInr, warning });
      res.json({ success: true, plan, googlePlaySync: 'failed', warning });
    }
  } catch (error) { next(error); }
});

export default router;
