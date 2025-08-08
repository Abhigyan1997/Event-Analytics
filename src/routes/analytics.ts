import express, { Request, Response } from 'express';
import { PipelineStage, SortOrder } from 'mongoose';
import { ParsedQs } from 'qs';
import { EventModel } from '../models/Event';
import { apiKeyAuth } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';
import logger from '../utils/logger';

const router = express.Router();

// -------------------- Funnels --------------------
router.post(
  '/funnels',
  apiKeyAuth,
  rateLimit,
  express.json(),
  async (req: Request, res: Response) => {
    const { steps, from, to } = req.body;
    const apiKey = req.apiKey;

    console.log('API Key in funnel:', apiKey);
    console.log('Request body:', req.body);

    if (!Array.isArray(steps) || steps.length === 0) {
      return res.status(400).json({ error: 'steps required' });
    }

    // Build date range for filtering
    const fromDate = from ? new Date(from) : null;
    const toDate = to
      ? (() => {
        const d = new Date(to);
        d.setUTCHours(23, 59, 59, 999);
        return d;
      })()
      : null;

    try {
      const pipeline: PipelineStage[] = [
        // Ensure timestamp is always a Date type
        {
          $addFields: {
            timestamp: {
              $cond: [
                { $eq: [{ $type: "$timestamp" }, "date"] },
                "$timestamp",
                { $toDate: "$timestamp" }
              ]
            }
          }
        },
        {
          $match: {
            orgId: apiKey?.orgId,
            projectId: apiKey?.projectId,
            eventName: { $in: steps },
            ...(fromDate || toDate
              ? {
                timestamp: {
                  ...(fromDate ? { $gte: fromDate } : {}),
                  ...(toDate ? { $lte: toDate } : {})
                }
              }
              : {})
          }
        },
        {
          $group: {
            _id: { userId: '$userId', eventName: '$eventName' },
            firstTs: { $min: '$timestamp' }
          }
        },
        {
          $group: {
            _id: '$_id.userId',
            events: { $push: { k: '$_id.eventName', v: '$firstTs' } }
          }
        },
        { $project: { events: { $arrayToObject: '$events' } } }
      ];

      console.log('Aggregation pipeline:', JSON.stringify(pipeline, null, 2));

      const users = await EventModel.aggregate(pipeline).allowDiskUse(true).exec();

      const stepCounts = steps.map((s: string) => ({ step: s, users: 0 }));
      const convertedUsers: any[] = [];

      for (const u of users) {
        const evmap = u.events || {};
        let lastTs: Date | null = null;
        let reached = 0;
        let droppedAt: number | null = null;

        for (let i = 0; i < steps.length; i++) {
          const s = steps[i];
          const ts = evmap[s];
          if (ts) {
            const tsDate = new Date(ts);
            if (!lastTs || tsDate >= lastTs) {
              reached++;
              lastTs = tsDate;
            } else {
              droppedAt = i;
              break;
            }
          } else {
            droppedAt = i;
            break;
          }
        }
        for (let i = 0; i < reached; i++) stepCounts[i].users += 1;
        convertedUsers.push({ userId: u._id, reached, droppedAt });
      }

      res.json({
        totalUsers: users.length,
        steps: stepCounts,
        sample: convertedUsers.slice(0, 20)
      });
    } catch (err) {
      logger.error(err);
      res.status(500).json({ error: 'Failed computing funnel' });
    }
  }
);

// -------------------- User Journey --------------------
router.get(
  '/users/:id/journey',
  apiKeyAuth,
  rateLimit,
  async (req: Request, res: Response) => {
    const userId = req.params.id;
    const apiKey = req.apiKey;
    console.log('API Key:', apiKey);
    const limit = Math.min(Number(req.query.limit || 1000), 5000);

    try {
      const events = await EventModel.find({
        userId,
        orgId: apiKey?.orgId,
        projectId: apiKey?.projectId
      })
        .sort({ timestamp: 1 as SortOrder })
        .limit(limit)
        .lean();

      res.json({ userId, count: events.length, events });
    } catch (err) {
      logger.error(err);
      res.status(500).json({ error: 'Failed to fetch journey' });
    }
  }
);

// -------------------- Retention --------------------
router.get(
  '/retention',
  apiKeyAuth,
  rateLimit,
  async (req: Request, res: Response) => {
    const cohortEvent = String(req.query.cohort || 'signup');
    const days = Math.max(1, Math.min(Number(req.query.days || 7), 90));
    const apiKey = req.apiKey;

    try {
      const cohortPipeline: PipelineStage[] = [
        {
          $match: {
            orgId: apiKey?.orgId,
            projectId: apiKey?.projectId,
            eventName: cohortEvent
          }
        },
        { $group: { _id: '$userId', signupAt: { $min: '$timestamp' } } }
      ];
      const cohort = await EventModel.aggregate(cohortPipeline).exec();

      const userIds = cohort.map((c) => c._id);
      if (userIds.length === 0) {
        return res.json({ totalCohort: 0, retention: Array(days).fill(0) });
      }

      const earliestSignup = new Date(
        Math.min(...cohort.map((c) => new Date(c.signupAt).getTime()))
      );
      const latestWindowEnd = new Date(
        earliestSignup.getTime() + days * 24 * 3600 * 1000
      );

      const events = await EventModel.find(
        {
          userId: { $in: userIds },
          orgId: apiKey?.orgId,
          projectId: apiKey?.projectId,
          timestamp: { $gte: earliestSignup, $lte: latestWindowEnd }
        },
        { userId: 1, timestamp: 1 }
      ).lean();

      const signupMap = new Map<string, Date>();
      cohort.forEach((c) => signupMap.set(c._id, new Date(c.signupAt)));

      const retentionCounts = Array.from({ length: days }, () => 0);
      const seenPerUser = new Map<string, Set<number>>();

      for (const ev of events) {
        const s = signupMap.get(ev.userId);
        if (!s) continue;
        const diff = Math.floor(
          (new Date(ev.timestamp).getTime() - s.getTime()) /
          (24 * 3600 * 1000)
        );
        if (diff >= 0 && diff < days) {
          if (!seenPerUser.has(ev.userId))
            seenPerUser.set(ev.userId, new Set());
          const set = seenPerUser.get(ev.userId)!;
          if (!set.has(diff)) {
            set.add(diff);
            retentionCounts[diff] += 1;
          }
        }
      }

      res.json({
        totalCohort: userIds.length,
        days,
        retention: retentionCounts.map((count, day) => ({
          day,
          users: count,
          percent: userIds.length ? count / userIds.length : 0
        }))
      });
    } catch (err) {
      logger.error(err);
      res.status(500).json({ error: 'Failed computing retention' });
    }
  }
);

// -------------------- Metrics --------------------
router.get(
  '/metrics',
  apiKeyAuth,
  rateLimit,
  async (req: Request, res: Response) => {
    const { event, interval = 'daily', from, to } = req.query as ParsedQs & {
      event: string;
      interval?: string;
      from?: string;
      to?: string;
    };

    if (!event) return res.status(400).json({ error: 'event query required' });

    const apiKey = req.apiKey;

    // Date range object for aggregation match
    const dateMatch: any = {};
    if (from) dateMatch.$gte = new Date(from);
    if (to) dateMatch.$lte = new Date(to);

    // Debugging info
    console.log('--- /metrics request debug ---');
    console.log('API Key used:', apiKey);
    console.log('Event:', event);
    console.log('Date filter:', dateMatch);

    try {
      let groupBy: any;
      if (interval === 'daily') {
        groupBy = { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } };
      } else if (interval === 'hourly') {
        groupBy = {
          $dateToString: { format: '%Y-%m-%dT%H:00:00', date: '$timestamp' }
        };
      } else if (interval === 'weekly') {
        groupBy = {
          $concat: [
            { $dateToString: { format: '%Y', date: '$timestamp' } },
            '-W',
            { $toString: { $isoWeek: '$timestamp' } }
          ]
        };
      } else {
        groupBy = { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } };
      }

      const pipeline: PipelineStage[] = [
        {
          $match: {
            orgId: apiKey?.orgId,
            projectId: apiKey?.projectId,
            eventName: event
          }
        },
        // Ensure timestamp is a Date (works if stored as string or Date)
        {
          $addFields: {
            timestamp: { $toDate: '$timestamp' }
          }
        },
        // Apply date filter only if from/to are provided
        ...(from || to
          ? [{ $match: { timestamp: dateMatch } }]
          : []),
        {
          $group: { _id: groupBy, count: { $sum: 1 } }
        },
        { $sort: { _id: 1 as 1 | -1 } }
      ];

      console.log('Aggregation pipeline:', JSON.stringify(pipeline, null, 2));

      const data = await EventModel.aggregate(pipeline).exec();

      console.log('Aggregation results:', data);

      res.json({ event, interval, data });
    } catch (err) {
      logger.error(err);
      console.error('Error fetching metrics:', err);
      res.status(500).json({ error: 'Failed fetching metrics' });
    }
  }
);


export default router;
