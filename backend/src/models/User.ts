import mongoose, { Document, Schema } from 'mongoose';

export type UserRole = 'admin' | 'user';
export type SubscriptionStore = 'android' | 'ios';
export type SubscriptionPlanKey = 'monthly' | 'yearly';
export type AccountDeletionState = 'active' | 'pending' | 'completed';

export interface ISubscriptionEntitlement {
  store: SubscriptionStore;
  planKey: SubscriptionPlanKey;
  productId: string;
  priceVersion?: number;
  transactionKey: string;
  active: boolean;
  expiresAt?: Date;
  autoRenewing?: boolean;
  lastVerifiedAt?: Date;
  /** Latest signed Apple lifecycle state applied for this subscription chain. */
  providerStateSignedAt?: Date;
}

export interface LoginHistoryEntry {
  sessionId: string; startedAt: Date; expiresAt: Date; endedAt?: Date; lastSeen?: Date;
  deviceId?: string; deviceModel?: string; os?: string; osVersion?: string; publicIp?: string;
}
export interface IUser extends Document {
  name: string;
  email?: string;
  phoneNumber?: string;
  password?: string;
  role: UserRole;
  languagePreference: 'all' | 'english' | 'malayalam' | 'hindi';
  bookCollection: mongoose.Types.ObjectId[];
  happyBiteCollection: mongoose.Types.ObjectId[];
  purchasedBooks: mongoose.Types.ObjectId[];
  favourites: { contentId: mongoose.Types.ObjectId; contentType: string }[];
  fcmTokens: string[];
  subscription?: ISubscriptionEntitlement;
  blocked: boolean;
  banExpiresAt?: Date;
  banReason?: string;
  moderationHistory: { action: string; reason: string; actorId: string; at: Date; expiresAt?: Date }[];
  /** Incremented atomically with password changes to revoke prior access tokens. */
  sessionVersion: number;
  vpnDetectionCount: number;
  vpnLastDetectedAt?: Date;
  vpnLastIp?: string;
  activeLoginSessionId?: string;
  loginHistory: LoginHistoryEntry[];
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
    // Deletion cleanup removes credentials and later minimizes the pending
    // account tombstone at the policy gate. New/active accounts require one.
    password: {
      type: String,
      required: function (this: IUser) {
        return this.deletionState !== 'pending' && this.deletionState !== 'completed';
      },
      select: false,
    },
    role: { type: String, enum: ['admin', 'user'], default: 'user' },
    languagePreference: { type: String, enum: ['all', 'english', 'malayalam', 'hindi'], default: 'all' },
    bookCollection: [{ type: Schema.Types.ObjectId, ref: 'Content', default: [] }],
    happyBiteCollection: { type: [{ type: Schema.Types.ObjectId, ref: 'HappyBite' }], default: [] },
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
      priceVersion: { type: Number, min: 1 },
      transactionKey: String,
      active: { type: Boolean, default: false },
      expiresAt: Date,
      autoRenewing: Boolean,
      lastVerifiedAt: Date,
      providerStateSignedAt: Date,
    },
    blocked: { type: Boolean, default: false },
    banExpiresAt: Date,
    banReason: { type: String, maxlength: 500 },
    moderationHistory: { type: [{ action: String, reason: String, actorId: String, at: Date, expiresAt: Date }], default: [], select: false },
    activeLoginSessionId: String,
    loginHistory: { type: [new Schema({ sessionId: String, startedAt: Date, expiresAt: Date, endedAt: Date, lastSeen: Date,
      deviceId: String, deviceModel: String, os: String, osVersion: String, publicIp: String,
    }, { _id: false })], default: [], select: false },
    vpnDetectionCount: { type: Number, default: 0, min: 0 },
    vpnLastDetectedAt: Date,
    vpnLastIp: String,
    sessionVersion: { type: Number, default: 0, min: 0 },
    deletionState: { type: String, enum: ['active', 'pending', 'completed'], default: 'active', index: true },
    deletionRequestedAt: Date,
    deletionCompletedAt: Date,
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>('User', userSchema);
