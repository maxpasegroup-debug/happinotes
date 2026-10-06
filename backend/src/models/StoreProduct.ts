import mongoose, { Schema } from 'mongoose';

export type ProvisioningStatus = 'pending' | 'processing' | 'ready' | 'awaiting_review' | 'failed' | 'legacy';
export interface ProductState {
  productId: string;
  status: ProvisioningStatus;
  resourceId?: string;
  storeState?: string;
  error?: string;
  attempts: number;
  nextAttemptAt: Date;
  leaseUntil?: Date;
  leaseOwner?: string;
  lastSyncedAt?: Date;
}
export interface StoreProductRecord {
  bookId: mongoose.Types.ObjectId;
  initialPriceInr?: number;
  pricingPolicy: 'initial_exact_inr_india_only_v1' | 'legacy_preserve';
  android?: ProductState;
  ios?: ProductState;
  createdAt: Date;
  updatedAt: Date;
}
const state = new Schema<ProductState>({
  productId: { type: String, required: true, immutable: true },
  status: { type: String, required: true, enum: ['pending', 'processing', 'ready', 'awaiting_review', 'failed', 'legacy'] },
  resourceId: String, storeState: String, error: String,
  attempts: { type: Number, default: 0 }, nextAttemptAt: { type: Date, default: Date.now },
  leaseUntil: Date, leaseOwner: String, lastSyncedAt: Date,
}, { _id: false });
const schema = new Schema<StoreProductRecord>({
  bookId: { type: Schema.Types.ObjectId, ref: 'Content', required: true, immutable: true, unique: true },
  initialPriceInr: { type: Number, min: 0, immutable: true },
  pricingPolicy: { type: String, required: true, enum: ['initial_exact_inr_india_only_v1', 'legacy_preserve'] },
  android: { type: state }, ios: { type: state },
}, { timestamps: true });
for (const store of ['android', 'ios']) {
  schema.index({ [`${store}.productId`]: 1 }, { unique: true,
    partialFilterExpression: { [`${store}.productId`]: { $type: 'string' } } });
  schema.index({ [`${store}.status`]: 1, [`${store}.nextAttemptAt`]: 1 });
}
export const StoreProduct = mongoose.model<StoreProductRecord>('StoreProduct', schema);
