import mongoose, { Document, Schema } from 'mongoose';

export interface IHappyBite extends Document {
  title: string;
  description: string;
  thumbnailUrl: string;
  audioUrl: string;
  durationSeconds: number;
  category: string;
  accessType: 'free' | 'premium';
  published: boolean;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IHappyBite>({
  title: { type: String, required: true, trim: true, maxlength: 160 },
  description: { type: String, required: true, trim: true, maxlength: 2000 },
  thumbnailUrl: { type: String, required: true, trim: true },
  audioUrl: { type: String, required: true, trim: true },
  durationSeconds: { type: Number, required: true, min: 0, default: 0 },
  category: { type: String, required: true, trim: true, maxlength: 80 },
  accessType: { type: String, enum: ['free', 'premium'], default: 'free' },
  published: { type: Boolean, default: false, index: true },
  displayOrder: { type: Number, default: 0, min: 0, index: true },
}, { timestamps: true });

schema.index({ published: 1, displayOrder: 1, createdAt: -1 });

export const HappyBite = mongoose.model<IHappyBite>('HappyBite', schema);
