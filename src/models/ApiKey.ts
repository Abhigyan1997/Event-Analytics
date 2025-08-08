import mongoose, { Schema, Document } from 'mongoose';

export interface IApiKey extends Document {
  key: string;
  orgId: string;
  projectId: string;
  name?: string;
  createdAt: Date;
  rateLimitPerMinute?: number;
}

const ApiKeySchema = new Schema<IApiKey>({
  key: { type: String, required: true, unique: true },
  orgId: { type: String, required: true },
  projectId: { type: String, required: true },
  name: { type: String },
  createdAt: { type: Date, default: () => new Date() },
  rateLimitPerMinute: { type: Number, default: 1200 }
});

export const ApiKeyModel = mongoose.model<IApiKey>('ApiKey', ApiKeySchema);
