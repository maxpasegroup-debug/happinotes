import mongoose, { Document, Schema } from 'mongoose';

export type BookStatus = 'upcoming' | 'live';
export type BookType = 'free' | 'premium';

export interface IBook extends Document {
  title: string;
  description: string;
  coverImage: string;
  audioUrl: string;
  status: BookStatus;
  type: BookType;
  createdAt: Date;
  updatedAt: Date;
}

const bookSchema = new Schema<IBook>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    coverImage: { type: String, default: '' },
    audioUrl: { type: String, default: '' },
    status: { type: String, enum: ['upcoming', 'live'], default: 'live' },
    type: { type: String, enum: ['free', 'premium'], default: 'free' },
  },
  { timestamps: true }
);

export const Book = mongoose.model<IBook>('Book', bookSchema);
