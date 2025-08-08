import express from 'express';
import Joi from 'joi';
import { eventsQueue } from '../queue/bull';
import { apiKeyAuth } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';
import { logger } from '../logger';

const router = express.Router();

const batchSchema = Joi.object({
  orgId: Joi.string().required(),
  projectId: Joi.string().required(),
  events: Joi.array().items(
    Joi.object({
      eventId: Joi.string().optional(),
      userId: Joi.string().required(),
      eventName: Joi.string().required(),
      timestamp: Joi.alternatives().try(Joi.date().iso(), Joi.number()).required(),
      properties: Joi.object().optional()
    })
  ).max(1000).required()
});

router.post('/events', apiKeyAuth, rateLimit, express.json({ limit: '5mb' }), async (req, res) => {
  const body = {
    orgId: req.header('x-org-id') || req.body.orgId,
    projectId: req.header('x-project-id') || req.body.projectId,
    events: req.body.events
  };

  const { error, value } = batchSchema.validate(body);
  if (error) return res.status(400).json({ error: error.message });

  const normalized = value.events.map((ev: any) => ({
    orgId: value.orgId,
    projectId: value.projectId,
    userId: ev.userId,
    eventName: ev.eventName,
    timestamp: new Date(ev.timestamp),
    properties: ev.properties || {},
    eventId: ev.eventId
  }));

  try {
    await eventsQueue.add('ingest-batch', { events: normalized }, { attempts: 3, backoff: { type: 'exponential', delay: 1000 } });
    res.status(202).json({ status: 'accepted', count: normalized.length });
  } catch (err) {
    logger.error('Failed to enqueue events', err);
    res.status(500).json({ error: 'Failed to accept events' });
  }
});

export default router;
