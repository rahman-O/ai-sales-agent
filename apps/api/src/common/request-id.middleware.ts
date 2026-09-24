import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

export type RequestWithId = Request & { requestId?: string };

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: RequestWithId, res: Response, next: NextFunction) {
    const supplied = req.headers['x-request-id'];
    const id = typeof supplied === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(supplied) ? supplied : randomUUID();
    req.requestId = id;
    res.setHeader('x-request-id', id);
    next();
  }
}
