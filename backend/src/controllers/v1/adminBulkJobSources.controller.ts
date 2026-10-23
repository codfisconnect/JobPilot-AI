import { Request, Response, NextFunction } from 'express';
import { BulkJobSourceService } from '../../services/bulkJobSource.service.js';
import { prisma } from '../../database/prisma.js';
import { logger } from '../../utils/logger.js';
import { z } from 'zod';

const validateBatchSchema = z.object({
  urls: z.array(z.string()).min(1, 'At least one URL must be provided.'),
  companyHints: z.record(z.string()).optional()
});

const startBulkSchema = z.object({
  urls: z.array(z.string()).min(1, 'At least one URL must be provided.').max(100, 'Maximum 100 sources per batch.'),
  companyHints: z.record(z.string()).optional(),
  maxConcurrency: z.number().int().min(1).max(8).optional()
});

export class AdminBulkJobSourcesController {
  /**
   * POST /api/v1/admin/job-sources/bulk/validate
   * Previews validation, deduplication, and existing connected check before starting discovery.
   */
  public static async validateBatch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = validateBatchSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: parsed.error.errors.map(e => e.message).join(', ')
        });
        return;
      }

      const preview = await BulkJobSourceService.validateBatchPreview(
        parsed.data.urls,
        parsed.data.companyHints
      );

      res.status(200).json({
        success: true,
        data: preview,
        preview
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/admin/job-sources/bulk
   * Starts a bulk source onboarding job asynchronously.
   */
  public static async startBulkImport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = startBulkSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: parsed.error.errors.map(e => e.message).join(', ')
        });
        return;
      }

      const adminEmail = (req as any).user?.email || 'admin';
      const result = await BulkJobSourceService.createAndStartBulkImport({
        urls: parsed.data.urls,
        companyHints: parsed.data.companyHints,
        createdBy: adminEmail,
        maxConcurrency: parsed.data.maxConcurrency
      });

      const responseData = {
        bulkJobId: result.bulkJobId,
        batchId: result.bulkJobId,
        id: result.bulkJobId,
        total: result.total,
        accepted: result.accepted,
        rejected: result.rejected,
        duplicates: result.duplicates,
        alreadyConnected: result.alreadyConnected
      };

      res.status(202).json({
        success: true,
        message: 'Bulk job source import initialized.',
        data: responseData,
        ...responseData
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/admin/job-sources/bulk
   * Returns history of bulk import runs.
   */
  public static async listBulkImports(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 20;
      const skip = (page - 1) * limit;

      const whereClause = {
        id: { not: '00000000-0000-0000-0000-000000000001' }
      };

      const [total, imports] = await Promise.all([
        prisma.bulkSourceImport.count({ where: whereClause }),
        prisma.bulkSourceImport.findMany({
          where: whereClause,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' }
        })
      ]);

      res.status(200).json({
        success: true,
        data: {
          imports,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
          }
        },
        imports,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/admin/job-sources/bulk/:id
   * Returns current status & aggregate counts for a bulk job.
   */
  public static async getBulkImportById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const bulkJob = await prisma.bulkSourceImport.findUnique({
        where: { id },
        include: {
          _count: {
            select: { items: true }
          }
        }
      });

      if (!bulkJob) {
        res.status(404).json({
          success: false,
          error: 'Bulk import job not found.'
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          job: bulkJob,
          ...bulkJob
        },
        job: bulkJob
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/admin/job-sources/bulk/:id/items
   * Returns per-source task items for a bulk job.
   */
  public static async getBulkImportItems(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const statusFilter = req.query.status as string | undefined;

      const items = await prisma.bulkSourceItem.findMany({
        where: {
          bulkJobId: id,
          ...(statusFilter ? { status: statusFilter as any } : {})
        },
        orderBy: { createdAt: 'asc' }
      });

      res.status(200).json({
        success: true,
        data: {
          items
        },
        items
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/admin/job-sources/bulk/:id/cancel
   * Cancels pending sources for a bulk job.
   */
  public static async cancelBulkImport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      await BulkJobSourceService.cancelBulkImport(id);

      res.status(200).json({
        success: true,
        message: 'Bulk job cancellation requested.'
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/admin/job-sources/bulk/:id/items/:itemId/retry
   * Retries an individual failed or partial source item.
   */
  public static async retrySourceItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const itemId = String(req.params.itemId);
      await BulkJobSourceService.retrySourceItem(itemId);

      res.status(200).json({
        success: true,
        message: 'Source retry initiated.'
      });
    } catch (err) {
      next(err);
    }
  }
}
