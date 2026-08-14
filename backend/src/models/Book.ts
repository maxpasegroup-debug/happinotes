import mongoose, { Document, Schema } from 'mongoose';

export type BookLanguage = 'english' | 'malayalam' | 'hindi';
export type BookCategory = 'health' | 'wealth' | 'happiness' | 'mindfulness';
export type BookAccessType = 'free' | 'premium';
export type BookStatus = 'draft' | 'upcoming' | 'live';

export interface IBook extends Document {
  title: string;
  description: string;
  language: BookLanguage;
  category: BookCategory;
  coverImageUrl: string;
  coverPublicId: string;
  introAudioUrl: string;
  introAudioPublicId: string;
  introAudioFileName: string;
  totalDurationSeconds: number;
  accessType: BookAccessType;
  status: BookStatus;
  isFeatured: boolean;
  isTrending: boolean;
  sortOrder: number;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

const bookSchema = new Schema<IBook>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    language: {
      type: String,
      enum: ['english', 'malayalam', 'hindi'],
      required: true,
    },
    category: {
      type: String,
      enum: ['health', 'wealth', 'happiness', 'mindfulness'],
      required: true,
    },
    coverImageUrl: { type: String, default: '' },
    coverPublicId: { type: String, default: '' },
    introAudioUrl: { type: String, default: '' },
    introAudioPublicId: { type: String, default: '' },
    introAudioFileName: { type: String, default: '' },
    totalDurationSeconds: { type: Number, default: 0, min: 0 },
    accessType: { type: String, enum: ['free', 'premium'], default: 'free' },
    status: { type: String, enum: ['draft', 'upcoming', 'live'], default: 'draft' },
    isFeatured: { type: Boolean, default: false },
    isTrending: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0 },
    tags: [{ type: String, trim: true }],
  },
  { timestamps: true }
);

bookSchema.index({ title: 'text', description: 'text', tags: 'text' });
bookSchema.index({ status: 1, sortOrder: 1, createdAt: -1 });

export const Book = mongoose.model<IBook>('Book', bookSchema);
