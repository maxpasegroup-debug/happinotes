import crypto from 'crypto';
import mongoose, { ClientSession, Types } from 'mongoose';
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

/** Derive the private status bearer credential without retaining plaintext. */
export const deletionStatusTokenFor = (
  publicReference: string,
  userId: Types.ObjectId | string,
): string => hashDeletionSecret(`external-status:${publicReference}:${String(userId)}`);

export const isDeletionStateActive = (state: unknown): boolean =>
  state === undefined || state === null || state === 'active';

export async function hasActiveDeletionRequest(
  userId: Types.ObjectId | string,
  session?: ClientSession,
): Promise<boolean> {
  const query = AccountDeletionRequest.exists({
    userId,
    status: { $in: [...ACCOUNT_DELETION_ACTIVE_STATUSES] },
  });
  if (session) query.session(session);
  return Boolean(await query);
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
export async function isAccountWritable(
  userId: Types.ObjectId | string,
  session?: ClientSession,
): Promise<boolean> {
  const query = User.findById(userId).select('blocked deletionState');
  if (session) query.session(session);
  const user = await query;
  if (!user || user.blocked || !isDeletionStateActive(user.deletionState)) return false;
  return !(await hasActiveDeletionRequest(userId, session));
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
  source: 'in_app' | 'external_web' = 'in_app',
): Promise<IAccountDeletionRequest> {
  const idempotencyKeyHash = hashDeletionSecret(idempotencyKey);
  const byKey = await AccountDeletionRequest.findOne({ userId, idempotencyKeyHash });
  if (byKey) return byKey;

  const active = await findActiveDeletionRequest(userId);
  if (active) return active;

  const requestedAt = new Date();
  const publicReference = `HN-DEL-${crypto.randomBytes(10).toString('hex').toUpperCase()}`;
  const statusToken = deletionStatusTokenFor(publicReference, userId);
  let request: IAccountDeletionRequest | undefined;
  let createdRequest = false;
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      // The request record and User pending marker commit together. Google
      // entitlement transactions also write this User document, making the
      // two flows serialize through MongoDB's document write-conflict rules.
      createdRequest = false;
      const existingByKey = await AccountDeletionRequest.findOne({ userId, idempotencyKeyHash })
        .session(session);
      if (existingByKey) {
        request = existingByKey;
        return;
      }
      const existingActive = await AccountDeletionRequest.findOne({
        userId, status: { $in: [...ACCOUNT_DELETION_ACTIVE_STATUSES] },
      }).session(session);
      if (existingActive) {
        request = existingActive;
        return;
      }

      const newRequest = new AccountDeletionRequest({
        userId,
        idempotencyKeyHash,
        status: 'requested',
        publicReference,
        statusTokenHash: hashDeletionSecret(statusToken),
        source,
        reviewStatus: 'received',
        processingHistory: [{ status: 'REQUEST_RECEIVED', actor: source, at: requestedAt }],
        requestedAt,
        attempts: 0,
        checkpoints: {
          accessBlocked: false,
          authArtifacts: 'pending',
          preferencesAndDevices: 'pending',
          personalDataCleanup: 'deferred_policy',
          entitlementPolicy: 'deferred_policy',
          profileAnonymization: 'pending',
          contactCleanup: 'pending',
          purchaseEvidence: 'deferred_policy',
          premiumEntitlement: 'pending',
          supportRecords: 'deferred_policy',
          providerData: 'deferred_policy',
          logsAndBackups: 'deferred_policy',
          auditTrailMinimization: 'deferred_policy',
        },
      });
      await newRequest.save({ session });

      const marker = await User.updateOne(
        {
          _id: userId,
          blocked: { $ne: true },
          $or: [{ deletionState: 'active' }, { deletionState: { $exists: false } }],
        },
        { $set: { deletionState: 'pending', deletionRequestedAt: requestedAt } },
        { session },
      );
      const matched = (marker as unknown as { matchedCount?: number; n?: number }).matchedCount ??
        (marker as unknown as { n?: number }).n ?? 0;
      if (!matched) throw new ForbiddenError('Account cannot accept a deletion request');

      request = newRequest;
      createdRequest = true;
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
  } finally {
    await session.endSession();
  }

  if (!request) throw new ForbiddenError('Account cannot accept a deletion request');
  // Another transaction may have created the idempotent/active request after
  // the non-transactional fast-path lookups above.
  if (!createdRequest) return request;

  try {
    await AccountDeletionRequest.updateOne({ _id: request._id }, {
      $set: {
        'checkpoints.accessBlocked': true,
        'checkpoints.accessBlockedAt': requestedAt,
      },
      $push: { processingHistory: { status: 'ACCESS_BLOCKED', actor: source, at: requestedAt } },
    });
  } catch (error) {
    await AccountDeletionRequest.updateOne(
      { _id: request._id },
      [{ $set: {
        status: 'failed_retryable',
        failureCode: 'CHECKPOINT_WRITE_FAILED',
        failureMessage: 'Deletion workflow failed at a checkpoint',
        nextAttemptAt: { $add: ['$$NOW', 60_000] },
        updatedAt: '$$NOW',
      } }],
      { timestamps: false },
    );
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
  return AccountDeletionRequest.findOneAndUpdate(
    {
      _id: requestId,
      status: { $in: ['requested', 'processing', 'failed_retryable'] },
      // Compare lease and retry deadlines against MongoDB's clock. Application
      // instance clocks may differ, so client-generated Date predicates are
      // not a safe cross-instance ownership boundary.
      $expr: { $and: [
        { $or: [{ $eq: [{ $type: '$leaseUntil' }, 'missing'] }, { $lte: ['$leaseUntil', '$$NOW'] }] },
        { $or: [{ $eq: [{ $type: '$nextAttemptAt' }, 'missing'] }, { $lte: ['$nextAttemptAt', '$$NOW'] }] },
      ] },
    },
    [{ $set: {
        status: 'processing',
        startedAt: '$$NOW',
        leaseUntil: { $add: ['$$NOW', leaseMs] },
        leaseOwner: owner,
        attempts: { $add: [{ $ifNull: ['$attempts', 0] }, 1] },
        processingHistory: { $concatArrays: [
          { $ifNull: ['$processingHistory', []] },
          [{ status: 'UNDER_REVIEW', actor: 'system:worker', at: '$$NOW' }],
        ] },
        updatedAt: '$$NOW',
      } }],
    { new: true, timestamps: false },
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
  return AccountDeletionRequest.findOneAndUpdate(
    {
      status: { $in: ['requested', 'processing', 'failed_retryable'] },
      $expr: { $and: [
        { $or: [{ $eq: [{ $type: '$leaseUntil' }, 'missing'] }, { $lte: ['$leaseUntil', '$$NOW'] }] },
        { $or: [{ $eq: [{ $type: '$nextAttemptAt' }, 'missing'] }, { $lte: ['$nextAttemptAt', '$$NOW'] }] },
      ] },
    },
    [{ $set: {
        status: 'processing',
        startedAt: '$$NOW',
        leaseUntil: { $add: ['$$NOW', leaseMs] },
        leaseOwner: owner,
        attempts: { $add: [{ $ifNull: ['$attempts', 0] }, 1] },
        processingHistory: { $concatArrays: [
          { $ifNull: ['$processingHistory', []] },
          [{ status: 'UNDER_REVIEW', actor: 'system:worker', at: '$$NOW' }],
        ] },
        updatedAt: '$$NOW',
      } }],
    { new: true, sort: { requestedAt: 1 }, timestamps: false },
  );
}

/** Update a checkpoint only while this worker still owns the lease. */
export async function completeDeletionCheckpoint(
  requestId: Types.ObjectId | string,
  leaseOwner: string,
  checkpoint:
    | 'authArtifacts'
    | 'preferencesAndDevices'
    | 'profileAnonymization'
    | 'contactCleanup'
    | 'premiumEntitlement',
): Promise<boolean> {
  const result = await AccountDeletionRequest.updateOne(
    {
      _id: requestId,
      status: 'processing',
      leaseOwner: leaseOwner.trim().slice(0, 128),
      $expr: { $gt: ['$leaseUntil', '$$NOW'] },
    },
    [{ $set: {
      [`checkpoints.${checkpoint}`]: 'complete',
      processingHistory: { $concatArrays: [
        { $ifNull: ['$processingHistory', []] },
        [{ status: `CHECKPOINT_DONE:${checkpoint}`, actor: 'system:worker', at: '$$NOW' }],
      ] },
      updatedAt: '$$NOW',
    } }],
    { timestamps: false },
  );
  const writeResult = result as unknown as { matchedCount?: number; n?: number };
  return (writeResult.matchedCount ?? writeResult.n ?? 0) > 0;
}

/** Extend only an unexpired lease still owned by this worker. */
export async function renewDeletionLease(
  requestId: Types.ObjectId | string,
  leaseOwner: string,
  leaseMs = 5 * 60 * 1000,
): Promise<boolean> {
  const owner = leaseOwner.trim().slice(0, 128);
  if (!owner || !Number.isFinite(leaseMs) || leaseMs <= 0 || leaseMs > 60 * 60 * 1000) return false;
  const result = await AccountDeletionRequest.updateOne(
    {
      _id: requestId,
      status: 'processing',
      leaseOwner: owner,
      $expr: { $gt: ['$leaseUntil', '$$NOW'] },
    },
    [{ $set: { leaseUntil: { $add: ['$$NOW', leaseMs] }, updatedAt: '$$NOW' } }],
    { timestamps: false },
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
    {
      _id: requestId,
      status: 'processing',
      leaseOwner: leaseOwner.trim().slice(0, 128),
      $expr: { $gt: ['$leaseUntil', '$$NOW'] },
    },
    [{ $set: {
        status: 'blocked_policy',
        failureCode: safeCode,
        failureMessage: 'Deletion is paused pending an approved retention policy',
        'checkpoints.personalDataCleanup': 'deferred_policy',
        'checkpoints.entitlementPolicy': 'deferred_policy',
        'checkpoints.purchaseEvidence': 'deferred_policy',
        'checkpoints.supportRecords': 'deferred_policy',
        'checkpoints.providerData': 'deferred_policy',
        'checkpoints.logsAndBackups': 'deferred_policy',
        'checkpoints.auditTrailMinimization': 'deferred_policy',
        processingHistory: { $concatArrays: [
          { $ifNull: ['$processingHistory', []] },
          [{ status: 'RETENTION_POLICY_APPROVAL_REQUIRED', actor: 'system:retention-policy-gate', at: '$$NOW' }],
        ] },
        updatedAt: '$$NOW',
      } },
      { $unset: ['leaseUntil', 'leaseOwner', 'nextAttemptAt'] }],
    { timestamps: false },
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
  retryDelayMs?: number,
): Promise<boolean> {
  const safeCode = failureCode.replace(/[^A-Za-z0-9_.-]/g, '').slice(0, 64);
  // Never persist provider exception text: it may contain tokens, addresses,
  // or credentials. Keep the detailed error in a separately access-controlled
  // telemetry system if one is approved; this record gets a fixed summary.
  void failureMessage;
  const safeMessage = 'Deletion workflow failed at a checkpoint';
  if (!safeCode || !leaseOwner.trim()) return false;
  const safeRetryDelayMs = typeof retryDelayMs === 'number' && Number.isFinite(retryDelayMs) &&
      retryDelayMs > 0 && retryDelayMs <= 24 * 60 * 60 * 1000
    ? retryDelayMs
    : undefined;
  const setFields: Record<string, unknown> = {
      status: retryable ? 'failed_retryable' : 'failed_manual',
      failureCode: safeCode,
      failureMessage: safeMessage,
      ...(retryable && safeRetryDelayMs ? { nextAttemptAt: { $add: ['$$NOW', safeRetryDelayMs] } } : {}),
  };
  const result = await AccountDeletionRequest.updateOne(
    {
      _id: requestId,
      status: 'processing',
      leaseOwner: leaseOwner.trim().slice(0, 128),
      $expr: { $gt: ['$leaseUntil', '$$NOW'] },
    },
    [{ $set: {
      ...setFields,
      processingHistory: { $concatArrays: [
        { $ifNull: ['$processingHistory', []] },
        [{ status: retryable ? 'PROCESSING_RETRYABLE_FAILURE' : 'PROCESSING_REQUIRES_MANUAL_REVIEW', actor: 'system:worker', at: '$$NOW' }],
      ] },
      updatedAt: '$$NOW',
    } }, { $unset: ['leaseUntil', 'leaseOwner'] }],
    { timestamps: false },
  );
  const writeResult = result as unknown as { matchedCount?: number; n?: number };
  return (writeResult.matchedCount ?? writeResult.n ?? 0) > 0;
}
