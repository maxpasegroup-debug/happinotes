import mongoose, { Document, Schema } from 'mongoose';

export type NotificationType = 'admin' | 'new_book' | 'new_episode';
export type NotificationTarget = 'all' | 'free' | 'premium';

export interface INotification extends Document {
  title: string;
  message: string;
  type: NotificationType;
  target: NotificationTarget;
  bookId?: mongoose.Types.ObjectId;
  episodeId?: mongoose.Types.ObjectId;
  imageUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ['admin', 'new_book', 'new_episode'],
      required: true,
    },
    target: {
      type: String,
      enum: ['all', 'free', 'premium'],
      default: 'all',
      required: true,
    },
    bookId: { type: Schema.Types.ObjectId, ref: 'Content' },
    episodeId: { type: Schema.Types.ObjectId, ref: 'Content' },
    imageUrl: { type: String, trim: true },
  },
  { timestamps: true },
);

notificationSchema.index({ createdAt: -1 });

export const Notification = mongoose.model<INotification>(
  'Notification',
  notificationSchema,
);
