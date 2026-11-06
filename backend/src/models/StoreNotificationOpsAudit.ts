import mongoose, { Schema } from 'mongoose';

export type StoreNotificationOpsAction = 'list_blocked' | 'retry' | 'other';
export type StoreNotificationOpsOutcome = 'started' | 'success' | 'rejected' | 'failure' | 'unknown';

export interface IStoreNotificationOpsAudit extends mongoose.Document {
  operatorId?: mongoose.Types.ObjectId;
  action: StoreNotificationOpsAction;
  outcome: StoreNotificationOpsOutcome;
  httpStatus?: number;
  completedAt?: Date;
  createdAt: Date;
}

const schema = new Schema<IStoreNotificationOpsAudit>({
  operatorId: { type: Schema.Types.ObjectId, ref: 'User' },
  action: { type: String, enum: ['list_blocked', 'retry', 'other'], required: true },
  outcome: { type: String, enum: ['started', 'success', 'rejected', 'failure', 'unknown'], required: true },
  httpStatus: { type: Number, min: 100, max: 599 },
  completedAt: { type: Date },
}, {
  timestamps: { createdAt: true, updatedAt: false },
  collection: 'store_notification_ops_audit',
  strict: 'throw',
});

schema.index({ createdAt: -1 }, { name: 'ops_audit_created_at' });
schema.index({ operatorId: 1, createdAt: -1 }, { name: 'ops_audit_operator_created_at' });
schema.index({ outcome: 1, createdAt: 1 }, { name: 'ops_audit_outcome_created_at' });

export const StoreNotificationOpsAudit = mongoose.model<IStoreNotificationOpsAudit>(
  'StoreNotificationOpsAudit', schema,
);
