import { Request, Response, NextFunction } from 'express';
import { JobSourceSchedulerService } from '../../services/jobSourceScheduler.service.js';
import { logger } from '../../utils/logger.js';

export class InternalJobSourcesController {
  /**
   * POST /api/v1/internal/job-sources/sync-all
   * Invoked automatically every 30 minutes by GitHub Actions or manual workflow dispatch.
   */
  public static async syncAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      logger.info('[InternalJobSourcesController] Triggering automated sync across all enabled job sources (every 30 mins)');
      const summary = await JobSourceSchedulerService.syncAllEnabledSources();

      res.status(200).json({
        success: true,
        data: {
          ...summary,
          syncIntervalMinutes: JobSourceSchedulerService.SYNC_INTERVAL_MINUTES,
          syncIntervalHuman: JobSourceSchedulerService.SYNC_INTERVAL_HUMAN
        }
      });
    } catch (err: any) {
      logger.error(`[InternalJobSourcesController] Scheduled sync failed: ${err.message}`);
      next(err);
    }
  }
}
