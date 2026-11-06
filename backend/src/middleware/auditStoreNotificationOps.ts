import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { StoreNotificationOpsAudit, StoreNotificationOpsAction } from '../models/StoreNotificationOpsAudit';
import { AppError } from '../utils/errors';

let lastAuditSignalAt = 0;
let pendingAuditSignals: Record<string, number> = {};

function signalAuditFailure(kind: 'start_failed' | 'outcome_failed'): void {
  pendingAuditSignals[kind] = (pendingAuditSignals[kind] ?? 0) + 1;
  const now = Date.now();
  if (now - lastAuditSignalAt < 60_000) return;
  console.error('store_notification_ops_audit_signal', pendingAuditSignals);
  pendingAuditSignals = {};
  lastAuditSignalAt = now;
}

function actionFor(req: Request): StoreNotificationOpsAction {
  if (req.method === 'GET' && req.path === '/blocked') return 'list_blocked';
  if (req.method === 'POST' && /^\/[^/]+\/retry$/.test(req.path)) return 'retry';
  return 'other';
}

/** Persist an attempt before access checks; never record headers, body or URL IDs. */
export async function auditStoreNotificationOps(req: Request, res: Response, next: NextFunction): Promise<void> {
  let auditId: Types.ObjectId;
  try {
    const audit = await StoreNotificationOpsAudit.create({ action: actionFor(req), outcome: 'started' });
    auditId = audit._id;
  } catch {
    // Fail closed: a restricted operation must not proceed without an audit record.
    signalAuditFailure('start_failed');
    next(new AppError('Operational audit is unavailable; retry later.', 503));
    return;
  }

  const originalJson = res.json.bind(res);
  let finalizing = false;
  res.json = ((body: unknown) => {
    if (finalizing) return res;
    finalizing = true;
    const status = res.statusCode;
    const outcome = status < 400 ? 'success' : status === 401 || status === 403 ? 'rejected' : 'failure';
    const operatorId = req.user?._id;
    void StoreNotificationOpsAudit.updateOne({ _id: auditId, outcome: 'started' }, {
      $set: { outcome, httpStatus: status, completedAt: new Date(), ...(operatorId ? { operatorId } : {}) },
    }).then((result) => {
      if (!result.matchedCount) throw new Error('audit_outcome_not_recorded');
      originalJson(body);
    }).catch(() => signalAuditFailure('outcome_failed')).finally(() => {
      // If the audit outcome could not be persisted, never return a successful
      // operational response. The stale-start recovery job records the result
      // as unknown after its bounded timeout.
      if (res.headersSent) return;
      res.status(503);
      originalJson({ success: false, message: 'Operational audit result could not be recorded.' });
    });
    return res;
  }) as Response['json'];
  next();
}
