import { Schema, model } from 'mongoose';
const schema = new Schema({
  kind: { type: String, enum: ['installation', 'email', 'ip'], required: true },
  key: { type: String, required: true }, active: { type: Boolean, default: true },
  // Active blocks retain only their hashed enforcement key after account erasure.
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
  reason: { type: String, required: true, maxlength: 500 }, actor: String,
}, { timestamps: true, versionKey: false });
schema.index({ kind: 1, key: 1 }, { unique: true });
export const SecurityBlock = model('SecurityBlock', schema);
