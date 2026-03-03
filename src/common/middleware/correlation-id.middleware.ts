import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const correlationId = (req.headers['x-request-id'] as string) || randomUUID();
  req.headers['x-request-id'] = correlationId;
  res.setHeader('X-Request-ID', correlationId);
  next();
}
