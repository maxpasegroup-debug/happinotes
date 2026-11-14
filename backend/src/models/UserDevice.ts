import { Schema, model } from 'mongoose';
const schema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  installationId: { type: String, required: true, select: false },
  firstSeen: { type: Date, default: Date.now },
  publicIp: String,
  deviceIp: String,
  networkType: { type: String, enum: ['wifi', 'cellular', 'ethernet', 'vpn', 'none', 'unknown'], default: 'unknown' },
  carrier: String,
  deviceModel: String,
  os: String,
  osVersion: String,
  lastSeen: { type: Date, default: Date.now, index: { expires: 90 * 24 * 60 * 60 } },
  geo: {
    status: String, city: String, region: String, country: String, provider: String,
    latitude: Number, longitude: Number, checkedAt: Date,
  },
}, { versionKey: false });
schema.index({ userId: 1, installationId: 1 }, { unique: true });
schema.index({ userId: 1, lastSeen: -1 });
export const UserDevice = model('UserDevice', schema);
