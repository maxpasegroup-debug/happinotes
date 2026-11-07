import mongoose, { Schema } from 'mongoose';

export interface IStorePurchase extends mongoose.Document {
  store: 'android' | 'ios';
  transactionKey: string;
  /** Absent only after an approved account-deletion detachment. */
  userId?: mongoose.Types.ObjectId;
  /** Removed from detached claims to avoid retaining a linked content preference. */
  bookId?: mongoose.Types.ObjectId;
  productId: string;
  active: boolean;
  /** Legacy ordering field retained for compatibility; new updates use providerStateVersion. */
  providerEventOrder?: string;
  providerStateVersionAt?: Date;
  providerStateVersion?: number;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IStorePurchase>({
  store: { type: String, enum: ['android', 'ios'], required: true },
  transactionKey: { type: String, required: true },
  // Linked active claims have an owner. A later approved deletion step may
  // remove this direct identity link while preserving the unique claim key.
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: false },
  bookId: { type: Schema.Types.ObjectId, ref: 'Content', required: false },
  productId: { type: String, required: true },
  active: { type: Boolean, default: true },
  providerEventOrder: { type: String },
  providerStateVersionAt: { type: Date },
  providerStateVersion: { type: Number, min: 0 },
}, { timestamps: true });
schema.index({ store: 1, transactionKey: 1 }, { unique: true });
export const StorePurchase = mongoose.model<IStorePurchase>('StorePurchase', schema);
