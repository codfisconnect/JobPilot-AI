import { Request, Response, NextFunction } from 'express';
import { JobSourceDiscoveryService } from '../../services/jobSourceDiscovery.service.js';
import { JobSourceSchedulerService } from '../../services/jobSourceScheduler.service.js';
import { DiscoveryQueueService } from '../../services/discoveryQueue.service.js';
import { prisma } from '../../database/prisma.js';
import { logger } from '../../utils/logger.js';

export class AdminJobSourcesController {
  /**
   * POST /api/v1/admin/job-sources/discover
   * Admin discovers and connects a job source using ONLY a URL.
   * If sync=true query is provided, runs synchronously (for legacy tests).
   * Otherwise, queues the task asynchronously (202 Accepted) in FIFO order.
   */
  public static async discoverAndConnect(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { url, companyHint } = req.body || {};
      if (!url || typeof url !== 'string' || !url.trim()) {
        res.status(400).json({
          success: false,
          error: 'Career or Jobs page URL is required.'
        });
        return;
      }

      // Check if caller explicitly requested synchronous onboarding (e.g. integration tests)
      const isSyncRequested = req.query.sync === 'true' || req.body.sync === true;

      if (isSyncRequested) {
        logger.info(`[AdminJobSourcesController] Synchronous discover requested for URL: ${url}`);
        const result = await JobSourceDiscoveryService.discoverAndOnboard(url.trim());

        if (!result.success) {
          res.status(422).json({
            success: false,
            error: result.error || 'No public job source was discoverable from this page.'
          });
          return;
        }

        const configuration = await prisma.jobSourceConfiguration.findUnique({
          where: { id: result.sourceConfigurationId },
          include: { company: true }
        });

        res.status(200).json({
          success: true,
          source: configuration,
          discovery: {
            detectedType: result.discovery.detectedType,
            sourceType: result.discovery.sourceType,
            atsType: result.discovery.atsType,
            strategy: result.discovery.strategy,
            jobsEndpoint: result.discovery.jobsEndpoint,
            company: result.companyName,
            officialDomain: result.discovery.officialDomain,
            jobCount: result.discovery.jobCount,
            expectedJobCount: result.discovery.expectedJobCount,
            completeness: result.discovery.completeness,
            paginationSupported: result.discovery.paginationSupported
          },
          sync: result.sync
        });
        return;
      }

      // Asynchronous Non-Blocking Discovery Queue (Default)
      logger.info(`[AdminJobSourcesController] Enqueuing non-blocking discovery task for URL: ${url}`);
      const enqueueResult = await DiscoveryQueueService.enqueueSource(url.trim(), companyHint);

      if (enqueueResult.isExistingConnected) {
        res.status(200).json({
          success: true,
          isAlreadyConnected: true,
          message: 'This job source is already connected and active.',
          task: enqueueResult.task
        });
        return;
      }

      if (enqueueResult.isDuplicateQueued) {
        res.status(200).json({
          success: true,
          isDuplicate: true,
          message: 'Discovery for this source is already in progress or queued.',
          task: enqueueResult.task
        });
        return;
      }

      // Return 202 Accepted immediately with task identity & initial status
      res.status(202).json({
        success: true,
        message: 'Job source discovery task queued successfully.',
        taskId: enqueueResult.task.id,
        task: enqueueResult.task,
        status: enqueueResult.task.status
      });
    } catch (err: any) {
      logger.error(`[AdminJobSourcesController] Discover error: ${err.message}`);
      res.status(400).json({
        success: false,
        error: err.message || 'Failed to queue discovery task.'
      });
    }
  }

  /**
   * GET /api/v1/admin/job-sources/discovery-tasks
   * Retrieves active, queued, and recent discovery tasks.
   */
  public static async getDiscoveryTasks(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tasks = await DiscoveryQueueService.getTasks(50);
      res.status(200).json({
        success: true,
        ...tasks
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/admin/job-sources/discovery-tasks/:id
   * Retrieves single discovery task by ID.
   */
  public static async getDiscoveryTaskById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const taskId = String(req.params.id);
      const task = await DiscoveryQueueService.getTaskById(taskId);
      if (!task) {
        res.status(404).json({
          success: false,
          error: `Task with id ${taskId} not found.`
        });
        return;
      }

      res.status(200).json({
        success: true,
        task
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/admin/job-sources/discovery-tasks/:id/cancel
   * Cancels a queued or running discovery task.
   */
  public static async cancelDiscoveryTask(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const taskId = String(req.params.id);
      const task = await DiscoveryQueueService.cancelTask(taskId);
      res.status(200).json({
        success: true,
        message: 'Task cancelled successfully.',
        task
      });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        error: err.message || 'Failed to cancel task.'
      });
    }
  }

  /**
   * POST /api/v1/admin/job-sources/discovery-tasks/:id/retry
   * Retries a failed or cancelled discovery task.
   */
  public static async retryDiscoveryTask(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const taskId = String(req.params.id);
      const task = await DiscoveryQueueService.retryTask(taskId);
      res.status(200).json({
        success: true,
        message: 'Task retry queued successfully.',
        task
      });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        error: err.message || 'Failed to retry task.'
      });
    }
  }

  /**
   * GET /api/v1/admin/job-sources
   * Lists all connected job sources.
   */
  public static async listSources(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const sources = await prisma.jobSourceConfiguration.findMany({
        include: {
          company: {
            select: { id: true, name: true, officialDomain: true, logoUrl: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      res.status(200).json({
        success: true,
        data: sources
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/admin/job-sources/:id
   * Get single job source configuration details.
   */
  public static async getSourceById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const source = await prisma.jobSourceConfiguration.findUnique({
        where: { id },
        include: { company: true }
      });

      if (!source) {
        res.status(404).json({ success: false, error: 'Job source not found.' });
        return;
      }

      res.status(200).json({ success: true, data: source });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/admin/job-sources/:id/sync
   * Trigger sync on demand using the shared scheduler synchronization engine.
   */
  public static async syncSource(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const result = await JobSourceSchedulerService.syncSingleSource(id);

      if (result.status === 'ALREADY_RUNNING') {
        res.status(409).json({
          success: false,
          error: 'Synchronization is already running for this job source.'
        });
        return;
      }

      if (!result.success) {
        res.status(500).json({
          success: false,
          error: result.error || 'Failed to sync job source.',
          sync: result.sync
        });
        return;
      }

      const updated = await prisma.jobSourceConfiguration.findUnique({
        where: { id },
        include: { company: true }
      });

      res.status(200).json({
        success: true,
        source: updated,
        sync: result.sync
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PATCH /api/v1/admin/job-sources/:id
   * Update configuration (e.g. toggle enabled, or edit mapping).
   */
  public static async updateSource(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const { enabled, mappingConfig, jobsEndpoint, parserType } = req.body || {};

      const dataToUpdate: any = {};
      if (typeof enabled === 'boolean') dataToUpdate.enabled = enabled;
      if (mappingConfig && typeof mappingConfig === 'object') dataToUpdate.mappingConfig = mappingConfig;
      if (jobsEndpoint && typeof jobsEndpoint === 'string') dataToUpdate.jobsEndpoint = jobsEndpoint;
      if (parserType && typeof parserType === 'string') dataToUpdate.parserType = parserType;

      const updated = await prisma.jobSourceConfiguration.update({
        where: { id },
        data: dataToUpdate,
        include: { company: true }
      });

      res.status(200).json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /api/v1/admin/job-sources/:id
   * Remove job source configuration.
   */
  public static async deleteSource(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      await prisma.jobSourceConfiguration.delete({
        where: { id }
      });

      res.status(200).json({ success: true, message: 'Job source deleted successfully.' });
    } catch (err) {
      next(err);
    }
  }
}
