import mongoose, { Document, Schema } from 'mongoose';

export interface IOtp extends Document {
  email: string;
  otp: string;
  expiresAt: Date;
  used: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const otpSchema = new Schema<IOtp>(
  {
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    otp: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
    used: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Otp = mongoose.model<IOtp>('Otp', otpSchema);
