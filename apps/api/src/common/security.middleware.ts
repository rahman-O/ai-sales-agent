import { HttpException, HttpStatus, Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

const WINDOW_MS = 60_000;
const READ_LIMIT = 120;
const MUTATION_LIMIT = 30;
const MAX_BUCKETS = 10_000;

type Bucket = { count: number; resetAt: number };

/**
 * Small bounded in-process limiter for the single-process API deployment.
 * It deliberately excludes provider webhooks: their controls are HMAC, payload
 * size and receipt deduplication, rather than an unsafe shared-IP bucket.
 */
@Injectable()
export class SecurityHeadersAndRateLimitMiddleware implements NestMiddleware {
  private readonly buckets = new Map<string, Bucket>();

  use(req: Request, res: Response, next: NextFunction) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');

    if (req.path.startsWith('/health/') || req.path.startsWith('/v1/webhooks/')) {
      next();
      return;
    }

    const isMutation = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
    const limit = isMutation ? MUTATION_LIMIT : READ_LIMIT;
    const subject = String(req.headers.authorization ?? req.ip ?? 'anonymous').slice(0, 512);
    const key = `${isMutation ? 'mutation' : 'read'}:${subject}`;
    const now = Date.now();
    const current = this.buckets.get(key);
    const bucket = !current || current.resetAt <= now ? { count: 0, resetAt: now + WINDOW_MS } : current;
    bucket.count += 1;
    this.buckets.set(key, bucket);

    if (this.buckets.size > MAX_BUCKETS) {
      for (const [bucketKey, value] of this.buckets) {
        if (value.resetAt <= now) this.buckets.delete(bucketKey);
        if (this.buckets.size <= MAX_BUCKETS) break;
      }
    }

    res.setHeader('RateLimit-Limit', String(limit));
    res.setHeader('RateLimit-Remaining', String(Math.max(0, limit - bucket.count)));
    res.setHeader('RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));
    if (bucket.count > limit) {
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))));
      throw new HttpException('rate_limit_exceeded', HttpStatus.TOO_MANY_REQUESTS);
    }
    next();
  }
}
