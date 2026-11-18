import { moderateIp } from '../controllers/vpnSecurityController';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate, requireAdmin } from '../middleware';
import { listUserSecurity, moderateUser, deleteUserAccount, getDeviceReference, saveDeviceReference } from '../controllers/userSecurityController';
import { collectPacketTelemetry } from '../services/packetTelemetry';
const router = Router();
router.use(authenticate, requireAdmin);
router.get('/', listUserSecurity);
router.get('/packet-telemetry', rateLimit({ windowMs: 60_000, max: 6, standardHeaders: true, legacyHeaders: false }), async (_req, res, next) => {
  try { res.setHeader('Cache-Control', 'private, no-store'); res.json(await collectPacketTelemetry()); } catch (error) { next(error); }
});
const mutations = rateLimit({ windowMs: 60_000, max: 30, standardHeaders: true, legacyHeaders: false });
router.get('/:id/device-reference', getDeviceReference);
router.put('/:id/device-reference', rateLimit({ windowMs: 60_000, max: 120, standardHeaders: true, legacyHeaders: false }), saveDeviceReference);
router.put('/:id/ip-ban', mutations, moderateIp);
router.patch('/:id/ban', mutations, moderateUser);
router.delete('/:id', mutations, deleteUserAccount);
export default router;
