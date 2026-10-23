import mongoose, { Document, Schema } from 'mongoose';

export type UserRole = 'admin' | 'user';
export type LanguagePreference = 'english' | 'malayalam' | 'hindi' | 'all';
export type SubscriptionStatus = 'free' | 'premium' | 'lifetime';

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  languagePreference: LanguagePreference;
  subscriptionStatus: SubscriptionStatus;
  subscriptionExpiry: Date | null;
  subscriptionSource: 'admin' | 'apple' | 'google' | null;
  storeAccountToken: string | null;
  googleObfuscatedAccountId: string | null;
  expoPushToken: string | null;
  bookCollection: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, sparse: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ['admin', 'user'], default: 'user' },
    languagePreference: {
      type: String,
      enum: ['english', 'malayalam', 'hindi', 'all'],
      default: 'all',
    },
    subscriptionStatus: {
      type: String,
      enum: ['free', 'premium', 'lifetime'],
      default: 'free',
    },
    subscriptionExpiry: { type: Date, default: null },
    subscriptionSource: { type: String, enum: ['admin', 'apple', 'google'], default: null },
    storeAccountToken: { type: String, default: null, select: false },
    googleObfuscatedAccountId: { type: String, default: null, select: false },
    expoPushToken: { type: String, default: null },
    bookCollection: [{ type: Schema.Types.ObjectId, ref: 'Book', default: [] }],
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>('User', userSchema);
