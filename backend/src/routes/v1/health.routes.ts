import { Router } from 'express';
import { checkDatabaseConnection } from '../../database/prisma.js';
import { env } from '../../config/env.js';
import { EmailService } from '../../services/email/email.service.js';

export const healthRouter = Router();

healthRouter.get('/health', async (req, res) => {
  const dbHealth = await checkDatabaseConnection();
  const { resumeStorage } = await import('../../storage/index.js');
  const storageHealth = resumeStorage.checkHealth
    ? await resumeStorage.checkHealth()
    : { status: 'READY' as const, provider: 'local', bucket: undefined, message: 'Local storage operational' };

  const isHealthy = dbHealth.connected && storageHealth.status !== 'UNAVAILABLE';

  res.status(isHealthy ? 200 : 503).json({
    success: true,
    data: {
      status: isHealthy ? 'healthy' : 'degraded',
      environment: env.NODE_ENV,
      gitCommit: process.env.RENDER_GIT_COMMIT || process.env.COMMIT_REF || '8884327',
      email: {
        provider: EmailService.getProvider().name,
        smtpConfigured: EmailService.getProvider().name !== 'IN_MEMORY_DEV_PROVIDER',
        smtpHostSet: Boolean(env.SMTP_HOST || process.env.SMTP_HOST),
        smtpUserSet: Boolean(env.SMTP_USER || process.env.SMTP_USER),
        smtpPassSet: Boolean(env.SMTP_PASS || process.env.SMTP_PASS),
        senderEmailSet: Boolean(env.SMTP_FROM_EMAIL || process.env.SMTP_FROM_EMAIL || env.SMTP_USER || process.env.SMTP_USER)
      },
      database: {
        engine: 'PostgreSQL',
        connected: dbHealth.connected,
        latencyMs: dbHealth.latencyMs,
        error: dbHealth.error
      },
      storage: {
        provider: storageHealth.provider,
        status: storageHealth.status,
        bucket: storageHealth.bucket,
        message: storageHealth.message
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
