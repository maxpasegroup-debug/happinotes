import { Schema, model } from 'mongoose';
const schema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  incidentId: { type: String, required: true }, installationKey: { type: String, required: true },
  publicIp: String, detectedAt: { type: Date, required: true },
  source: { type: String, enum: ['android_network'], required: true },
}, { versionKey: false });
schema.index({ userId: 1, incidentId: 1 }, { unique: true });
export const VpnIncident = model('VpnIncident', schema);
