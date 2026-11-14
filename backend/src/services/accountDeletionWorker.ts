import { UserDevice } from '../models/UserDevice';
import { UserNetwork } from '../models/UserNetwork';
import { emitAccountDeletionsChanged } from './realtime';
import { randomUUID } from 'crypto';
import { AccountDeletionReauth, Otp, User } from '../models';
import { IAccountDeletionRequest } from '../models/AccountDeletionRequest';
import { PasswordResetToken } from '../models/passwordResetToken';
import { StorePurchase } from '../models/StorePurchase';
import { SubscriptionPurchase } from '../models/SubscriptionPurchase';
import {
  blockDeletionForPolicy,
  claimNextDeletionRequest,
  completeDeletionCheckpoint,
  recordDeletionFailure,
  renewDeletionLease,
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
      ...(request.source === 'admin' ? { role: 'user' } : { blocked: { $ne: true } }),
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
  await UserDevice.deleteMany({ userId: request.userId });
  await UserNetwork.deleteMany({ userId: request.userId });
  await PasswordResetToken.deleteMany({ userId: request.userId });
  await AccountDeletionReauth.deleteMany({ userId: request.userId });

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
  const credentialCleanup = await User.updateOne(
    { _id: request.userId, deletionState: 'pending', password: { $exists: true } },
    { $unset: { password: 1 }, $inc: { sessionVersion: 1 } },
  );
  if (!matchedCount(credentialCleanup) && !(await User.exists({
    _id: request.userId,
    deletionState: 'pending',
    password: { $exists: false },
  }))) {
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
      // These are user-owned, non-financial records. Entitlement removal runs
      // in its own ordered checkpoint after profile/contact cleanup.
      $set: { bookCollection: [], happyBiteCollection: [], favourites: [], fcmTokens: [] },
    },
  );
  if (!matchedCount(result)) {
    throw Object.assign(new Error('Account deletion marker is no longer pending'), {
      code: 'ACCOUNT_NOT_PENDING',
      retryable: false,
    });
  }
}

async function anonymizeProfile(request: IAccountDeletionRequest): Promise<void> {
  const result = await User.updateOne(
    { _id: request.userId, deletionState: 'pending' },
    { $set: { name: 'Deleted account', role: 'user', languagePreference: 'all' } },
  );
  if (!matchedCount(result)) {
    throw Object.assign(new Error('Account deletion marker is no longer pending'), {
      code: 'ACCOUNT_NOT_PENDING', retryable: false,
    });
  }
}

async function eraseContactFields(request: IAccountDeletionRequest): Promise<void> {
  const result = await User.updateOne(
    { _id: request.userId, deletionState: 'pending' },
    { $unset: { email: 1, phoneNumber: 1 } },
  );
  if (!matchedCount(result)) {
    throw Object.assign(new Error('Account deletion marker is no longer pending'), {
      code: 'ACCOUNT_NOT_PENDING', retryable: false,
    });
  }
}

async function revokeHappiNotesEntitlements(request: IAccountDeletionRequest): Promise<void> {
  const result = await User.updateOne(
    { _id: request.userId, deletionState: 'pending' },
    { $set: { purchasedBooks: [] }, $unset: { subscription: 1 } },
  );
  if (!matchedCount(result)) {
    throw Object.assign(new Error('Account deletion marker is no longer pending'), {
      code: 'ACCOUNT_NOT_PENDING', retryable: false,
    });
  }
}

/** Remove direct account and content/offer links while retaining only
 * provisional transaction evidence. Legal/finance disposition remains gated. */
async function detachPurchaseLedgers(request: IAccountDeletionRequest): Promise<void> {
  await StorePurchase.updateMany(
    { userId: request.userId },
    { $unset: { userId: 1, bookId: 1, __v: 1 } },
  );
  await SubscriptionPurchase.updateMany(
    { userId: request.userId },
    { $unset: { userId: 1, planKey: 1, priceVersion: 1, __v: 1 } },
  );
}

/** Execute one claimed request. Each step is idempotent and recorded only
 * while the current worker still owns the lease. */
export async function processClaimedDeletionRequest(
  request: IAccountDeletionRequest,
  leaseOwner: string,
): Promise<DeletionWorkerResult> {
  let leaseLost = false;
  let heartbeatInFlight: Promise<void> | null = null;
  const renewLease = async (): Promise<void> => {
    try {
      if (!(await renewDeletionLease(request._id, leaseOwner, DEFAULT_LEASE_MS))) leaseLost = true;
    } catch {
      leaseLost = true;
    }
  };
  const heartbeatInterval = setInterval(() => {
    if (leaseLost || heartbeatInFlight) return;
    heartbeatInFlight = renewLease().finally(() => { heartbeatInFlight = null; });
  }, Math.max(1000, Math.floor(DEFAULT_LEASE_MS / 3)));
  heartbeatInterval.unref();

  const assertLeaseOwned = async (): Promise<void> => {
    if (heartbeatInFlight) await heartbeatInFlight;
    if (leaseLost || !(await renewDeletionLease(request._id, leaseOwner, DEFAULT_LEASE_MS))) {
      leaseLost = true;
      throw Object.assign(new Error('Deletion worker lease expired'), { code: 'LEASE_EXPIRED' });
    }
  };

  try {
    await assertLeaseOwned();
    await ensurePendingAccount(request);

    if (request.checkpoints?.authArtifacts !== 'complete') {
      await assertLeaseOwned();
      await cleanupAuthArtifacts(request);
      await assertLeaseOwned();
      if (!(await completeDeletionCheckpoint(request._id, leaseOwner, 'authArtifacts'))) {
        throw Object.assign(new Error('Deletion worker lease expired'), { code: 'LEASE_EXPIRED' });
      }
    }

    if (request.checkpoints?.preferencesAndDevices !== 'complete') {
      await assertLeaseOwned();
      await cleanupPreferencesAndDevices(request);
      await assertLeaseOwned();
      if (!(await completeDeletionCheckpoint(request._id, leaseOwner, 'preferencesAndDevices'))) {
        throw Object.assign(new Error('Deletion worker lease expired'), { code: 'LEASE_EXPIRED' });
      }
    }

    if (request.checkpoints?.profileAnonymization !== 'complete') {
      await assertLeaseOwned();
      await anonymizeProfile(request);
      await assertLeaseOwned();
      if (!(await completeDeletionCheckpoint(request._id, leaseOwner, 'profileAnonymization'))) {
        throw Object.assign(new Error('Deletion worker lease expired'), { code: 'LEASE_EXPIRED' });
      }
    }

    if (request.checkpoints?.contactCleanup !== 'complete') {
      await assertLeaseOwned();
      await eraseContactFields(request);
      await assertLeaseOwned();
      if (!(await completeDeletionCheckpoint(request._id, leaseOwner, 'contactCleanup'))) {
        throw Object.assign(new Error('Deletion worker lease expired'), { code: 'LEASE_EXPIRED' });
      }
    }

    if (request.checkpoints?.premiumEntitlement !== 'complete') {
      await assertLeaseOwned();
      await revokeHappiNotesEntitlements(request);
      await assertLeaseOwned();
      if (!(await completeDeletionCheckpoint(request._id, leaseOwner, 'premiumEntitlement'))) {
        throw Object.assign(new Error('Deletion worker lease expired'), { code: 'LEASE_EXPIRED' });
      }
    }

    if (request.checkpoints?.purchaseLedgerDetachment !== 'complete') {
      await assertLeaseOwned();
      await detachPurchaseLedgers(request);
      await assertLeaseOwned();
      if (!(await completeDeletionCheckpoint(request._id, leaseOwner, 'purchaseLedgerDetachment'))) {
        throw Object.assign(new Error('Deletion worker lease expired'), { code: 'LEASE_EXPIRED' });
      }
    }

    // Detached transaction evidence (including provider identifiers/state),
    // support, provider, logs, backups and the minimal audit disposition remain
    // policy-dependent. Stop explicitly instead of claiming completion.
    await assertLeaseOwned();
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
      retryable ? 60 * 1000 : undefined,
    );
    return 'failed';
  } finally {
    emitAccountDeletionsChanged();
    clearInterval(heartbeatInterval);
    if (heartbeatInFlight) await heartbeatInFlight;
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

