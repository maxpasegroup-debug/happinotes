import mongoose, { Schema } from 'mongoose';
import { SubscriptionPlanKey, SubscriptionStore } from './User';

export interface ISubscriptionPurchase extends mongoose.Document {
  store: SubscriptionStore;
  transactionKey: string;
  /** Absent only after an approved account-deletion detachment. */
  userId?: mongoose.Types.ObjectId;
  planKey: SubscriptionPlanKey;
  productId: string;
  priceVersion?: number;
  active: boolean;
  expiresAt?: Date;
  autoRenewing?: boolean;
  providerStateSignedAt?: Date;
  /** Legacy ordering field retained for compatibility; new updates use providerStateVersion. */
  providerEventOrder?: string;
  providerStateVersionAt?: Date;
  providerStateVersion?: number;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<ISubscriptionPurchase>({
  store: { type: String, enum: ['android', 'ios'], required: true },
  transactionKey: { type: String, required: true },
  // Linked active claims have an owner. A later approved deletion step may
  // remove this direct identity link while preserving the unique claim key.
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: false },
  planKey: { type: String, enum: ['monthly', 'yearly'], required: true },
  productId: { type: String, required: true },
  priceVersion: { type: Number, min: 1 },
  active: { type: Boolean, default: true },
  expiresAt: Date,
  autoRenewing: Boolean,
  providerStateSignedAt: Date,
  providerEventOrder: { type: String },
  providerStateVersionAt: { type: Date },
  providerStateVersion: { type: Number, min: 0 },
}, { timestamps: true });

schema.index({ store: 1, transactionKey: 1 }, { unique: true });
schema.index({ userId: 1, active: 1, expiresAt: 1 });

export const SubscriptionPurchase = mongoose.model<ISubscriptionPurchase>('SubscriptionPurchase', schema);
