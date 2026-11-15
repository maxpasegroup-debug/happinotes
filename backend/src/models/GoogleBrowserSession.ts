import { Schema, model } from 'mongoose';

// Only a five-minute handoff. No refresh tokens or application session tokens.
const schema = new Schema({
  sessionHash: { type: String, required: true, unique: true },
  challenge: { type: String, required: true },
  cookieHash: String,
  status: { type: String, enum: ['pending', 'opened', 'ready', 'cancelled'], default: 'pending', required: true },
  sealedToken: { type: String, select: false },
  expiresAt: { type: Date, required: true },
});
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const GoogleBrowserSession = model('GoogleBrowserSession', schema);
