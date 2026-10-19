import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { env } from '../config/env.js';
import { UnauthorizedError } from '../utils/errors.js';

/**
 * Middleware protecting internal scheduler endpoints (e.g. GitHub Actions cron runner).
 * Requires JOB_SYNC_CRON_SECRET via `x-job-sync-secret` or `Authorization: Bearer <secret>`.
 * Uses timing-safe string comparison to prevent timing side-channel attacks.
 * Never logs secret values.
 */
export function requireSchedulerSecret(req: Request, res: Response, next: NextFunction): void {
  const configuredSecret = env.JOB_SYNC_CRON_SECRET || process.env.JOB_SYNC_CRON_SECRET;

  if (!configuredSecret || configuredSecret.trim().length === 0) {
    // If no secret configured, reject all scheduler requests for safety
    res.status(401).json({
      success: false,
      error: 'Scheduler endpoint is disabled: missing JOB_SYNC_CRON_SECRET in environment.'
    });
    return;
  }

  // Check x-job-sync-secret header first, then Authorization Bearer fallback
  let suppliedSecret = req.headers['x-job-sync-secret'] as string | undefined;

  if (!suppliedSecret) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      suppliedSecret = authHeader.slice(7).trim();
    }
  }

  if (!suppliedSecret) {
    res.status(401).json({
      success: false,
      error: 'Missing required scheduler secret header (x-job-sync-secret or Authorization Bearer).'
    });
    return;
  }

  // Constant-time buffer comparison to prevent timing attacks
  const expectedBuffer = Buffer.from(configuredSecret);
  const suppliedBuffer = Buffer.from(suppliedSecret);

  if (expectedBuffer.length !== suppliedBuffer.length) {
    res.status(403).json({
      success: false,
      error: 'Invalid scheduler secret.'
    });
    return;
  }

  const isMatch = crypto.timingSafeEqual(expectedBuffer, suppliedBuffer);
  if (!isMatch) {
    res.status(403).json({
      success: false,
      error: 'Invalid scheduler secret.'
    });
    return;
  }

  next();
}
