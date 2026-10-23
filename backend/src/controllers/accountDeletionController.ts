import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { AccountDeletionReauth } from '../models/AccountDeletionReauth';
import { User } from '../models';
import { findActiveDeletionRequest, hashDeletionSecret, isAccountWritable, requestAccountDeletion } from '../services/accountDeletion';
import { AccountDeletionRequest } from '../models/AccountDeletionRequest';
import { BadRequestError, UnauthorizedError } from '../utils/errors';

const REAUTH_WINDOW_MS = 10 * 60 * 1000;

export async function requestDeletionReauth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return next(new BadRequestError(errors.array()[0].msg));
    if (!req.user) return next(new UnauthorizedError('Not authenticated'));
    const credential = typeof req.body?.password === 'string'
      ? req.body.password
      : typeof req.body?.pin === 'string' ? req.body.pin : '';
    if (credential.length < 6 || credential.length > 256) {
      return next(new BadRequestError('A valid account credential is required'));
    }

    const user = await User.findById(req.user._id).select('+password blocked deletionState');
    if (!user || !(await isAccountWritable(req.user._id))) {
      return next(new UnauthorizedError('Account deletion is not available'));
    }
    if (!(await bcrypt.compare(credential, user.password))) {
      return next(new UnauthorizedError('Credential verification failed'));
    }

    const proof = crypto.randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + REAUTH_WINDOW_MS);
    await AccountDeletionReauth.create({
      userId: req.user._id,
      proofHash: hashDeletionSecret(proof),
      expiresAt,
    });
    res.json({ success: true, proof, expiresAt });
  } catch (error) {
    next(error);
  }
}

export async function requestDeletion(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return next(new BadRequestError(errors.array()[0].msg));
    if (!req.user) return next(new UnauthorizedError('Not authenticated'));
    const proof = typeof req.body?.proof === 'string' ? req.body.proof : '';
    const idempotencyKey = typeof req.body?.idempotencyKey === 'string' ? req.body.idempotencyKey : '';
    if (proof.length < 20 || proof.length > 512 || idempotencyKey.length < 16 || idempotencyKey.length > 128) {
      return next(new BadRequestError('A valid deletion proof and idempotency key are required'));
    }

    // Once accepted, retries are safe and do not require the one-time proof
    // again. The deletion-only middleware permits this route for that purpose.
    const active = await findActiveDeletionRequest(req.user._id);
    if (active) {
      res.status(202).json({
        success: true,
        requestId: String(active._id),
        status: active.status,
        requestedAt: active.requestedAt,
      });
      return;
    }

    const consumed = await AccountDeletionReauth.findOneAndUpdate(
      {
        userId: req.user._id,
        proofHash: hashDeletionSecret(proof),
        usedAt: null,
        expiresAt: { $gt: new Date() },
      },
      { $set: { usedAt: new Date() } },
      { new: true },
    );
    if (!consumed) return next(new UnauthorizedError('Deletion proof is invalid or expired'));

    const request = await requestAccountDeletion(req.user._id, idempotencyKey);
    res.status(202).json({
      success: true,
      requestId: String(request._id),
      status: request.status,
      requestedAt: request.requestedAt,
    });
  } catch (error) {
    next(error);
  }
}

export async function getDeletionStatus(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) return next(new UnauthorizedError('Not authenticated'));
    const request = await AccountDeletionRequest.findOne({ userId: req.user._id }).sort({ requestedAt: -1 });
    if (!request) return next(new UnauthorizedError('Deletion request not found'));
    res.json({
      success: true,
      requestId: String(request._id),
      status: request.status,
      requestedAt: request.requestedAt,
      startedAt: request.startedAt ?? null,
      completedAt: request.completedAt ?? null,
      failureCode: request.failureCode ?? null,
    });
  } catch (error) { next(error); }
}
