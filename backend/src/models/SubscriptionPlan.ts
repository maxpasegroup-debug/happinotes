import mongoose, { Document, Schema } from 'mongoose';

export type SubscriptionPlanKey = 'monthly' | 'yearly';

export interface ISubscriptionPlan extends Document {
  key: SubscriptionPlanKey;
  /** Legacy shared identifier retained for already-issued store purchases. */
  productId: string;
  storeProductIds?: { android?: string; ios?: string };
  billingPeriod: 'P1M' | 'P1Y';
  priceInr: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<ISubscriptionPlan>({
  key: { type: String, enum: ['monthly', 'yearly'], required: true, unique: true, immutable: true },
  productId: { type: String, required: true, unique: true, immutable: true, trim: true },
  storeProductIds: {
    type: new Schema({
      android: { type: String, trim: true },
      ios: { type: String, trim: true },
    }, { _id: false }),
    default: undefined,
  },
  billingPeriod: { type: String, enum: ['P1M', 'P1Y'], required: true, immutable: true },
  priceInr: { type: Number, min: 0, required: true, default: 0 },
  active: { type: Boolean, default: true },
}, { timestamps: true });

export const SubscriptionPlan = mongoose.model<ISubscriptionPlan>('SubscriptionPlan', schema);
