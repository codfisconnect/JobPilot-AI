import { prisma } from '../database/prisma.js';
import { logger } from '../utils/logger.js';
import { SourceHealth } from '@prisma/client';
import { JobSourceDiscoveryService, DiscoveryResult, SyncOutcome } from './jobSourceDiscovery.service.js';
import crypto from 'crypto';

export interface SchedulerRunResult {
  totalSources: number;
  processedSources: number;
  successfulSources: number;
  failedSources: number;
  jobsCreated: number;
  jobsUpdated: number;
  jobsExpired: number;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  details: {
    configId: string;
    companyName: string;
    sourceType: string;
    status: 'SUCCESS' | 'FAILED' | 'SKIPPED' | 'ALREADY_RUNNING';
    created?: number;
    updated?: number;
    expired?: number;
    error?: string;
  }[];
}

export class JobSourceSchedulerService {
  private static readonly GLOBAL_LOCK_ID = 918273645; // Deterministic BigInt key for PostgreSQL advisory lock
  private static readonly MAX_CONCURRENCY = 4; // Bounded worker concurrency
  private static readonly STALE_THRESHOLD_DAYS = 14;

  /**
   * Acquire a PostgreSQL session-level or transaction advisory lock for global scheduler runs.
   */
  private static async acquireGlobalLock(): Promise<boolean> {
    try {
      const result = await prisma.$queryRaw<[{ pg_try_advisory_lock: boolean }]>`
        SELECT pg_try_advisory_lock(${this.GLOBAL_LOCK_ID}) as pg_try_advisory_lock;
      `;
      return Boolean(result && result[0]?.pg_try_advisory_lock);
    } catch (err: any) {
      logger.warn(`[JobSourceScheduler] Error checking pg advisory lock: ${err.message}`);
      return true; // Fallback to database row locking if advisory lock isn't supported in test harness
    }
  }

  /**
   * Release the PostgreSQL advisory lock.
   */
  private static async releaseGlobalLock(): Promise<void> {
    try {
      await prisma.$queryRaw`
        SELECT pg_advisory_unlock(${this.GLOBAL_LOCK_ID});
      `;
    } catch (err: any) {
      logger.warn(`[JobSourceScheduler] Error releasing pg advisory lock: ${err.message}`);
    }
  }

  /**
   * Acquires a database-backed lock for an individual source configuration.
   * Prevents concurrent syncs from GitHub Actions and Admin Manual Sync.
   */
  public static async acquireSourceLock(configId: string): Promise<string | null> {
    const lockToken = crypto.randomUUID();
    const now = new Date();
    const staleLockThreshold = new Date(now.getTime() - 15 * 60 * 1000); // 15-minute lock timeout

    // Atomic update: only acquire if not currently running OR previous lock has expired (>15 mins)
    const updated = await prisma.jobSourceConfiguration.updateMany({
      where: {
        id: configId,
        OR: [
          { syncInProgress: false },
          { lastSyncStartedAt: { lt: staleLockThreshold } }
        ]
      },
      data: {
        syncInProgress: true,
        syncLockToken: lockToken,
        lastSyncStartedAt: now
      }
    });

    if (updated.count > 0) {
      return lockToken;
    }
    return null;
  }

  /**
   * Releases a database-backed lock for an individual source configuration.
   */
  public static async releaseSourceLock(configId: string, lockToken?: string | null): Promise<void> {
    const whereClause: any = { id: configId };
    if (lockToken) {
      whereClause.syncLockToken = lockToken;
    }

    await prisma.jobSourceConfiguration.updateMany({
      where: whereClause,
      data: {
        syncInProgress: false,
        syncLockToken: null
      }
    });
  }

  /**
   * Synchronizes a single source configuration with retry logic and isolation.
   */
  public static async syncSingleSource(
    configId: string,
    existingLockToken?: string
  ): Promise<{
    success: boolean;
    sync?: SyncOutcome;
    status: 'SUCCESS' | 'FAILED' | 'SKIPPED' | 'ALREADY_RUNNING';
    error?: string;
  }> {
    let token: string | null | undefined = existingLockToken;
    if (!token) {
      token = await this.acquireSourceLock(configId);
      if (!token) {
        logger.warn(`[JobSourceScheduler] Source ${configId} is already running.`);
        return { success: false, status: 'ALREADY_RUNNING', error: 'Synchronization is already active for this source.' };
      }
    }

    try {
      const config = await prisma.jobSourceConfiguration.findUnique({
        where: { id: configId },
        include: { company: true }
      });

      if (!config) {
        await this.releaseSourceLock(configId, token);
        return { success: false, status: 'FAILED', error: `Configuration ${configId} not found` };
      }

      if (!config.enabled) {
        await this.releaseSourceLock(configId, token);
        return { success: true, status: 'SKIPPED' };
      }

      const discovery: DiscoveryResult = {
        detectedType: config.sourceType as any,
        sourceUrl: config.sourceUrl,
        jobsEndpoint: config.jobsEndpoint || config.sourceUrl,
        companyName: config.company.name,
        officialDomain: config.company.officialDomain || '',
        jobCount: config.jobsFound,
        mappingConfig: (config.mappingConfig as any) || {},
        sampleJobs: []
      };

      // Execute sync with bounded retry for transient network errors (e.g. 502, 503, 504, timeout)
      let attempt = 0;
      const maxRetries = 2;
      let lastErr: any = null;
      let outcome: SyncOutcome | null = null;

      while (attempt <= maxRetries) {
        try {
          outcome = await JobSourceDiscoveryService.syncDiscoveredSource(config.id, discovery);
          break;
        } catch (err: any) {
          lastErr = err;
          const msg = (err.message || '').toLowerCase();
          const isTransient = msg.includes('502') || msg.includes('503') || msg.includes('504') ||
                              msg.includes('timeout') || msg.includes('econnreset') || msg.includes('etimedout');

          if (isTransient && attempt < maxRetries) {
            attempt++;
            logger.info(`[JobSourceScheduler] Transient error syncing ${config.company.name}: ${err.message}. Retrying attempt ${attempt}...`);
            await new Promise(r => setTimeout(r, 1000 * attempt));
            continue;
          }
          break;
        }
      }

      if (!outcome) {
        const errorMsg = lastErr?.message || 'Sync failed';
        logger.error(`[JobSourceScheduler] Source sync failed for ${config.company.name}: ${errorMsg}`);

        // Update health status gracefully: mark DEGRADED first, or FAILING if repeated
        const nextHealth = config.healthStatus === SourceHealth.HEALTHY ? SourceHealth.DEGRADED : SourceHealth.FAILING;

        await prisma.jobSourceConfiguration.update({
          where: { id: configId },
          data: {
            lastSyncAt: new Date(),
            lastSyncError: errorMsg,
            healthStatus: nextHealth,
            syncInProgress: false,
            syncLockToken: null
          }
        });

        return {
          success: false,
          status: 'FAILED',
          error: errorMsg
        };
      }

      return {
        success: true,
        status: 'SUCCESS',
        sync: outcome
      };
    } catch (unexpectedErr: any) {
      await this.releaseSourceLock(configId, token);
      return {
        success: false,
        status: 'FAILED',
        error: unexpectedErr.message
      };
    }
  }

  /**
   * Runs the automated scheduler across all ENABLED JobSourceConfiguration records.
   * Isolates failures, reconciles missing jobs, enforces concurrency limits.
   */
  public static async syncAllEnabledSources(): Promise<SchedulerRunResult> {
    const startedAt = new Date();
    logger.info(`[JobSourceScheduler] Starting scheduled synchronization run at ${startedAt.toISOString()}`);

    // Global locking to prevent overlapping scheduler runs
    const acquired = await this.acquireGlobalLock();
    if (!acquired) {
      logger.warn('[JobSourceScheduler] Another global scheduler run is currently active. Skipping invocation.');
      return {
        totalSources: 0,
        processedSources: 0,
        successfulSources: 0,
        failedSources: 0,
        jobsCreated: 0,
        jobsUpdated: 0,
        jobsExpired: 0,
        startedAt: startedAt.toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: 0,
        details: []
      };
    }

    try {
      // Find all enabled job source configurations
      const enabledSources = await prisma.jobSourceConfiguration.findMany({
        where: { enabled: true },
        include: { company: true }
      });

      logger.info(`[JobSourceScheduler] Found ${enabledSources.length} enabled job sources to process`);

      const summary: SchedulerRunResult = {
        totalSources: enabledSources.length,
        processedSources: 0,
        successfulSources: 0,
        failedSources: 0,
        jobsCreated: 0,
        jobsUpdated: 0,
        jobsExpired: 0,
        startedAt: startedAt.toISOString(),
        completedAt: '',
        durationMs: 0,
        details: []
      };

      // Process sources with bounded concurrency (e.g. 4 concurrent sources)
      const queue = [...enabledSources];
      const activeWorkers: Promise<void>[] = [];

      const processNext = async () => {
        while (queue.length > 0) {
          const source = queue.shift();
          if (!source) break;

          summary.processedSources++;
          const result = await this.syncSingleSource(source.id);

          if (result.status === 'SUCCESS' && result.sync) {
            summary.successfulSources++;
            summary.jobsCreated += result.sync.created;
            summary.jobsUpdated += result.sync.updated;
            summary.jobsExpired += result.sync.expired || 0;

            summary.details.push({
              configId: source.id,
              companyName: source.company.name,
              sourceType: source.sourceType,
              status: 'SUCCESS',
              created: result.sync.created,
              updated: result.sync.updated,
              expired: result.sync.expired || 0
            });
          } else if (result.status === 'ALREADY_RUNNING') {
            summary.details.push({
              configId: source.id,
              companyName: source.company.name,
              sourceType: source.sourceType,
              status: 'ALREADY_RUNNING',
              error: result.error
            });
          } else {
            summary.failedSources++;
            summary.details.push({
              configId: source.id,
              companyName: source.company.name,
              sourceType: source.sourceType,
              status: 'FAILED',
              error: result.error
            });
          }
        }
      };

      const workerCount = Math.min(this.MAX_CONCURRENCY, enabledSources.length);
      for (let i = 0; i < workerCount; i++) {
        activeWorkers.push(processNext());
      }

      await Promise.all(activeWorkers);

      const completedAt = new Date();
      summary.completedAt = completedAt.toISOString();
      summary.durationMs = completedAt.getTime() - startedAt.getTime();

      logger.info(
        `[JobSourceScheduler] Completed sync run: ` +
        `${summary.successfulSources}/${summary.processedSources} succeeded. ` +
        `Jobs: +${summary.jobsCreated} created, ~${summary.jobsUpdated} updated, -${summary.jobsExpired} expired in ${summary.durationMs}ms`
      );

      return summary;
    } finally {
      await this.releaseGlobalLock();
    }
  }
}
