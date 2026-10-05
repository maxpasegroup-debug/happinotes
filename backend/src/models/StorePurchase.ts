import mongoose, { Schema } from 'mongoose';

const schema = new Schema({
  store: { type: String, enum: ['android', 'ios'], required: true },
  transactionKey: { type: String, required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  bookId: { type: Schema.Types.ObjectId, ref: 'Content', required: true },
  productId: { type: String, required: true },
  active: { type: Boolean, default: true },
}, { timestamps: true });
schema.index({ store: 1, transactionKey: 1 }, { unique: true });
export const StorePurchase = mongoose.model('StorePurchase', schema);
