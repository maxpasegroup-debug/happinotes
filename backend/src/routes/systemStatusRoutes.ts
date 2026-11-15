import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate, requireAdmin } from '../middleware';
import { collectSystemSample, systemSnapshot } from '../services/systemMetrics';
import { railwayDeployments, railwayLogs, railwayMetrics } from '../services/railwayStatus';
import { BadRequestError } from '../utils/errors';
const router = Router();
router.use(authenticate, requireAdmin);
router.use(rateLimit({ windowMs: 60_000, max: 120, standardHeaders: true, legacyHeaders: false }));
router.use((_req, res, next) => { res.setHeader('Cache-Control', 'private, no-store'); next(); });
router.get('/', async (_req, res, next) => {
  try { if (!systemSnapshot().sampledAt) await collectSystemSample(); res.json(systemSnapshot()); } catch (error) { next(error); }
});
router.get('/deployments', async (_req, res, next) => { try { res.json(await railwayDeployments()); } catch (error) { next(error); } });
router.get('/infrastructure', async (_req, res, next) => { try { res.json(await railwayMetrics()); } catch (error) { next(error); } });
router.get('/logs', async (req, res, next) => {
  try {
    const { deploymentId, kind = 'build' } = req.query;
    if (typeof deploymentId !== 'string' || !/^[a-zA-Z0-9-]{1,100}$/.test(deploymentId) || (kind !== 'build' && kind !== 'runtime')) throw new BadRequestError('Choose a deployment and log type.');
    res.json(await railwayLogs(deploymentId, kind));
  } catch (error) { next(error); }
});
export default router;
