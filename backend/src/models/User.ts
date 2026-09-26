import mongoose, { Document, Schema } from 'mongoose';

export type UserRole = 'admin' | 'user';

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
  blocked: boolean;
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
    blocked: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>('User', userSchema);
