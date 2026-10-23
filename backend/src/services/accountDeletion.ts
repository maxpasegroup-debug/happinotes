import crypto from 'crypto';
import { Types } from 'mongoose';
import { env } from '../config/env';
import { User } from '../models';
import {
  ACCOUNT_DELETION_ACTIVE_STATUSES,
  AccountDeletionRequest,
  IAccountDeletionRequest,
} from '../models/AccountDeletionRequest';
import { ForbiddenError } from '../utils/errors';

export const DELETION_BLOCKED_MESSAGE = 'Account deletion is in progress';

const isDuplicateKey = (error: unknown): boolean =>
  Boolean(error && typeof error === 'object' && (error as { code?: number }).code === 11000);

export const hashDeletionSecret = (value: string): string =>
  crypto.createHmac('sha256', env.JWT_SECRET).update(value).digest('hex');

export const isDeletionStateActive = (state: unknown): boolean =>
  state === undefined || state === null || state === 'active';

export async function hasActiveDeletionRequest(userId: Types.ObjectId | string): Promise<boolean> {
  return Boolean(await AccountDeletionRequest.exists({
    userId,
    status: { $in: [...ACCOUNT_DELETION_ACTIVE_STATUSES] },
  }));
}

export async function findActiveDeletionRequest(userId: Types.ObjectId | string) {
  return AccountDeletionRequest.findOne({
    userId,
    status: { $in: [...ACCOUNT_DELETION_ACTIVE_STATUSES] },
  });
}

/**
 * Checks both the user marker and the durable request. The request check
 * closes the small crash window between creating the request and setting the
 * user marker, and is intentionally used immediately before sensitive writes.
 */
export async function isAccountWritable(userId: Types.ObjectId | string): Promise<boolean> {
  const query = User.findById(userId).select('blocked deletionState');
  const user = await query;
  if (!user || user.blocked || !isDeletionStateActive(user.deletionState)) return false;
  return !(await hasActiveDeletionRequest(userId));
}

export async function assertAccountWritable(userId: Types.ObjectId | string): Promise<void> {
  if (!(await isAccountWritable(userId))) throw new ForbiddenError(DELETION_BLOCKED_MESSAGE);
}

/**
 * Create (or return) the one durable request for an account. This only marks
 * access as pending; policy-dependent cleanup is deliberately not performed.
 */
export async function requestAccountDeletion(
  userId: Types.ObjectId | string,
  idempotencyKey: string,
): Promise<IAccountDeletionRequest> {
  const idempotencyKeyHash = hashDeletionSecret(idempotencyKey);
  const byKey = await AccountDeletionRequest.findOne({ userId, idempotencyKeyHash });
  if (byKey) return byKey;

  const active = await findActiveDeletionRequest(userId);
  if (active) return active;

  const requestedAt = new Date();
  let request: IAccountDeletionRequest;
  try {
    request = await AccountDeletionRequest.create({
      userId,
      idempotencyKeyHash,
      status: 'requested',
      requestedAt,
      attempts: 0,
      checkpoints: {
        accessBlocked: false,
        authArtifacts: 'pending',
        preferencesAndDevices: 'pending',
        personalDataCleanup: 'pending',
        entitlementPolicy: 'pending',
      },
    });
  } catch (error) {
    // A concurrent request may have won either the idempotency or active-user
    // unique index. Re-read and return that durable request rather than
    // creating a second workflow.
    if (!isDuplicateKey(error)) throw error;
    const concurrent = await AccountDeletionRequest.findOne({
      userId,
      status: { $in: [...ACCOUNT_DELETION_ACTIVE_STATUSES] },
    });
    if (concurrent) return concurrent;
    const sameKey = await AccountDeletionRequest.findOne({ userId, idempotencyKeyHash });
    if (sameKey) return sameKey;
    throw error;
  }

  let marker;
  try {
    marker = await User.updateOne(
      {
        _id: userId,
        blocked: { $ne: true },
        $or: [{ deletionState: 'active' }, { deletionState: { $exists: false } }],
      },
      { $set: { deletionState: 'pending', deletionRequestedAt: requestedAt } },
    );
  } catch (error) {
    await AccountDeletionRequest.updateOne({ _id: request._id }, {
      $set: {
        status: 'failed_retryable',
        failureCode: 'ACCOUNT_MARKER_WRITE_FAILED',
        failureMessage: 'Deletion workflow failed at a checkpoint',
        nextAttemptAt: new Date(Date.now() + 60_000),
      },
    });
    throw error;
  }
  const matched = (marker as unknown as { matchedCount?: number; n?: number }).matchedCount ??
    (marker as unknown as { n?: number }).n ?? 0;

  if (matched === 0) {
    const current = await User.findById(userId).select('deletionState blocked');
    if (!current || current.blocked || !isDeletionStateActive(current.deletionState)) {
      await AccountDeletionRequest.updateOne({ _id: request._id }, {
        $set: {
          status: 'failed_manual',
          failureCode: 'ACCOUNT_NOT_ELIGIBLE',
          failureMessage: 'Account is not eligible for a new deletion request',
        },
      });
      throw new ForbiddenError('Account cannot accept a deletion request');
    }
  }

  try {
    await AccountDeletionRequest.updateOne({ _id: request._id }, {
      $set: {
        'checkpoints.accessBlocked': true,
        'checkpoints.accessBlockedAt': requestedAt,
      },
    });
  } catch (error) {
    await AccountDeletionRequest.updateOne({ _id: request._id }, {
      $set: {
        status: 'failed_retryable',
        failureCode: 'CHECKPOINT_WRITE_FAILED',
        failureMessage: 'Deletion workflow failed at a checkpoint',
        nextAttemptAt: new Date(Date.now() + 60_000),
      },
    });
    throw error;
  }
  request.status = 'requested';
  request.checkpoints.accessBlocked = true;
  request.checkpoints.accessBlockedAt = requestedAt;
  return request;
}

/** Claim one request for a bounded worker lease. Cleanup is intentionally not
 * performed here; policy-dependent steps are separate checkpoints. */
export async function claimDeletionRequest(
  requestId: Types.ObjectId | string,
  leaseOwner: string,
  leaseMs = 5 * 60 * 1000,
): Promise<IAccountDeletionRequest | null> {
  const owner = leaseOwner.trim().slice(0, 128);
  if (!owner || !Number.isFinite(leaseMs) || leaseMs <= 0 || leaseMs > 60 * 60 * 1000) return null;
  const now = new Date();
  return AccountDeletionRequest.findOneAndUpdate(
    {
      _id: requestId,
      status: { $in: ['requested', 'failed_retryable'] },
      $and: [
        { $or: [{ leaseUntil: { $exists: false } }, { leaseUntil: { $lte: now } }] },
        { $or: [{ nextAttemptAt: { $exists: false } }, { nextAttemptAt: { $lte: now } }] },
      ],
    },
    {
      $set: {
        status: 'processing',
        startedAt: now,
        leaseUntil: new Date(now.getTime() + leaseMs),
        leaseOwner: owner,
      },
      $inc: { attempts: 1 },
    },
    { new: true },
  );
}

/** Atomically claim the oldest eligible request. MongoDB's conditional
 * find-and-update is the cross-replica concurrency boundary: a second worker
 * cannot claim the same request while the first lease is valid. */
export async function claimNextDeletionRequest(
  leaseOwner: string,
  leaseMs = 5 * 60 * 1000,
): Promise<IAccountDeletionRequest | null> {
  const owner = leaseOwner.trim().slice(0, 128);
  if (!owner || !Number.isFinite(leaseMs) || leaseMs <= 0 || leaseMs > 60 * 60 * 1000) return null;
  const now = new Date();
  return AccountDeletionRequest.findOneAndUpdate(
    {
      status: { $in: ['requested', 'failed_retryable'] },
      $and: [
        { $or: [{ leaseUntil: { $exists: false } }, { leaseUntil: { $lte: now } }] },
        { $or: [{ nextAttemptAt: { $exists: false } }, { nextAttemptAt: { $lte: now } }] },
      ],
    },
    {
      $set: {
        status: 'processing',
        startedAt: now,
        leaseUntil: new Date(now.getTime() + leaseMs),
        leaseOwner: owner,
      },
      $inc: { attempts: 1 },
    },
    { new: true, sort: { requestedAt: 1 } },
  );
}

/** Update a checkpoint only while this worker still owns the lease. */
export async function completeDeletionCheckpoint(
  requestId: Types.ObjectId | string,
  leaseOwner: string,
  checkpoint: 'authArtifacts' | 'preferencesAndDevices' | 'personalDataCleanup',
): Promise<boolean> {
  const result = await AccountDeletionRequest.updateOne(
    { _id: requestId, status: 'processing', leaseOwner: leaseOwner.trim().slice(0, 128) },
    { $set: { [`checkpoints.${checkpoint}`]: 'complete' } },
  );
  const writeResult = result as unknown as { matchedCount?: number; n?: number };
  return (writeResult.matchedCount ?? writeResult.n ?? 0) > 0;
}

/** A policy gate is a deliberate terminal pause, not a successful deletion.
 * The active request remains associated with the pending account so retries or
 * new requests cannot reopen access before an owner-approved policy exists. */
export async function blockDeletionForPolicy(
  requestId: Types.ObjectId | string,
  leaseOwner: string,
  failureCode = 'POLICY_APPROVAL_REQUIRED',
): Promise<boolean> {
  const safeCode = failureCode.replace(/[^A-Za-z0-9_.-]/g, '').slice(0, 64);
  if (!safeCode || !leaseOwner.trim()) return false;
  const result = await AccountDeletionRequest.updateOne(
    { _id: requestId, status: 'processing', leaseOwner: leaseOwner.trim().slice(0, 128) },
    {
      $set: {
        status: 'blocked_policy',
        failureCode: safeCode,
        failureMessage: 'Deletion is paused pending an approved retention policy',
        'checkpoints.entitlementPolicy': 'deferred_policy',
      },
      $unset: { leaseUntil: 1, leaseOwner: 1, nextAttemptAt: 1 },
    },
  );
  const writeResult = result as unknown as { matchedCount?: number; n?: number };
  return (writeResult.matchedCount ?? writeResult.n ?? 0) > 0;
}

/** Record only a redacted operational failure, guarded by the worker lease. */
export async function recordDeletionFailure(
  requestId: Types.ObjectId | string,
  leaseOwner: string,
  failureCode: string,
  failureMessage: string,
  retryable: boolean,
  nextAttemptAt?: Date,
): Promise<boolean> {
  const safeCode = failureCode.replace(/[^A-Za-z0-9_.-]/g, '').slice(0, 64);
  // Never persist provider exception text: it may contain tokens, addresses,
  // or credentials. Keep the detailed error in a separately access-controlled
  // telemetry system if one is approved; this record gets a fixed summary.
  void failureMessage;
  const safeMessage = 'Deletion workflow failed at a checkpoint';
  if (!safeCode || !leaseOwner.trim()) return false;
  const update: Record<string, unknown> = {
    $set: {
      status: retryable ? 'failed_retryable' : 'failed_manual',
      failureCode: safeCode,
      failureMessage: safeMessage,
    },
    $unset: { leaseUntil: 1, leaseOwner: 1 },
  };
  if (retryable && nextAttemptAt) (update.$set as Record<string, unknown>).nextAttemptAt = nextAttemptAt;
  const result = await AccountDeletionRequest.updateOne(
    { _id: requestId, status: 'processing', leaseOwner: leaseOwner.trim().slice(0, 128) },
    update,
  );
  const writeResult = result as unknown as { matchedCount?: number; n?: number };
  return (writeResult.matchedCount ?? writeResult.n ?? 0) > 0;
}
