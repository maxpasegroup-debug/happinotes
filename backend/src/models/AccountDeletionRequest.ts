import mongoose, { Document, Schema, Types } from 'mongoose';

export const ACCOUNT_DELETION_ACTIVE_STATUSES = [
  'requested',
  'processing',
  'failed_retryable',
  'blocked_policy',
] as const;

export type AccountDeletionStatus =
  | (typeof ACCOUNT_DELETION_ACTIVE_STATUSES)[number]
  | 'failed_manual'
  | 'completed';

export type DeletionCheckpointState = 'pending' | 'complete' | 'deferred_policy';

export interface IAccountDeletionRequest extends Document {
  userId: Types.ObjectId;
  idempotencyKeyHash: string;
  publicReference?: string;
  statusTokenHash?: string;
  source?: 'in_app' | 'external_web';
  reviewStatus?: 'received' | 'under_review';
  processingHistory: Array<{ status: string; actor: string; at: Date }>;
  status: AccountDeletionStatus;
  requestedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  attempts: number;
  nextAttemptAt?: Date;
  leaseUntil?: Date;
  leaseOwner?: string;
  failureCode?: string;
  failureMessage?: string;
  checkpoints: {
    accessBlocked: boolean;
    accessBlockedAt?: Date;
    authArtifacts: DeletionCheckpointState;
    preferencesAndDevices: DeletionCheckpointState;
    personalDataCleanup: DeletionCheckpointState;
    entitlementPolicy: DeletionCheckpointState;
    profileAnonymization: DeletionCheckpointState;
    contactCleanup: DeletionCheckpointState;
    purchaseEvidence: DeletionCheckpointState;
    premiumEntitlement: DeletionCheckpointState;
    supportRecords: DeletionCheckpointState;
    providerData: DeletionCheckpointState;
    logsAndBackups: DeletionCheckpointState;
    auditTrailMinimization: DeletionCheckpointState;
  };
  createdAt: Date;
  updatedAt: Date;
}

const checkpointSchema = new Schema(
  {
    accessBlocked: { type: Boolean, default: false },
    accessBlockedAt: Date,
    authArtifacts: {
      type: String,
      enum: ['pending', 'complete', 'deferred_policy'],
      default: 'pending',
    },
    preferencesAndDevices: {
      type: String,
      enum: ['pending', 'complete', 'deferred_policy'],
      default: 'pending',
    },
    personalDataCleanup: {
      type: String,
      enum: ['pending', 'complete', 'deferred_policy'],
      default: 'deferred_policy',
    },
    entitlementPolicy: {
      type: String,
      enum: ['pending', 'complete', 'deferred_policy'],
      default: 'deferred_policy',
    },
    // Profile/contact/access cleanup has a safe worker path. Purchase evidence,
    // entitlement policy decisions, support/provider/log/backup/audit handling
    // remain deferred until their required decisions are recorded.
    profileAnonymization: { type: String, enum: ['pending', 'complete', 'deferred_policy'], default: 'pending' },
    contactCleanup: { type: String, enum: ['pending', 'complete', 'deferred_policy'], default: 'pending' },
    purchaseEvidence: { type: String, enum: ['pending', 'complete', 'deferred_policy'], default: 'deferred_policy' },
    premiumEntitlement: { type: String, enum: ['pending', 'complete', 'deferred_policy'], default: 'pending' },
    supportRecords: { type: String, enum: ['pending', 'complete', 'deferred_policy'], default: 'deferred_policy' },
    providerData: { type: String, enum: ['pending', 'complete', 'deferred_policy'], default: 'deferred_policy' },
    logsAndBackups: { type: String, enum: ['pending', 'complete', 'deferred_policy'], default: 'deferred_policy' },
    auditTrailMinimization: { type: String, enum: ['pending', 'complete', 'deferred_policy'], default: 'deferred_policy' },
  },
  { _id: false }
);

const processingHistorySchema = new Schema(
  {
    status: { type: String, required: true, maxlength: 40 },
    actor: { type: String, required: true, maxlength: 80 },
    at: { type: Date, required: true, default: Date.now },
  },
  { _id: false }
);

const accountDeletionRequestSchema = new Schema<IAccountDeletionRequest>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    idempotencyKeyHash: { type: String, required: true },
    publicReference: { type: String, trim: true, uppercase: true },
    statusTokenHash: { type: String, select: false },
    source: { type: String, enum: ['in_app', 'external_web'], default: 'in_app' },
    reviewStatus: { type: String, enum: ['received', 'under_review'], default: 'received' },
    processingHistory: { type: [processingHistorySchema], default: [] },
    status: {
      type: String,
      enum: [...ACCOUNT_DELETION_ACTIVE_STATUSES, 'failed_manual', 'completed'],
      default: 'requested',
      required: true,
      index: true,
    },
    requestedAt: { type: Date, default: Date.now, required: true },
    startedAt: Date,
    completedAt: Date,
    attempts: { type: Number, default: 0, min: 0 },
    nextAttemptAt: Date,
    leaseUntil: Date,
    leaseOwner: String,
    // Only sanitized operational classifications belong on this record.
    failureCode: String,
    failureMessage: String,
    checkpoints: { type: checkpointSchema, default: () => ({}) },
  },
  { timestamps: true }
);

// Keep one active workflow per account. Completed/manual records remain for
// idempotency and auditability; no TTL silently removes the history.
accountDeletionRequestSchema.index(
  { userId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: [...ACCOUNT_DELETION_ACTIVE_STATUSES] } },
  }
);
accountDeletionRequestSchema.index({ userId: 1, idempotencyKeyHash: 1 }, { unique: true });
accountDeletionRequestSchema.index({ publicReference: 1 }, { unique: true, sparse: true });

export const AccountDeletionRequest = mongoose.model<IAccountDeletionRequest>(
  'AccountDeletionRequest',
  accountDeletionRequestSchema
);
