import mongoose from 'mongoose';
import { config } from '../config';
import { logger } from '../logger';

export async function connectMongoose() {
  logger.info('Connecting to MongoDB...');
  await mongoose.connect(config.mongoUri);
  logger.info('Connected to MongoDB');
}
