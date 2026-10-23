import { Document, Schema, model } from 'mongoose';
import type { StoreName } from './StoreSubscription';

export interface IStoreNotificationEvent extends Document {
  store: StoreName;
  eventId: string;
  state: 'processing' | 'processed';
  processedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IStoreNotificationEvent>(
  {
    store: { type: String, enum: ['apple', 'google'], required: true },
    eventId: { type: String, required: true },
    state: { type: String, enum: ['processing', 'processed'], required: true, default: 'processing' },
    processedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

schema.index({ store: 1, eventId: 1 }, { unique: true });

export const StoreNotificationEvent = model<IStoreNotificationEvent>('StoreNotificationEvent', schema);
