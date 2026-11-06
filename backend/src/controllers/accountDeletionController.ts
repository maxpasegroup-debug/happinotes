import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { AccountDeletionReauth } from '../models/AccountDeletionReauth';
import { Otp, User } from '../models';
import { deletionStatusTokenFor, findActiveDeletionRequest, hashDeletionSecret, isAccountWritable, requestAccountDeletion } from '../services/accountDeletion';
import { AccountDeletionRequest } from '../models/AccountDeletionRequest';
import { BadRequestError, UnauthorizedError } from '../utils/errors';
import { sendOTPEmail } from '../services/emailService';
import mongoose from 'mongoose';

const REAUTH_WINDOW_MS = 10 * 60 * 1000;
const EXTERNAL_OTP_WINDOW_MS = 5 * 60 * 1000;
const MAX_EXTERNAL_OTP_ATTEMPTS = 5;
const EXTERNAL_OTP_COOLDOWN_MS = 60 * 1000;

function publicDeletionStatus(request: { status: string; reviewStatus?: string }): 'REQUEST_RECEIVED' | 'UNDER_REVIEW' | 'COMPLETED' {
  if (request.status === 'completed') return 'COMPLETED';
  if (request.reviewStatus === 'under_review' || request.status !== 'requested') return 'UNDER_REVIEW';
  return 'REQUEST_RECEIVED';
}

const invalidExternalCode = (): UnauthorizedError => new UnauthorizedError('The verification code is invalid or expired');

/** Start an external deletion request without revealing whether an email has an account. */
export async function requestExternalDeletionOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return next(new BadRequestError('Enter a valid email address'));
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const genericResponse = { success: true, message: 'If an eligible account uses this email, a verification code will be sent.' };
    const user = await User.findOne({ email }).select('_id deletionState blocked');
    const active = user ? await findActiveDeletionRequest(user._id) : null;
    if (!user || (!active && !(await isAccountWritable(user._id)))) {
      res.status(202).json(genericResponse);
      return;
    }

    const now = new Date();
    const latest = await Otp.findOne({ identifier: email, purpose: 'external-deletion', used: false, expiresAt: { $gt: now } }).sort({ createdAt: -1 });
    if (latest?.createdAt && latest.createdAt.getTime() + EXTERNAL_OTP_COOLDOWN_MS > now.getTime()) {
      res.status(202).json(genericResponse);
      return;
    }

    const otp = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
    await Otp.updateMany({ identifier: email, purpose: 'external-deletion', used: false }, { $set: { used: true } });
    const record = await Otp.create({
      identifier: email,
      purpose: 'external-deletion',
      otp: hashDeletionSecret(`${email}:${otp}`),
      expiresAt: new Date(now.getTime() + EXTERNAL_OTP_WINDOW_MS),
    });
    try {
      await sendOTPEmail(email, otp);
    } catch {
      record.used = true;
      await record.save();
      console.error('external_deletion_otp_delivery_failed');
    }
    res.status(202).json(genericResponse);
  } catch (error) { next(error); }
}

/** Verify ownership of the registered email, then open the same durable deletion workflow used by the app. */
export async function verifyExternalDeletionOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return next(new BadRequestError('Enter a valid email and six-digit code'));
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const otp = String(req.body?.otp ?? '').trim();
    const now = new Date();
    const codeHash = hashDeletionSecret(`${email}:${otp}`);
    const consumed = await Otp.findOneAndUpdate(
      { identifier: email, purpose: 'external-deletion', otp: codeHash, used: false, attempts: { $lt: MAX_EXTERNAL_OTP_ATTEMPTS }, expiresAt: { $gt: now } },
      { $set: { used: true } },
      { new: true },
    );
    if (!consumed) {
      const latest = await Otp.findOne({ identifier: email, purpose: 'external-deletion', used: false, expiresAt: { $gt: now } }).sort({ createdAt: -1 });
      if (latest) await Otp.updateOne({ _id: latest._id, attempts: { $lt: MAX_EXTERNAL_OTP_ATTEMPTS }, used: false }, { $inc: { attempts: 1 } });
      return next(invalidExternalCode());
    }

    const user = await User.findOne({ email }).select('_id blocked deletionState');
    if (!user) return next(invalidExternalCode());
    let request = await findActiveDeletionRequest(user._id);
    if (!request) {
      if (!(await isAccountWritable(user._id))) return next(invalidExternalCode());
      request = await requestAccountDeletion(user._id, crypto.randomBytes(32).toString('base64url'), 'external_web');
    }

    let statusToken = '';
    if (!request.publicReference) {
      await AccountDeletionRequest.updateOne(
        { _id: request._id, publicReference: { $exists: false } },
        {
          $set: { publicReference: `HN-DEL-${crypto.randomBytes(10).toString('hex').toUpperCase()}` },
        },
      );
    }
    request = await AccountDeletionRequest.findById(request._id);
    if (!request?.publicReference) return next(new Error('Could not create a deletion request reference'));
    // Derive the same high-entropy status bearer credential as the signed-in
    // flow. Only its hash is stored; the requester must save the plaintext.
    statusToken = deletionStatusTokenFor(request.publicReference, user._id);
    const verificationRecordedAt = new Date();
    await AccountDeletionRequest.updateOne(
      { _id: request._id },
      {
        $set: { statusTokenHash: hashDeletionSecret(statusToken) },
        $push: { processingHistory: { status: 'EXTERNAL_IDENTITY_VERIFIED', actor: 'external_web', at: verificationRecordedAt } },
      },
    );
    res.status(202).json({
      success: true,
      reference: request.publicReference,
      status: publicDeletionStatus(request),
      requestedAt: request.requestedAt,
      statusToken,
    });
  } catch (error) { next(error); }
}

/** Read only limited request status using a high-entropy server-derived bearer token. */
export async function getExternalDeletionStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const reference = String(req.body?.reference ?? '').trim().toUpperCase();
    const statusToken = String(req.body?.statusToken ?? '');
    if (!/^HN-DEL-[A-F0-9]{20}$/.test(reference) || statusToken.length < 32 || statusToken.length > 128) {
      return next(invalidExternalCode());
    }
    const request = await AccountDeletionRequest.findOne({
      publicReference: reference,
      statusTokenHash: hashDeletionSecret(statusToken),
    }).select('publicReference status reviewStatus requestedAt startedAt completedAt processingHistory');
    if (!request) return next(invalidExternalCode());
    res.json({
      success: true,
      reference: request.publicReference,
      status: publicDeletionStatus(request),
      requestedAt: request.requestedAt,
      completedAt: request.completedAt ?? null,
      history: (request.processingHistory ?? []).map((entry) => ({ status: entry.status, at: entry.at })),
    });
  } catch (error) { next(error); }
}

export async function getAdminDeletionRequests(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const requests = await AccountDeletionRequest.find({})
      .sort({ requestedAt: -1 })
      .limit(200)
      .populate({ path: 'userId', select: 'name email phoneNumber' });
    res.json({
      success: true,
      requests: requests.map((request) => {
        const account = request.userId as unknown as { name?: string; email?: string; phoneNumber?: string } | null;
        return {
          id: String(request._id),
          reference: request.publicReference ?? String(request._id),
          status: publicDeletionStatus(request),
          internalStatus: request.status,
          reviewStatus: request.reviewStatus ?? 'received',
          source: request.source ?? 'in_app',
          requestedAt: request.requestedAt,
          startedAt: request.startedAt ?? null,
          completedAt: request.completedAt ?? null,
          account: account ? { name: account.name ?? '', email: account.email ?? '', phoneNumber: account.phoneNumber ?? '' } : null,
          history: (request.processingHistory ?? []).map((entry) => ({ status: entry.status, actor: entry.actor, at: entry.at })),
        };
      }),
    });
  } catch (error) { next(error); }
}

/** Admin can document review, but cannot manually declare deletion complete. */
export async function markDeletionRequestUnderReview(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) return next(new UnauthorizedError('Not authenticated'));
    if (!mongoose.isValidObjectId(req.params.id)) return next(new BadRequestError('Invalid request ID'));
    const now = new Date();
    const request = await AccountDeletionRequest.findOneAndUpdate(
      { _id: req.params.id, status: { $ne: 'completed' } },
      {
        $set: { reviewStatus: 'under_review' },
        $push: { processingHistory: { status: 'UNDER_REVIEW', actor: `admin:${String(req.user._id)}`, at: now } },
      },
      { new: true },
    );
    if (!request) return next(new BadRequestError('Deletion request not found or already completed'));
    res.json({ success: true, reference: request.publicReference ?? String(request._id), status: publicDeletionStatus(request) });
  } catch (error) { next(error); }
}

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
    if (!user.password || !(await bcrypt.compare(credential, user.password))) {
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
      const statusToken = active.publicReference
        ? deletionStatusTokenFor(active.publicReference, req.user._id)
        : undefined;
      res.status(202).json({
        success: true,
        requestId: String(active._id),
        reference: active.publicReference ?? null,
        status: active.status,
        publicStatus: publicDeletionStatus(active),
        requestedAt: active.requestedAt,
        statusToken,
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
      reference: request.publicReference ?? null,
      status: request.status,
      publicStatus: publicDeletionStatus(request),
      requestedAt: request.requestedAt,
      statusToken: request.publicReference
        ? deletionStatusTokenFor(request.publicReference, req.user._id)
        : undefined,
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
      reference: request.publicReference ?? null,
      status: request.status,
      publicStatus: publicDeletionStatus(request),
      requestedAt: request.requestedAt,
      startedAt: request.startedAt ?? null,
      completedAt: request.completedAt ?? null,
      statusToken: request.publicReference
        ? deletionStatusTokenFor(request.publicReference, req.user!._id)
        : undefined,
      failureCode: request.failureCode ?? null,
      processingHistory: (request.processingHistory ?? []).map((entry) => ({ status: entry.status, at: entry.at })),
    });
  } catch (error) { next(error); }
}
