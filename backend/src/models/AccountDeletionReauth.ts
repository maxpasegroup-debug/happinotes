import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IAccountDeletionReauth extends Document {
  userId: Types.ObjectId;
  proofHash: string;
  expiresAt: Date;
  usedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const accountDeletionReauthSchema = new Schema<IAccountDeletionReauth>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    proofHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    usedAt: Date,
  },
  { timestamps: true }
);

accountDeletionReauthSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const AccountDeletionReauth = mongoose.model<IAccountDeletionReauth>(
  'AccountDeletionReauth',
  accountDeletionReauthSchema
);
