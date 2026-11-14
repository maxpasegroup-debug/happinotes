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
  locationStatus: { state: String, checkedAt: Date },
  deviceLocation: { type: new Schema({
    latitude: { type: Number, required: true, min: -90, max: 90 },
    longitude: { type: Number, required: true, min: -180, max: 180 },
    accuracy: { type: Number, min: 0, max: 100000, default: null },
    capturedAt: { type: Date, required: true }, receivedAt: { type: Date, required: true },
    consentVersion: { type: Number, required: true, enum: [1] }, mocked: Boolean,
  }, { _id: false }), default: undefined },
  geo: {
    status: String, city: String, region: String, country: String, provider: String,
    latitude: Number, longitude: Number, checkedAt: Date,
  },
}, { versionKey: false });
schema.index({ userId: 1, installationId: 1 }, { unique: true });
schema.index({ userId: 1, lastSeen: -1 });
export const UserDevice = model('UserDevice', schema);
