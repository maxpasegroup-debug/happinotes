import mongoose, { Document, Schema } from 'mongoose';

export interface IOtp extends Document {
  identifier: string;
  purpose: 'signup' | 'login' | 'reset-pin' | 'email-signup' | 'email-login';
  otp: string;
  expiresAt: Date;
  used: boolean;
  attempts: number;
  createdAt: Date;
}

const otpSchema = new Schema<IOtp>(
  {
    identifier: { type: String, required: true, trim: true, index: true },
    purpose: { type: String, enum: ['signup', 'login', 'reset-pin', 'email-signup', 'email-login'], required: true },
    otp: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
    used: { type: Boolean, default: false },
    // Defaults apply to new records and hydrated legacy records. Atomic email
    // OTP queries also accept a missing field so existing documents remain valid.
    attempts: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

export const Otp = mongoose.model<IOtp>('Otp', otpSchema);
