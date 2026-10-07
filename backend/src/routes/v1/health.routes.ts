import { Router } from 'express';
import { checkDatabaseConnection } from '../../database/prisma.js';
import { env } from '../../config/env.js';

export const healthRouter = Router();

healthRouter.get('/health', async (req, res) => {
  const dbHealth = await checkDatabaseConnection();

  const isHealthy = dbHealth.connected;

  res.status(isHealthy ? 200 : 503).json({
    success: true,
    data: {
      status: isHealthy ? 'healthy' : 'degraded',
      environment: env.NODE_ENV,
      database: {
        engine: 'PostgreSQL',
        connected: dbHealth.connected,
        latencyMs: dbHealth.latencyMs,
        error: dbHealth.error
      },
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString()
    },
    meta: {
      requestId: (req as any).id,
      timestamp: new Date().toISOString()
    }
  });
});

healthRouter.get('/ready', async (req, res) => {
  const dbHealth = await checkDatabaseConnection();
  if (!dbHealth.connected) {
    return res.status(503).json({
      success: false,
      error: { code: 'DATABASE_UNAVAILABLE', message: 'Readiness check failed: Database unreachable' }
    });
  }

  res.status(200).json({
    success: true,
    data: {
      status: 'ready',
      version: '1.0.0',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString()
    }
  });
});
