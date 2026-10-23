import mongoose, { Document, Schema } from 'mongoose';

export interface IOtp extends Document {
  identifier: string;
  purpose: 'password-reset';
  codeHash: string;
  attempts: number;
  expiresAt: Date;
  used: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const otpSchema = new Schema<IOtp>(
  {
    identifier: { type: String, required: true, trim: true, index: true },
    purpose: { type: String, enum: ['password-reset'], required: true },
    codeHash: { type: String, required: true, select: false },
    attempts: { type: Number, required: true, default: 0, min: 0, max: 5 },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
    used: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Otp = mongoose.model<IOtp>('Otp', otpSchema);
