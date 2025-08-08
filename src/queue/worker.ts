import { Worker } from 'bullmq';
import connection from './bull';
import { config } from '../config';
import { EventModel } from '../models/Event';
import { connectMongoose } from '../db/mongoose';
import { logger } from '../logger';

async function main() {
  await connectMongoose();

  const worker = new Worker(config.bullQueueName, async job => {
    const { events } = job.data as { events: any[] };
    if (!Array.isArray(events) || events.length === 0) {
      return;
    }

    const bulk = EventModel.collection.initializeUnorderedBulkOp();
    for (const ev of events) {
      if (ev.eventId) {
        bulk.find({ eventId: ev.eventId, orgId: ev.orgId, projectId: ev.projectId })
          .upsert()
          .updateOne({ $setOnInsert: ev });
      } else {
        bulk.insert(ev);
      }
    }
    try {
      const res = await bulk.execute();
      logger.info(`Worker persisted batch`);
    } catch (err) {
      logger.error('Worker bulk insert error', err);
      try {
        await EventModel.insertMany(events, { ordered: false });
      } catch (e) {
        logger.error('Fallback insertMany failed', e);
      }
    }
  }, { connection });

  worker.on('failed', (job, err) => {
    logger.error(`Job failed ${job?.id}`, err);
  });

  worker.on('completed', job => {
    logger.info(`Job ${job.id} completed`);
  });

  logger.info('Worker started, listening to queue');
}

main().catch(err => {
  logger.error(err);
  process.exit(1);
});
