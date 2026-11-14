import { Schema, model } from 'mongoose';

// Shared product metadata only: never user IDs, tokens, IPs or device IDs.
const schema = new Schema({
  modelKey: { type: String, required: true, unique: true },
  version: { type: Number, required: true },
  photo: { type: Schema.Types.Mixed, required: true },
  checkedAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
}, { versionKey: false });
export const DeviceReferenceCache = model('DeviceReferenceCache', schema);
