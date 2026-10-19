import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware';
import { BadRequestError, NotFoundError } from '../utils/errors';
import { ensureSubscriptionPlans } from '../services/subscriptionPlans';
import { SubscriptionPlan, SubscriptionPlanKey } from '../models/SubscriptionPlan';

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
    if (!Number.isFinite(priceInr) || priceInr < 0 || Math.round(priceInr * 100) !== priceInr * 100) {
      throw new BadRequestError('priceInr must be a non-negative amount with at most two decimals');
    }
    await ensureSubscriptionPlans();
    const plan = await SubscriptionPlan.findOneAndUpdate(
      { key }, { $set: { priceInr } }, { new: true, runValidators: true },
    ).lean();
    if (!plan) throw new NotFoundError('Subscription plan not found');
    res.json({ success: true, plan });
  } catch (error) { next(error); }
});

export default router;
