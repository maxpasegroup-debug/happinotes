import mongoose, { Document, Schema } from 'mongoose';

export interface IOtp extends Document {
  identifier: string;
  purpose: 'signup' | 'reset-pin' | 'login';
  otp: string;
  expiresAt: Date;
  used: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const otpSchema = new Schema<IOtp>(
  {
    identifier: { type: String, required: true, trim: true, index: true },
    purpose: { type: String, enum: ['signup', 'reset-pin', 'login'], required: true },
    otp: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
    used: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Otp = mongoose.model<IOtp>('Otp', otpSchema);
