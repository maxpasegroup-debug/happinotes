import { timingSafeEqual } from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { ForbiddenError } from '../utils/errors';

/** Additional fail-closed shared-secret gate for the restricted inbox tooling. */
export function requireStoreNotificationOps(req: Request, _res: Response, next: NextFunction): void {
  const expected = process.env.STORE_NOTIFICATION_OPS_KEY;
  const supplied = req.headers['x-store-notification-ops-key'];
  if (!expected || Buffer.byteLength(expected, 'utf8') < 32 || typeof supplied !== 'string') {
    return next(new ForbiddenError('Restricted operations access required'));
  }
  const expectedBytes = Buffer.from(expected, 'utf8');
  const suppliedBytes = Buffer.from(supplied, 'utf8');
  if (expectedBytes.length !== suppliedBytes.length || !timingSafeEqual(expectedBytes, suppliedBytes)) {
    return next(new ForbiddenError('Restricted operations access required'));
  }
  next();
}
