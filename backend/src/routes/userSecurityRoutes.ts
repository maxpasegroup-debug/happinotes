import { moderateIp } from '../controllers/vpnSecurityController';
import { Router } from 'express';
import multer from 'multer';
import { AppError, BadRequestError } from '../utils/errors';
import rateLimit from 'express-rate-limit';
import { authenticate, requireAdmin } from '../middleware';
import { listUserSecurity, emailUser, signOutUser, moderateUser, eraseUserAccount, deleteUserAccount, getDeviceReference, saveDeviceReference } from '../controllers/userSecurityController';
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
const readEmailImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1, fields: 4, parts: 6, fieldSize: 80000 },
}).single('image');
router.post('/:id/email', mutations, (req, res, next) => {
  readEmailImage(req, res, error => {
    if (!error) return next();
    if (error.code === 'LIMIT_FILE_SIZE') return next(new AppError('Choose an image up to 2 MB.', 413));
    return next(new BadRequestError('Could not read the email. Attach one JPEG or PNG and try again.'));
  });
}, emailUser);
router.post('/:id/logout', mutations, signOutUser);
router.patch('/:id/ban', mutations, moderateUser);
router.delete('/:id/personal-data', mutations, eraseUserAccount);
router.delete('/:id', mutations, deleteUserAccount);
export default router;
