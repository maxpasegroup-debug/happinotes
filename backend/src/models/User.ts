import mongoose, { Document, Schema } from 'mongoose';

export type UserRole = 'admin' | 'user';

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  subscriptionActive: boolean;
  subscriptionExpiry: Date;
  bookCollection: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ['admin', 'user'], default: 'user' },
    subscriptionActive: { type: Boolean, default: false },
    subscriptionExpiry: { type: Date, default: null },
    bookCollection: [{ type: Schema.Types.ObjectId, ref: 'Book', default: [] }],
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>('User', userSchema);
