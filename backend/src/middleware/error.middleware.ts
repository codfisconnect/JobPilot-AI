import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void {
  const requestId = (req.headers['x-request-id'] as string) || (req as any).id || undefined;

  // 1. Zod Validation Errors
  if (err instanceof ZodError) {
    const formattedIssues = err.issues.map(issue => ({
      field: issue.path.join('.'),
      message: issue.message,
      code: issue.code
    }));

    logger.warn(`Validation Error on ${req.method} ${req.path}`, {
      requestId,
      method: req.method,
      path: req.path,
      statusCode: 400,
      details: formattedIssues
    });

    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data provided',
        details: formattedIssues
      }
    });
    return;
  }

  // 2. Custom AppErrors (Operational)
  if (err instanceof AppError) {
    logger.warn(`Operational Error [${err.code}]: ${err.message}`, {
      requestId,
      statusCode: err.statusCode,
      method: req.method,
      path: req.path,
      details: err.details
    });

    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details
      }
    });
    return;
  }

  // 3. Prisma / Database Known Errors
  if ((err as any).code === 'P2002') {
    logger.warn(`Prisma Unique Constraint Violation`, {
      requestId,
      method: req.method,
      path: req.path,
      target: (err as any).meta?.target
    });

    res.status(409).json({
      success: false,
      error: {
        code: 'CONFLICT',
        message: 'A resource with this identifier already exists',
        details: (err as any).meta?.target
      }
    });
    return;
  }

  // 4. Unhandled / Unexpected Server Errors
  logger.error(`Unhandled Exception on ${req.method} ${req.path}: ${err.message}`, err, {
    requestId,
    method: req.method,
    path: req.path,
    statusCode: 500
  });

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: env.NODE_ENV === 'production'
        ? 'An unexpected error occurred. Please try again later.'
        : err.message
    }
  });
}
