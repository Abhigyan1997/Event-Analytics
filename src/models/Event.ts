import mongoose, { Schema, Document } from 'mongoose';

export interface IEvent extends Document {
  orgId: string;
  projectId: string;
  userId: string;
  eventName: string;
  timestamp: Date;
  properties?: Record<string, any>;
  eventId?: string;
}

const EventSchema = new Schema<IEvent>({
  orgId: { type: String, required: true, index: true },
  projectId: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  eventName: { type: String, required: true, index: true },
  timestamp: { type: Date, required: true, index: true },
  properties: { type: Schema.Types.Mixed },
  eventId: { type: String, index: true },
}, { timestamps: true });

EventSchema.index({ orgId: 1, projectId: 1, timestamp: -1 });

export const EventModel = mongoose.model<IEvent>('Event', EventSchema);
