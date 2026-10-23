import mongoose, { Document, Schema } from 'mongoose';

export type StoreName = 'apple' | 'google';
export type StoreSubscriptionState = 'active' | 'expired' | 'revoked';

export interface IStoreSubscription extends Document {
  userId: mongoose.Types.ObjectId;
  store: StoreName;
  productId: string;
  transactionKey: string;
  latestTransactionId: string | null;
  willRenew: boolean | null;
  purchaseTokenHash: string;
  state: StoreSubscriptionState;
  expiresAt: Date;
  lastVerifiedAt: Date;
  lastStoreEventAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const storeSubscriptionSchema = new Schema<IStoreSubscription>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    store: { type: String, enum: ['apple', 'google'], required: true },
    productId: { type: String, required: true },
    transactionKey: { type: String, required: true },
    latestTransactionId: { type: String, default: null },
    willRenew: { type: Boolean, default: null },
    purchaseTokenHash: { type: String, required: true },
    state: { type: String, enum: ['active', 'expired', 'revoked'], required: true },
    expiresAt: { type: Date, required: true },
    lastVerifiedAt: { type: Date, required: true },
    lastStoreEventAt: { type: Date, default: null },
  },
  { timestamps: true }
);

storeSubscriptionSchema.index({ store: 1, transactionKey: 1 }, { unique: true });
storeSubscriptionSchema.index({ store: 1, purchaseTokenHash: 1 }, { unique: true });

export const StoreSubscription = mongoose.model<IStoreSubscription>(
  'StoreSubscription',
  storeSubscriptionSchema
);
