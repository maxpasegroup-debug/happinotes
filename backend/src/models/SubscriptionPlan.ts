import mongoose, { Document, Schema } from 'mongoose';

export type SubscriptionPlanKey = 'monthly' | 'yearly';

export interface ISubscriptionPlan extends Document {
  key: SubscriptionPlanKey;
  /** Legacy shared identifier retained for already-issued store purchases. */
  productId: string;
  storeProductIds?: { android?: string; ios?: string };
  billingPeriod: 'P1M' | 'P1Y';
  priceInr: number;
  pricingDefaultsVersion: number;
  priceVersion: number;
  priceVersionHistory: Array<{
    version: number;
    storeProductIds: { android?: string; ios?: string };
    priceInr: number;
    regionalPricing: Array<{ regionCode: string; currencyCode: string; regularPrice: number; offerPrice: number }>;
    publishedAt: Date;
  }>;
  storeSyncStatus?: {
    android?: { version: number; status: 'live' | 'failed' | 'partial' | 'not_published' | 'unknown'; message?: string; updatedAt: Date };
    ios?: { version: number; status: 'live' | 'failed' | 'partial' | 'not_published' | 'unknown'; message?: string; updatedAt: Date };
  };
  storePriceVersions?: { android?: number; ios?: number };
  regionalPricing: Array<{
    regionCode: string;
    currencyCode: string;
    regularPrice: number;
    offerPrice: number;
    googlePlayAvailable: boolean;
    appleAppStoreAvailable: boolean;
  }>;
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
  pricingDefaultsVersion: { type: Number, min: 0, default: 0 },
  priceVersion: { type: Number, min: 1, default: 1 },
  priceVersionHistory: {
    type: [{
      _id: false,
      version: { type: Number, min: 1, required: true },
      storeProductIds: { type: new Schema({ android: String, ios: String }, { _id: false }), default: {} },
      priceInr: { type: Number, min: 0, default: 0 },
      regionalPricing: { type: [{ _id: false, regionCode: String, currencyCode: String, regularPrice: Number, offerPrice: Number }], default: [] },
      publishedAt: { type: Date, required: true },
    }],
    default: [],
  },
  storeSyncStatus: {
    type: new Schema({
      android: { type: new Schema({ version: Number, status: { type: String, enum: ['live', 'failed', 'partial', 'not_published', 'unknown'] }, message: String, updatedAt: Date }, { _id: false }) },
      ios: { type: new Schema({ version: Number, status: { type: String, enum: ['live', 'failed', 'partial', 'not_published', 'unknown'] }, message: String, updatedAt: Date }, { _id: false }) },
    }, { _id: false }),
    default: () => ({ android: { version: 1, status: 'unknown', updatedAt: new Date() }, ios: { version: 1, status: 'unknown', updatedAt: new Date() } }),
  },
  storePriceVersions: { type: new Schema({ android: Number, ios: Number }, { _id: false }), default: () => ({}) },
  regionalPricing: {
    type: [{
      _id: false,
      regionCode: { type: String, required: true, uppercase: true, trim: true, match: /^[A-Z]{2}$/ },
      currencyCode: { type: String, required: true, uppercase: true, trim: true, match: /^[A-Z]{3}$/ },
      regularPrice: { type: Number, min: 0, required: true },
      offerPrice: { type: Number, min: 0, required: true },
      googlePlayAvailable: { type: Boolean, default: false },
      appleAppStoreAvailable: { type: Boolean, default: false },
    }],
    default: [],
    validate: {
      validator: (rows: Array<{ regionCode: string }>) =>
        new Set(rows.map((row) => row.regionCode)).size === rows.length,
      message: 'Each country or region can only be configured once',
    },
  },
  active: { type: Boolean, default: true },
}, { timestamps: true });

export const SubscriptionPlan = mongoose.model<ISubscriptionPlan>('SubscriptionPlan', schema);
