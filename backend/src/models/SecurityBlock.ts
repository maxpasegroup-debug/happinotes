import { Schema, model } from 'mongoose';
const schema = new Schema({
  kind: { type: String, enum: ['installation', 'email', 'ip'], required: true },
  key: { type: String, required: true }, active: { type: Boolean, default: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  reason: { type: String, required: true, maxlength: 500 }, actor: String,
}, { timestamps: true, versionKey: false });
schema.index({ kind: 1, key: 1 }, { unique: true });
export const SecurityBlock = model('SecurityBlock', schema);
