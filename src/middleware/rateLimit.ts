import { Request, Response, NextFunction } from 'express';
import IORedis from 'ioredis';
import { config } from '../config';

const redis = new IORedis(config.redisUrl);

export async function rateLimit(req: Request, res: Response, next: NextFunction) {
  const apiKey = req['apiKey'];
  if (!apiKey) return res.status(401).json({ error: 'Missing api key' });

  const key = `rate:${apiKey.key}:${Math.floor(Date.now() / 60000)}`;
  const limit = apiKey.rateLimitPerMinute || 1200;

  const tx = redis.multi();
  tx.incr(key);
  tx.expire(key, 65);
  const results = await tx.exec();
  const count = results && results[0] ? Number(results[0][1]) : 0;
  if (count > limit) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }
  next();
}
