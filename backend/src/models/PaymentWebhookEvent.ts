import mongoose, { Document, Schema } from 'mongoose';

export interface IPaymentWebhookEvent extends Document {
  provider: 'razorpay';
  eventKey: string;
  eventType: string;
  createdAt: Date;
  updatedAt: Date;
}

const paymentWebhookEventSchema = new Schema<IPaymentWebhookEvent>(
  {
    provider: { type: String, enum: ['razorpay'], required: true },
    eventKey: { type: String, required: true, unique: true, index: true },
    eventType: { type: String, required: true },
  },
  { timestamps: true }
);

export const PaymentWebhookEvent = mongoose.model<IPaymentWebhookEvent>(
  'PaymentWebhookEvent',
  paymentWebhookEventSchema
);
