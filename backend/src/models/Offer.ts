import mongoose, { Document, Schema } from 'mongoose';
import type { PlanId } from '../config/plans';

export type OfferPlanTarget = PlanId | 'all';

export interface IOffer extends Document {
  code?: string;
  discountPercent: number;
  validFrom: Date;
  validUntil: Date;
  isActive: boolean;
  appliesToPlan: OfferPlanTarget;
  createdAt: Date;
  updatedAt: Date;
}

const offerSchema = new Schema<IOffer>(
  {
    code: { type: String, uppercase: true, trim: true },
    discountPercent: { type: Number, required: true, min: 1, max: 100 },
    validFrom: { type: Date, required: true },
    validUntil: { type: Date, required: true },
    isActive: { type: Boolean, default: true },
    appliesToPlan: {
      type: String,
      enum: ['monthly', 'yearly', 'lifetime', 'all'],
      default: 'all',
    },
  },
  { timestamps: true }
);

offerSchema.index({ isActive: 1, validFrom: 1, validUntil: 1 });

export const Offer = mongoose.model<IOffer>('Offer', offerSchema);
