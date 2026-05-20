import mongoose, { Document, Schema } from 'mongoose';

export interface IChapter extends Document {
  bookId: mongoose.Types.ObjectId;
  title: string;
  chapterNumber: number;
  description: string;
  audioUrl: string;
  audioPublicId: string;
  durationSeconds: number;
  isFreePreview: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const chapterSchema = new Schema<IChapter>(
  {
    bookId: { type: Schema.Types.ObjectId, ref: 'Book', required: true, index: true },
    title: { type: String, required: true, trim: true },
    chapterNumber: { type: Number, required: true, min: 1 },
    description: { type: String, default: '', trim: true },
    audioUrl: { type: String, default: '' },
    audioPublicId: { type: String, default: '' },
    durationSeconds: { type: Number, default: 0, min: 0 },
    isFreePreview: { type: Boolean, default: false },
  },
  { timestamps: true }
);

chapterSchema.index({ bookId: 1, chapterNumber: 1 }, { unique: true });

export const Chapter = mongoose.model<IChapter>('Chapter', chapterSchema);
