import mongoose, { Document, Schema } from 'mongoose';

export type UserRole = 'admin' | 'user';
export type SubscriptionStore = 'android' | 'ios';
export type SubscriptionPlanKey = 'monthly' | 'yearly';
export type AccountDeletionState = 'active' | 'pending' | 'completed';

export interface ISubscriptionEntitlement {
  store: SubscriptionStore;
  planKey: SubscriptionPlanKey;
  productId: string;
  transactionKey: string;
  active: boolean;
  expiresAt?: Date;
  autoRenewing?: boolean;
  lastVerifiedAt?: Date;
}

export interface IUser extends Document {
  name: string;
  email?: string;
  phoneNumber?: string;
  password: string;
  role: UserRole;
  languagePreference: 'all' | 'english' | 'malayalam' | 'hindi';
  bookCollection: mongoose.Types.ObjectId[];
  purchasedBooks: mongoose.Types.ObjectId[];
  favourites: { contentId: mongoose.Types.ObjectId; contentType: string }[];
  fcmTokens: string[];
  subscription?: ISubscriptionEntitlement;
  blocked: boolean;
  /**
   * Missing on legacy documents means active.  The deletion workflow sets
   * this before any cleanup so existing JWTs are rejected by middleware.
   */
  deletionState: AccountDeletionState;
  deletionRequestedAt?: Date;
  deletionCompletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    phoneNumber: { type: String, unique: true, sparse: true, trim: true },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ['admin', 'user'], default: 'user' },
    languagePreference: { type: String, enum: ['all', 'english', 'malayalam', 'hindi'], default: 'all' },
    bookCollection: [{ type: Schema.Types.ObjectId, ref: 'Content', default: [] }],
    purchasedBooks: [{ type: Schema.Types.ObjectId, ref: 'Content', default: [] }],
    favourites: {
      type: [
        {
          contentId: { type: Schema.Types.ObjectId, ref: 'Content', required: true },
          contentType: { type: String, required: true },
        },
      ],
      default: [],
    },
    fcmTokens: { type: [String], default: [] },
    subscription: {
      store: { type: String, enum: ['android', 'ios'] },
      planKey: { type: String, enum: ['monthly', 'yearly'] },
      productId: String,
      transactionKey: String,
      active: { type: Boolean, default: false },
      expiresAt: Date,
      autoRenewing: Boolean,
      lastVerifiedAt: Date,
    },
    blocked: { type: Boolean, default: false },
    deletionState: { type: String, enum: ['active', 'pending', 'completed'], default: 'active', index: true },
    deletionRequestedAt: Date,
    deletionCompletedAt: Date,
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>('User', userSchema);
