import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: process.env.PORT ? Number(process.env.PORT) : 3000,
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/event_analytics',
  redisUrl: process.env.REDIS_HOST || 'redis://127.0.0.1:6379',
  bullQueueName: process.env.BULL_QUEUE_NAME || 'events-queue',
  adminApiKey: process.env.ADMIN_API_KEY || 'local_admin_key_please_change',
  logLevel: process.env.LOG_LEVEL || 'info',
};
