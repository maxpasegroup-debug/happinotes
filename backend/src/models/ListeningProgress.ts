import mongoose, { Document, Schema } from 'mongoose';

export interface IListeningProgress extends Document {
  userId: mongoose.Types.ObjectId;
  bookId: mongoose.Types.ObjectId;
  chapterId: mongoose.Types.ObjectId;
  positionSeconds: number;
  completed: boolean;
  updatedAt: Date;
  createdAt: Date;
}

const listeningProgressSchema = new Schema<IListeningProgress>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    bookId: { type: Schema.Types.ObjectId, ref: 'Book', required: true, index: true },
    chapterId: { type: Schema.Types.ObjectId, ref: 'Chapter', required: true },
    positionSeconds: { type: Number, default: 0, min: 0 },
    completed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

listeningProgressSchema.index({ userId: 1, bookId: 1 }, { unique: true });

export const ListeningProgress = mongoose.model<IListeningProgress>(
  'ListeningProgress',
  listeningProgressSchema
);
