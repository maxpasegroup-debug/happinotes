import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import { authenticate, requireAdmin } from '../middleware';
import { requireStoreNotificationOps } from '../middleware/storeNotificationOps';
import { auditStoreNotificationOps } from '../middleware/auditStoreNotificationOps';
import { StoreNotificationInbox } from '../models/StoreNotificationInbox';
import { BadRequestError, NotFoundError } from '../utils/errors';

const router = Router();
let rateLimitedCount = 0;
let lastRateLimitSignalAt = 0;
router.use(rateLimit({
  windowMs: 60_000,
  limit: 30,
  handler: (_req, res) => {
    rateLimitedCount += 1;
    const now = Date.now();
    if (now - lastRateLimitSignalAt >= 60_000) {
      console.warn('store_notification_ops_rate_limited', { count: rateLimitedCount });
      rateLimitedCount = 0;
      lastRateLimitSignalAt = now;
    }
    res.status(429).json({ success: false, message: 'Too many operational requests; retry later.' });
  },
}));
router.use(auditStoreNotificationOps, authenticate, requireAdmin, requireStoreNotificationOps);

// Restricted operational view. Provider lookup keys, snapshots, claim IDs,
// payloads, tokens, and user information are deliberately not returned.
router.get('/blocked', async (req, res, next) => {
  try {
    const parsed = Number(req.query.limit ?? 50);
    const limit = Number.isInteger(parsed) ? Math.min(Math.max(parsed, 1), 100) : 50;
    const events = await StoreNotificationInbox.find({ status: { $in: ['blocked', 'unmatched'] } })
      .select('_id provider providerEventId claimType productId eventType status failureCode attempts providerEventAt stateVersionAt nextAttemptAt createdAt updatedAt reviewActionCount lastReviewAt lastReviewAction')
      .sort({ updatedAt: -1 }).limit(limit).lean();
    res.json({ success: true, events });
  } catch (error) { next(error); }
});

router.post('/:id/retry', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) throw new BadRequestError('Invalid event reference');
    const row = await StoreNotificationInbox.findById(req.params.id).select('status failureCode claimId');
    if (!row) throw new NotFoundError('Notification event not found');
    if (!['blocked', 'unmatched'].includes(row.status) ||
        !['CLAIM_UNAVAILABLE', 'CLAIM_NOT_DETACHED', 'PROCESSING_FAILED'].includes(row.failureCode ?? '')) {
      throw new BadRequestError('This event is not eligible for operational retry');
    }
    const result = await StoreNotificationInbox.updateOne({ _id: row._id,
      status: row.status, failureCode: row.failureCode }, {
      $set: { status: row.claimId ? 'pending' : 'unmatched', nextAttemptAt: new Date(),
        lastReviewAt: new Date(), lastReviewAction: 'retry_requested' },
      $inc: { reviewActionCount: 1 },
      $unset: { failureCode: 1, processedAt: 1 },
    });
    if (!result.matchedCount) throw new BadRequestError('Event changed; reload the review list');
    res.status(202).json({ success: true, message: 'Event queued for safe reconciliation' });
  } catch (error) { next(error); }
});

router.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Operational endpoint not found.' });
});

export default router;
