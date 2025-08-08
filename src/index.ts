import express from 'express';
import morgan from 'morgan';
import helmet from 'helmet';
import eventsRouter from './routes/events';
import analyticsRouter from './routes/analytics';
import { connectMongoose } from './db/mongoose';
import { config } from './config';
import { logger } from './logger';
import swaggerUi from 'swagger-ui-express';
import swaggerDocument from './swagger.json';
import { errorHandler } from './middleware/errorHandler';
import { ApiKeyModel } from './models/ApiKey';

async function start() {
  await connectMongoose();

  const existing = await ApiKeyModel.findOne({ key: config.adminApiKey }).lean();
  if (!existing) {
    await ApiKeyModel.create({ key: config.adminApiKey, orgId: 'org_local', projectId: 'proj_local', name: 'default-admin', rateLimitPerMinute: 5000 });
    logger.info('Created local admin API key (for dev)');
  }

  const app = express();
  app.use(helmet());
  app.use(morgan('dev'));
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

  app.use(eventsRouter);
  app.use(analyticsRouter);

  app.use(errorHandler);

  app.listen(config.port, () => {
    logger.info(`Server listening on port ${config.port}`);
  });
}

start().catch(err => {
  logger.error(err);
  process.exit(1);
});
