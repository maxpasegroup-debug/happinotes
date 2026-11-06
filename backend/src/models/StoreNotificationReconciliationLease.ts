import mongoose, { Schema } from 'mongoose';

export interface IStoreNotificationReconciliationLease extends mongoose.Document {
  provider: 'google_play';
  lookupKey: string;
  leaseOwner?: string;
  leaseUntil?: Date;
  generation: number;
}

const schema = new Schema<IStoreNotificationReconciliationLease>({
  provider: { type: String, enum: ['google_play'], required: true },
  lookupKey: { type: String, required: true, maxlength: 64 },
  leaseOwner: { type: String, maxlength: 100 },
  leaseUntil: { type: Date },
  generation: { type: Number, default: 0, min: 0, required: true },
}, { timestamps: true, collection: 'store_notification_reconciliation_leases' });

schema.index({ provider: 1, lookupKey: 1 }, { unique: true, name: 'provider_transaction_lease_unique' });
schema.index({ leaseUntil: 1 }, { name: 'expired_transaction_lease_recovery' });

export const StoreNotificationReconciliationLease = mongoose.model<IStoreNotificationReconciliationLease>(
  'StoreNotificationReconciliationLease', schema,
);
