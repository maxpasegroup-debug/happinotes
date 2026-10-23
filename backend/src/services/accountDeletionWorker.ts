import { randomUUID } from 'crypto';
import { Otp, User } from '../models';
import { IAccountDeletionRequest } from '../models/AccountDeletionRequest';
import { PasswordResetToken } from '../models/passwordResetToken';
import {
  blockDeletionForPolicy,
  claimNextDeletionRequest,
  completeDeletionCheckpoint,
  recordDeletionFailure,
} from './accountDeletion';

const DEFAULT_LEASE_MS = 5 * 60 * 1000;
const DEFAULT_INTERVAL_MS = 30 * 1000;
const MAX_BATCH = 10;

type DeletionWorkerResult = 'processed' | 'idle' | 'blocked' | 'failed';

function matchedCount(result: unknown): number {
  const value = result as { matchedCount?: number; n?: number };
  return value.matchedCount ?? value.n ?? 0;
}

function deletionErrorCode(error: unknown): string {
  const code = error && typeof error === 'object' && 'code' in error
    ? String((error as { code?: unknown }).code)
    : '';
  return code.replace(/[^A-Za-z0-9_.-]/g, '').slice(0, 64) || 'WORKER_STEP_FAILED';
}

/** Ensure the durable account marker is present even if the API process
 * crashed after creating the request and before its compare-and-set. */
async function ensurePendingAccount(request: IAccountDeletionRequest): Promise<void> {
  const result = await User.updateOne(
    {
      _id: request.userId,
      blocked: { $ne: true },
      $or: [
        { deletionState: 'pending' },
        { deletionState: 'active' },
        { deletionState: { $exists: false } },
      ],
    },
    { $set: { deletionState: 'pending', deletionRequestedAt: request.requestedAt } },
  );
  if (!matchedCount(result)) {
    throw Object.assign(new Error('Account is unavailable for deletion'), {
      code: 'ACCOUNT_NOT_ELIGIBLE',
      retryable: false,
    });
  }
}

async function cleanupAuthArtifacts(request: IAccountDeletionRequest): Promise<void> {
  await PasswordResetToken.deleteMany({ userId: request.userId });

  // Otp predates userId and is keyed by the normalized email/phone identifier.
  // The User document remains present and pending throughout this stage, so a
  // unique identifier cannot be reassigned to a new account concurrently.
  const user = await User.findById(request.userId).select('email phoneNumber deletionState');
  if (!user || user.deletionState !== 'pending') {
    throw Object.assign(new Error('Account deletion marker is no longer pending'), {
      code: 'ACCOUNT_NOT_PENDING',
      retryable: false,
    });
  }
  const identifiers = [user.email, user.phoneNumber].filter(
    (value): value is string => typeof value === 'string' && value.trim().length > 0,
  );
  if (identifiers.length > 0) await Otp.deleteMany({ identifier: { $in: identifiers } });
}

async function cleanupPreferencesAndDevices(request: IAccountDeletionRequest): Promise<void> {
  const result = await User.updateOne(
    { _id: request.userId, deletionState: 'pending' },
    {
      // These are user-owned, non-financial records. Deliberately retain
      // purchasedBooks and subscription until the approved policy is supplied.
      $set: { bookCollection: [], favourites: [], fcmTokens: [] },
    },
  );
  if (!matchedCount(result)) {
    throw Object.assign(new Error('Account deletion marker is no longer pending'), {
      code: 'ACCOUNT_NOT_PENDING',
      retryable: false,
    });
  }
}

/** Execute one claimed request. Each step is idempotent and recorded only
 * while the current worker still owns the lease. */
export async function processClaimedDeletionRequest(
  request: IAccountDeletionRequest,
  leaseOwner: string,
): Promise<DeletionWorkerResult> {
  try {
    await ensurePendingAccount(request);

    if (request.checkpoints?.authArtifacts !== 'complete') {
      await cleanupAuthArtifacts(request);
      if (!(await completeDeletionCheckpoint(request._id, leaseOwner, 'authArtifacts'))) {
        throw Object.assign(new Error('Deletion worker lease expired'), { code: 'LEASE_EXPIRED' });
      }
    }

    if (request.checkpoints?.preferencesAndDevices !== 'complete') {
      await cleanupPreferencesAndDevices(request);
      if (!(await completeDeletionCheckpoint(request._id, leaseOwner, 'preferencesAndDevices'))) {
        throw Object.assign(new Error('Deletion worker lease expired'), { code: 'LEASE_EXPIRED' });
      }
    }

    if (request.checkpoints?.personalDataCleanup !== 'complete') {
      if (!(await completeDeletionCheckpoint(request._id, leaseOwner, 'personalDataCleanup'))) {
        throw Object.assign(new Error('Deletion worker lease expired'), { code: 'LEASE_EXPIRED' });
      }
    }

    // Account identity, StorePurchase, SubscriptionPurchase, subscription
    // entitlements, and financial/audit retention remain policy-dependent.
    // Stop explicitly instead of claiming completion or deleting them.
    if (!(await blockDeletionForPolicy(request._id, leaseOwner))) {
      throw Object.assign(new Error('Deletion worker lease expired'), { code: 'LEASE_EXPIRED' });
    }
    return 'blocked';
  } catch (error) {
    const retryable = !error || typeof error !== 'object' || (error as { retryable?: boolean }).retryable !== false;
    await recordDeletionFailure(
      request._id,
      leaseOwner,
      deletionErrorCode(error),
      error instanceof Error ? error.message : 'Deletion worker failed',
      retryable,
      retryable ? new Date(Date.now() + 60 * 1000) : undefined,
    );
    return 'failed';
  }
}

/** Run a bounded batch. The lease owner is unique per process, while Mongo's
 * atomic claim prevents another replica from processing the same request. */
export async function runAccountDeletionWorkerOnce(
  leaseOwner = `account-deletion:${randomUUID()}`,
  maxBatch = MAX_BATCH,
): Promise<number> {
  let processed = 0;
  for (let index = 0; index < maxBatch; index += 1) {
    const request = await claimNextDeletionRequest(leaseOwner, DEFAULT_LEASE_MS);
    if (!request) break;
    processed += 1;
    await processClaimedDeletionRequest(request, leaseOwner);
  }
  return processed;
}

/** Start the worker inside the existing backend process. Every replica may
 * run this safely because request claims are lease-guarded. Set the flag to
 * `false` only for an intentionally worker-disabled non-production process. */
export function startAccountDeletionWorker(): () => void {
  if (process.env.ACCOUNT_DELETION_WORKER_ENABLED?.trim().toLowerCase() === 'false') {
    return () => undefined;
  }
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await runAccountDeletionWorkerOnce();
    } catch {
      // A later tick retries eligible requests; request-level failures are
      // recorded by processClaimedDeletionRequest with a lease guard.
      console.error('Account deletion worker tick failed; will retry');
    } finally {
      running = false;
    }
  };
  void tick();
  const timer = setInterval(() => { void tick(); }, DEFAULT_INTERVAL_MS);
  timer.unref();
  return () => clearInterval(timer);
}

