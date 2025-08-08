import 'express';
import { IApiKey } from '../../models/ApiKey';

declare module 'express-serve-static-core' {
    interface Request {
        apiKey?: Partial<IApiKey> & {
            rateLimitPerMinute?: number;
        };
    }
}