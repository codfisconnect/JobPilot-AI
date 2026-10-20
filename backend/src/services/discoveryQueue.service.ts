import { prisma } from '../database/prisma.js';
import { logger } from '../utils/logger.js';
import { BulkJobSourceService } from './bulkJobSource.service.js';
import { JobSourceDiscoveryService } from './jobSourceDiscovery.service.js';
import { BulkImportStatus, BulkSourceItemStatus } from '@prisma/client';
import { EventEmitter } from 'events';

export const MANUAL_DISCOVERY_BATCH_ID = '00000000-0000-0000-0000-000000000001';

export interface DiscoveryTaskDTO {
  id: string;
  sourceUrl: string;
  normalizedUrl: string | null;
  companyName: string | null;
  status: BulkSourceItemStatus;
  queuePosition: number | null;
  sourceConfigurationId: string | null;
  discoveryStrategy: string | null;
  sourceType: string | null;
  jobsDiscovered: number;
  jobsCreated: number;
  jobsUpdated: number;
  jobsExpired: number;
  sourceTotal: number | null;
  pagesFetched: number;
  pagesFailed: number;
  completeness: string | null;
  healthStatus: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export class DiscoveryQueueService {
  private static isProcessing = false;
  private static eventEmitter = new EventEmitter();

  /**
   * Initializes or fetches the persistent singleton manual discovery batch.
   */
  public static async getOrCreateManualBatch(): Promise<string> {
    const existing = await prisma.bulkSourceImport.findUnique({
      where: { id: MANUAL_DISCOVERY_BATCH_ID }
    });

    if (existing) {
      return existing.id;
    }

    try {
      const created = await prisma.bulkSourceImport.create({
        data: {
          id: MANUAL_DISCOVERY_BATCH_ID,
          createdBy: 'admin_manual_queue',
          status: BulkImportStatus.RUNNING,
          totalSources: 0,
          queuedSources: 0,
          runningSources: 0,
          completedSources: 0,
          partialSources: 0,
          failedSources: 0,
          alreadyConnectedSources: 0,
          skippedSources: 0
        }
      });
      return created.id;
    } catch {
      // If concurrent create raced, return ID
      return MANUAL_DISCOVERY_BATCH_ID;
    }
  }

  /**
   * Enqueues a single career URL for manual discovery in FIFO order.
   * Prevents duplicates if the source is already QUEUED or DISCOVERING.
   * If already connected, marks as ALREADY_CONNECTED without duplication.
   */
  public static async enqueueSource(rawUrl: string, companyHint?: string): Promise<{
    task: DiscoveryTaskDTO;
    isExistingConnected: boolean;
    isDuplicateQueued: boolean;
  }> {
    const batchId = await this.getOrCreateManualBatch();
    const { normalizedUrl, sourceIdentityUrl, isValid, error } = BulkJobSourceService.resolveUrlIdentities(rawUrl);

    if (!isValid) {
      throw new Error(error || 'Invalid career or jobs URL provided.');
    }

    // 1. Check for duplicate pending / running tasks for this same normalized URL
    const pendingTask = await prisma.bulkSourceItem.findFirst({
      where: {
        bulkJobId: batchId,
        OR: [
          { sourceUrl: rawUrl.trim() },
          { normalizedUrl: normalizedUrl },
          ...(sourceIdentityUrl ? [{ sourceUrl: { contains: sourceIdentityUrl } }] : [])
        ],
        status: {
          in: [
            BulkSourceItemStatus.QUEUED,
            BulkSourceItemStatus.VALIDATING,
            BulkSourceItemStatus.DISCOVERING,
            BulkSourceItemStatus.PAGINATING,
            BulkSourceItemStatus.NORMALIZING,
            BulkSourceItemStatus.PERSISTING
          ]
        }
      }
    });

    if (pendingTask) {
      const dto = await this.mapItemToDTO(pendingTask);
      return {
        task: dto,
        isExistingConnected: false,
        isDuplicateQueued: true
      };
    }

    // 2. Check if already connected in JobSourceConfiguration
    const existingConfig = await prisma.jobSourceConfiguration.findFirst({
      where: {
        OR: [
          { sourceUrl: rawUrl.trim() },
          { sourceUrl: normalizedUrl },
          { jobsEndpoint: rawUrl.trim() },
          { jobsEndpoint: normalizedUrl }
        ]
      },
      include: { company: true }
    });

    if (existingConfig) {
      const existingItem = await prisma.bulkSourceItem.create({
        data: {
          bulkJobId: batchId,
          sourceUrl: rawUrl.trim(),
          normalizedUrl,
          companyName: existingConfig.company?.name || null,
          companyHint: companyHint || null,
          status: BulkSourceItemStatus.ALREADY_CONNECTED,
          sourceConfigurationId: existingConfig.id,
          sourceType: existingConfig.sourceType,
          healthStatus: existingConfig.healthStatus,
          errorMessage: 'Source is already connected and active.',
          completedAt: new Date()
        }
      });

      const dto = await this.mapItemToDTO(existingItem);
      return {
        task: dto,
        isExistingConnected: true,
        isDuplicateQueued: false
      };
    }

    // 3. Create persistent QUEUED task
    const newItem = await prisma.bulkSourceItem.create({
      data: {
        bulkJobId: batchId,
        sourceUrl: rawUrl.trim(),
        normalizedUrl,
        companyName: null,
        companyHint: companyHint || null,
        status: BulkSourceItemStatus.QUEUED,
        errorMessage: null,
        errorCode: null
      }
    });

    // Update batch counters
    await prisma.bulkSourceImport.update({
      where: { id: batchId },
      data: {
        totalSources: { increment: 1 },
        queuedSources: { increment: 1 }
      }
    }).catch(() => {});

    // Kick off background worker safely without blocking HTTP response
    setImmediate(() => {
      this.triggerNextWorkerExecution().catch(err => {
        logger.error(`[DiscoveryQueueService] Worker kickoff notice: ${err.message}`);
      });
    });

    const dto = await this.mapItemToDTO(newItem);
    return {
      task: dto,
      isExistingConnected: false,
      isDuplicateQueued: false
    };
  }

  /**
   * Retrieves all discovery tasks from the manual queue ordered by creation date.
   */
  public static async getTasks(limit: number = 50): Promise<{
    current: DiscoveryTaskDTO | null;
    queued: DiscoveryTaskDTO[];
    recent: DiscoveryTaskDTO[];
  }> {
    const batchId = await this.getOrCreateManualBatch();

    // Reconcile any orphaned/stuck running tasks if server crashed
    await this.reconcileStuckTasks(batchId);

    const items = await prisma.bulkSourceItem.findMany({
      where: { bulkJobId: batchId },
      orderBy: { createdAt: 'desc' },
      take: limit
    });

    let current: DiscoveryTaskDTO | null = null;
    const queuedItems: DiscoveryTaskDTO[] = [];
    const recent: DiscoveryTaskDTO[] = [];

    // Filter queued items in FIFO (ascending by creation)
    const activeQueued = items
      .filter(i => i.status === BulkSourceItemStatus.QUEUED)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    for (let idx = 0; idx < activeQueued.length; idx++) {
      const dto = await this.mapItemToDTO(activeQueued[idx]);
      dto.queuePosition = idx + 1;
      queuedItems.push(dto);
    }

    for (const item of items) {
      if (
        item.status === BulkSourceItemStatus.DISCOVERING ||
        item.status === BulkSourceItemStatus.VALIDATING ||
        item.status === BulkSourceItemStatus.PAGINATING ||
        item.status === BulkSourceItemStatus.NORMALIZING ||
        item.status === BulkSourceItemStatus.PERSISTING
      ) {
        if (!current) {
          current = await this.mapItemToDTO(item);
        }
      } else if (item.status !== BulkSourceItemStatus.QUEUED) {
        recent.push(await this.mapItemToDTO(item));
      }
    }

    return {
      current,
      queued: queuedItems,
      recent: recent.slice(0, 20)
    };
  }

  /**
   * Retrieves single task by ID.
   */
  public static async getTaskById(taskId: string): Promise<DiscoveryTaskDTO | null> {
    const item = await prisma.bulkSourceItem.findUnique({
      where: { id: taskId }
    });
    if (!item) return null;
    return this.mapItemToDTO(item);
  }

  /**
   * Cancels a queued or discovering task.
   */
  public static async cancelTask(taskId: string): Promise<DiscoveryTaskDTO> {
    const item = await prisma.bulkSourceItem.findUnique({
      where: { id: taskId }
    });
    if (!item) {
      throw new Error(`Task with id ${taskId} not found.`);
    }

    const updated = await prisma.bulkSourceItem.update({
      where: { id: taskId },
      data: {
        status: BulkSourceItemStatus.CANCELLED,
        errorMessage: 'Cancelled by administrator.',
        completedAt: new Date()
      }
    });

    // Trigger next queued task if any
    setImmediate(() => {
      this.triggerNextWorkerExecution().catch(() => {});
    });

    return this.mapItemToDTO(updated);
  }

  /**
   * Retries a failed or cancelled task.
   */
  public static async retryTask(taskId: string): Promise<DiscoveryTaskDTO> {
    const item = await prisma.bulkSourceItem.findUnique({
      where: { id: taskId }
    });
    if (!item) {
      throw new Error(`Task with id ${taskId} not found.`);
    }

    const updated = await prisma.bulkSourceItem.update({
      where: { id: taskId },
      data: {
        status: BulkSourceItemStatus.QUEUED,
        errorMessage: null,
        errorCode: null,
        completedAt: null
      }
    });

    // Kick off worker
    setImmediate(() => {
      this.triggerNextWorkerExecution().catch(() => {});
    });

    return this.mapItemToDTO(updated);
  }

  /**
   * Background queue worker loop:
   * Concurrency = 1 for manual single-source additions.
   * Atomically claims next eligible QUEUED task in FIFO order and runs discovery.
   * When task finishes (success/partial/failure), automatically claims the next QUEUED task.
   */
  public static async triggerNextWorkerExecution(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    let batchId = MANUAL_DISCOVERY_BATCH_ID;
    try {
      batchId = await this.getOrCreateManualBatch();

      // Check if there is already an active running task
      const activeRunning = await prisma.bulkSourceItem.findFirst({
        where: {
          bulkJobId: batchId,
          status: {
            in: [
              BulkSourceItemStatus.DISCOVERING,
              BulkSourceItemStatus.VALIDATING,
              BulkSourceItemStatus.PAGINATING,
              BulkSourceItemStatus.NORMALIZING,
              BulkSourceItemStatus.PERSISTING
            ]
          }
        }
      });

      if (activeRunning) {
        // One task is already actively discovering. Let it finish.
        return;
      }

      // Find earliest QUEUED task (FIFO)
      const nextQueued = await prisma.bulkSourceItem.findFirst({
        where: {
          bulkJobId: batchId,
          status: BulkSourceItemStatus.QUEUED
        },
        orderBy: { createdAt: 'asc' }
      });

      if (!nextQueued) {
        // No queued tasks remain
        return;
      }

      // Atomically claim task by setting to DISCOVERING
      const claimed = await prisma.bulkSourceItem.updateMany({
        where: {
          id: nextQueued.id,
          status: BulkSourceItemStatus.QUEUED
        },
        data: {
          status: BulkSourceItemStatus.DISCOVERING,
          startedAt: new Date(),
          errorMessage: null,
          errorCode: null
        }
      });

      if (claimed.count === 0) {
        // Another concurrent worker claimed it
        return;
      }

      logger.info(`[DiscoveryQueueService] Claimed manual discovery task: ${nextQueued.id} for ${nextQueued.sourceUrl}`);

      // Execute discovery
      try {
        const targetUrl = nextQueued.normalizedUrl || nextQueued.sourceUrl;
        const result = await JobSourceDiscoveryService.discoverAndOnboard(targetUrl);

        if (!result.success) {
          await prisma.bulkSourceItem.update({
            where: { id: nextQueued.id },
            data: {
              status: BulkSourceItemStatus.FAILED,
              errorCode: 'DISCOVERY_FAILED',
              errorMessage: result.error || 'No public job source was discoverable from this page.',
              completedAt: new Date()
            }
          });
        } else {
          const isPartial =
            result.discovery.completeness === 'PARTIAL' ||
            (result.discovery.expectedJobCount != null && result.discovery.jobCount < result.discovery.expectedJobCount);

          const finalStatus = isPartial ? BulkSourceItemStatus.PARTIAL : BulkSourceItemStatus.COMPLETED;

          await prisma.bulkSourceItem.update({
            where: { id: nextQueued.id },
            data: {
              status: finalStatus,
              companyName: result.companyName,
              sourceConfigurationId: result.sourceConfigurationId,
              discoveryStrategy: result.discovery.strategy || result.discovery.detectedType,
              sourceType: result.discovery.sourceType || result.discovery.detectedType,
              jobsDiscovered: result.discovery.jobCount,
              jobsCreated: result.sync.created,
              jobsUpdated: result.sync.updated,
              jobsExpired: result.sync.expired || 0,
              sourceTotal: result.discovery.expectedJobCount ?? null,
              pagesFetched: (result.discovery as any).pagesFetched || 1,
              completeness: isPartial ? 'PARTIAL' : (result.discovery.completeness || 'COMPLETE'),
              healthStatus: isPartial ? 'DEGRADED' : 'HEALTHY',
              completedAt: new Date()
            }
          });
        }
      } catch (err: any) {
        logger.error(`[DiscoveryQueueService] Discovery execution error for ${nextQueued.id}: ${err.message}`);
        await prisma.bulkSourceItem.update({
          where: { id: nextQueued.id },
          data: {
            status: BulkSourceItemStatus.FAILED,
            errorCode: 'EXECUTION_ERROR',
            errorMessage: err.message || 'An unexpected error occurred during discovery.',
            completedAt: new Date()
          }
        });
      }
    } finally {
      this.isProcessing = false;
      // If there are more queued items, automatically advance to the next in line
      const remainingQueued = await prisma.bulkSourceItem.count({
        where: {
          bulkJobId: batchId,
          status: BulkSourceItemStatus.QUEUED
        }
      }).catch(() => 0);

      if (remainingQueued > 0) {
        setImmediate(() => {
          this.triggerNextWorkerExecution().catch(() => {});
        });
      }
    }
  }

  /**
   * Reconciles tasks stuck in DISCOVERING for > 15 minutes due to unexpected server restarts.
   */
  private static async reconcileStuckTasks(batchId: string): Promise<void> {
    const staleThreshold = new Date(Date.now() - 15 * 60 * 1000);
    await prisma.bulkSourceItem.updateMany({
      where: {
        bulkJobId: batchId,
        status: {
          in: [
            BulkSourceItemStatus.DISCOVERING,
            BulkSourceItemStatus.VALIDATING,
            BulkSourceItemStatus.PAGINATING,
            BulkSourceItemStatus.NORMALIZING,
            BulkSourceItemStatus.PERSISTING
          ]
        },
        startedAt: { lt: staleThreshold }
      },
      data: {
        status: BulkSourceItemStatus.FAILED,
        errorCode: 'TIMEOUT_RECONCILED',
        errorMessage: 'Task timed out or was interrupted by a server restart. Click Retry to re-run.',
        completedAt: new Date()
      }
    }).catch(() => {});
  }

  /**
   * Helper to map DB record to clean API DTO.
   */
  private static async mapItemToDTO(item: any): Promise<DiscoveryTaskDTO> {
    return {
      id: item.id,
      sourceUrl: item.sourceUrl,
      normalizedUrl: item.normalizedUrl,
      companyName: item.companyName,
      status: item.status,
      queuePosition: null,
      sourceConfigurationId: item.sourceConfigurationId,
      discoveryStrategy: item.discoveryStrategy,
      sourceType: item.sourceType,
      jobsDiscovered: item.jobsDiscovered,
      jobsCreated: item.jobsCreated,
      jobsUpdated: item.jobsUpdated,
      jobsExpired: item.jobsExpired,
      sourceTotal: item.sourceTotal,
      pagesFetched: item.pagesFetched,
      pagesFailed: item.pagesFailed,
      completeness: item.completeness,
      healthStatus: item.healthStatus,
      errorCode: item.errorCode,
      errorMessage: item.errorMessage,
      startedAt: item.startedAt ? item.startedAt.toISOString() : null,
      completedAt: item.completedAt ? item.completedAt.toISOString() : null,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString()
    };
  }
}
