import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { config } from '../config';

const connection = new IORedis(config.redisUrl);

export const eventsQueue = new Queue(config.bullQueueName, { connection });

export default connection;
