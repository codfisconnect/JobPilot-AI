import { Request, Response, NextFunction } from 'express';
import { JobSourceDiscoveryService } from '../../services/jobSourceDiscovery.service.js';
import { JobSourceSchedulerService } from '../../services/jobSourceScheduler.service.js';
import { prisma } from '../../database/prisma.js';
import { logger } from '../../utils/logger.js';

export class AdminJobSourcesController {
  /**
   * POST /api/v1/admin/job-sources/discover
   * Admin discovers and connects a job source using ONLY a URL.
   */
  public static async discoverAndConnect(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { url } = req.body || {};
      if (!url || typeof url !== 'string' || !url.trim()) {
        res.status(400).json({
          success: false,
          error: 'Career or Jobs page URL is required.'
        });
        return;
      }

      logger.info(`[AdminJobSourcesController] Discover requested for URL: ${url}`);
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
    } catch (err) {
      next(err);
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
