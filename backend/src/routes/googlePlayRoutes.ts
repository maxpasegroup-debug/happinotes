import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate, requireAdmin } from '../middleware';
import { BadRequestError } from '../utils/errors';
import {
  getAnalytics,
  getApp,
  getApps,
  getConnectionStatus,
  getOverview,
  getReleases,
  getReviews,
  syncGooglePlay,
} from '../services/googlePlayConsole';

const router = Router();
router.use(authenticate, requireAdmin);
router.use(rateLimit({ windowMs: 60_000, max: 120, standardHeaders: true, legacyHeaders: false }));
router.use((_req, res, next) => { res.setHeader('Cache-Control', 'private, no-store'); next(); });

function packageName(req: { params: { packageName?: string } }): string {
  const value = req.params.packageName;
  if (!value) throw new BadRequestError('Package name is required.');
  return value;
}

router.get('/sync-status', async (_req, res, next) => {
  try { res.json(await getConnectionStatus()); } catch (error) { next(error); }
});

router.post('/sync', async (_req, res, next) => {
  try { res.json(await syncGooglePlay()); } catch (error) { next(error); }
});

router.get('/overview', async (_req, res, next) => {
  try { res.json(await getOverview()); } catch (error) { next(error); }
});

router.get('/apps', async (_req, res, next) => {
  try { res.json({ apps: await getApps() }); } catch (error) { next(error); }
});

router.get('/apps/:packageName', async (req, res, next) => {
  try { res.json(await getApp(packageName(req))); } catch (error) { next(error); }
});

router.get('/apps/:packageName/releases', async (req, res, next) => {
  try { res.json(await getReleases(packageName(req))); } catch (error) { next(error); }
});

router.get('/apps/:packageName/tracks', async (req, res, next) => {
  try { res.json(await getReleases(packageName(req))); } catch (error) { next(error); }
});

router.get('/apps/:packageName/reviews', async (req, res, next) => {
  try {
    const starRating = typeof req.query.starRating === 'string' ? Number(req.query.starRating) : undefined;
    if (starRating !== undefined && (!Number.isInteger(starRating) || starRating < 1 || starRating > 5)) throw new BadRequestError('Star rating must be between 1 and 5.');
    const maxResults = typeof req.query.maxResults === 'string' ? Number(req.query.maxResults) : undefined;
    if (maxResults !== undefined && (!Number.isInteger(maxResults) || maxResults < 1 || maxResults > 100)) throw new BadRequestError('Review page size must be between 1 and 100.');
    res.json(await getReviews(packageName(req), {
      pageToken: typeof req.query.pageToken === 'string' ? req.query.pageToken : undefined,
      maxResults,
      starRating,
      search: typeof req.query.search === 'string' ? req.query.search.slice(0, 120) : undefined,
    }));
  } catch (error) { next(error); }
});

router.get('/apps/:packageName/analytics', async (req, res, next) => {
  try { res.json(await getAnalytics(packageName(req))); } catch (error) { next(error); }
});

export default router;
