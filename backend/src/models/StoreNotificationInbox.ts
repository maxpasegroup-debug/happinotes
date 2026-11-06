import mongoose, { Schema } from 'mongoose';

export type NotificationProvider = 'google_play' | 'apple';
export type NotificationClaimType = 'store_purchase' | 'subscription_purchase';
export type NotificationStatus = 'recording' | 'pending' | 'processing' | 'retry' | 'unmatched' | 'processed' | 'blocked';

export interface IStoreNotificationInbox extends mongoose.Document {
  provider: NotificationProvider;
  providerEventId: string;
  claimType: NotificationClaimType;
  claimId?: mongoose.Types.ObjectId;
  /** Google: SHA-256 token key; Apple: the ledger's environment/original-ID key. */
  transactionKey?: string;
  productId: string;
  eventType: string;
  providerEventAt: Date;
  /** Apple signed state time or MongoDB time the fresh Google state was stored. */
  stateVersionAt?: Date;
  /** Google: serialized authoritative-lookup generation; Apple: signed state milliseconds. */
  stateVersion?: number;
  /** Legacy field retained only to safely identify pre-correction inbox rows. */
  providerEventOrder?: string;
  snapshot: {
    active: boolean;
    expiresAt?: Date;
    autoRenewing?: boolean;
    providerStateSignedAt?: Date;
  };
  status: NotificationStatus;
  attempts: number;
  nextAttemptAt: Date;
  leaseOwner?: string;
  leaseUntil?: Date;
  failureCode?: 'PROCESSING_FAILED' | 'CLAIM_UNAVAILABLE' | 'CLAIM_NOT_DETACHED' |
    'ORDERING_AMBIGUOUS' | 'LEGACY_UNORDERED';
  reviewActionCount: number;
  lastReviewAt?: Date;
  lastReviewAction?: 'retry_requested';
  processedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const snapshotSchema = new Schema({
  active: { type: Boolean, required: true },
  expiresAt: { type: Date },
  autoRenewing: { type: Boolean },
  providerStateSignedAt: { type: Date },
}, { _id: false, strict: 'throw' });

const schema = new Schema<IStoreNotificationInbox>({
  provider: { type: String, enum: ['google_play', 'apple'], required: true },
  providerEventId: { type: String, required: true, maxlength: 200 },
  claimType: { type: String, enum: ['store_purchase', 'subscription_purchase'], required: true },
  // This is a ledger row reference only; inbox rows never refer to a User.
  claimId: { type: Schema.Types.ObjectId },
  transactionKey: { type: String, maxlength: 300, select: false },
  productId: { type: String, required: true, maxlength: 200 },
  eventType: { type: String, required: true, maxlength: 100 },
  providerEventAt: { type: Date, required: true },
  stateVersionAt: { type: Date },
  stateVersion: { type: Number, min: 0 },
  providerEventOrder: { type: String, maxlength: 260 },
  snapshot: { type: snapshotSchema, required: true },
  status: { type: String, enum: ['recording', 'pending', 'processing', 'retry', 'unmatched', 'processed', 'blocked'], default: 'pending', required: true },
  attempts: { type: Number, default: 0, min: 0, required: true },
  nextAttemptAt: { type: Date, default: Date.now, required: true },
  leaseOwner: { type: String, maxlength: 100 },
  leaseUntil: { type: Date },
  failureCode: { type: String, enum: ['PROCESSING_FAILED', 'CLAIM_UNAVAILABLE', 'CLAIM_NOT_DETACHED',
    'ORDERING_AMBIGUOUS', 'LEGACY_UNORDERED'] },
  reviewActionCount: { type: Number, default: 0, min: 0, required: true },
  lastReviewAt: { type: Date },
  lastReviewAction: { type: String, enum: ['retry_requested'] },
  processedAt: { type: Date },
}, {
  timestamps: true,
  collection: 'store_notification_inbox',
  strict: 'throw',
});

schema.index({ provider: 1, providerEventId: 1 }, { unique: true, name: 'provider_event_unique' });
schema.index({ status: 1, nextAttemptAt: 1, providerEventAt: 1, createdAt: 1 },
  { name: 'pending_notification_worker' });
schema.index({ status: 1, leaseUntil: 1 }, { name: 'expired_notification_lease_recovery' });

export const StoreNotificationInbox = mongoose.model<IStoreNotificationInbox>(
  'StoreNotificationInbox', schema,
);
