import { Request, Response, NextFunction } from 'express';
import { ApiKeyModel } from '../models/ApiKey';
import { config } from '../config';
import { logger } from '../logger';

export async function apiKeyAuth(req: Request, res: Response, next: NextFunction) {
  const key = (req.header('x-api-key') || '').trim();

  if (!key) {
    return res.status(401).json({ error: 'Missing API Key' });
  }

  if (key === config.adminApiKey) {
    req['apiKey'] = { key, orgId: req.header('x-org-id') || 'org_local', projectId: req.header('x-project-id') || 'proj_local', rateLimitPerMinute: 2000 };
    return next();
  }

  try {
    const model = await ApiKeyModel.findOne({ key }).lean();
    if (!model) {
      return res.status(403).json({ error: 'Invalid API Key' });
    }
    req['apiKey'] = model;
    next();
  } catch (err) {
    logger.error('apiKeyAuth error', err);
    res.status(500).json({ error: 'Auth failure' });
  }
}
