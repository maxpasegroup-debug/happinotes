import mongoose, { Document, Schema } from 'mongoose';

export interface IOtp extends Document {
  identifier: string;
  purpose: 'signup' | 'login' | 'reset-pin';
  otp: string;
  expiresAt: Date;
  used: boolean;
}

const otpSchema = new Schema<IOtp>(
  {
    identifier: { type: String, required: true, trim: true, index: true },
    purpose: { type: String, enum: ['signup', 'login', 'reset-pin'], required: true },
    otp: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
    used: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Otp = mongoose.model<IOtp>('Otp', otpSchema);
