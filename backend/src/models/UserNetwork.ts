import { Schema, model } from 'mongoose';
const schema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
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
export const UserNetwork = model('UserNetwork', schema);
