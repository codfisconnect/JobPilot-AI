import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { logger } from '../utils/logger.js';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const requestId = (req.headers['x-request-id'] as string) || randomUUID();
  (req as any).id = requestId;
  res.setHeader('x-request-id', requestId);

  res.on('finish', () => {
    const durationMs = Date.now() - start;
    logger.info(`${req.method} ${req.originalUrl} - ${res.statusCode} (${durationMs}ms)`, {
      requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs,
      userId: (req as any).user?.userId,
      role: (req as any).user?.role
    });
  });

  next();
}
