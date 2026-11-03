import mongoose, { Schema } from 'mongoose';
import { SubscriptionPlanKey, SubscriptionStore } from './User';

export interface ISubscriptionPurchase extends mongoose.Document {
  store: SubscriptionStore;
  transactionKey: string;
  userId: mongoose.Types.ObjectId;
  planKey: SubscriptionPlanKey;
  productId: string;
  priceVersion?: number;
  active: boolean;
  expiresAt?: Date;
  autoRenewing?: boolean;
  providerStateSignedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<ISubscriptionPurchase>({
  store: { type: String, enum: ['android', 'ios'], required: true },
  transactionKey: { type: String, required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  planKey: { type: String, enum: ['monthly', 'yearly'], required: true },
  productId: { type: String, required: true },
  priceVersion: { type: Number, min: 1 },
  active: { type: Boolean, default: true },
  expiresAt: Date,
  autoRenewing: Boolean,
  providerStateSignedAt: Date,
}, { timestamps: true });

schema.index({ store: 1, transactionKey: 1 }, { unique: true });
schema.index({ userId: 1, active: 1, expiresAt: 1 });

export const SubscriptionPurchase = mongoose.model<ISubscriptionPurchase>('SubscriptionPurchase', schema);
