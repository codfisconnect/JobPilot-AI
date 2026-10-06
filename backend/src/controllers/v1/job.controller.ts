import { Request, Response, NextFunction } from 'express';
import { JobQueryService } from '../../services/jobQuery.service.js';
import { JobIngestionService } from '../../services/jobIngestion.service.js';
import { RemoteType, EmploymentType, JobStatus } from '@prisma/client';

export class JobControllerV1 {
  /**
   * GET /api/v1/jobs - Query and filter canonical jobs
   */
  public static async listJobs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        query,
        title,
        companyId,
        companyName,
        skill,
        location,
        country,
        city,
        remoteType,
        employmentType,
        experienceMin,
        experienceMax,
        salaryMin,
        salaryMax,
        salaryCurrency,
        sourceType,
        sortBy,
        page,
        pageSize
      } = req.query;

      const parsedPage = Math.max(1, Math.min(10000, Number(page) || 1));
      const parsedPageSize = Math.max(1, Math.min(100, Number(pageSize) || 20));

      const result = await JobQueryService.searchJobs({
        query: query ? String(query).slice(0, 200) : undefined,
        title: title ? String(title).slice(0, 100) : undefined,
        companyId: companyId ? String(companyId) : undefined,
        companyName: companyName ? String(companyName).slice(0, 100) : undefined,
        skill: skill ? String(skill).slice(0, 50) : undefined,
        location: location ? String(location).slice(0, 100) : undefined,
        country: country ? String(country).slice(0, 50) : undefined,
        city: city ? String(city).slice(0, 50) : undefined,
        remoteType: remoteType ? (remoteType as RemoteType) : undefined,
        employmentType: employmentType ? (employmentType as EmploymentType) : undefined,
        experienceMin: !isNaN(Number(experienceMin)) ? Number(experienceMin) : undefined,
        experienceMax: !isNaN(Number(experienceMax)) ? Number(experienceMax) : undefined,
        salaryMin: !isNaN(Number(salaryMin)) ? Number(salaryMin) : undefined,
        salaryMax: !isNaN(Number(salaryMax)) ? Number(salaryMax) : undefined,
        salaryCurrency: salaryCurrency ? String(salaryCurrency).slice(0, 10) : undefined,
        sourceType: sourceType ? String(sourceType).slice(0, 50) : undefined,
        sortBy: sortBy === 'salary' || sortBy === 'latest' ? sortBy : 'latest',
        page: parsedPage,
        pageSize: parsedPageSize,
        status: JobStatus.ACTIVE
      });

      res.status(200).json({
        success: true,
        data: result.items,
        pagination: result.pagination
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/jobs/:id - Get job detail
   */
  public static async getJobById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const job = await JobQueryService.getJobById(id);
      res.status(200).json({
        success: true,
        data: job
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/jobs/sync - Ingest or sync jobs (internal/developer trigger)
   */
  public static async syncJobs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sourceType, boardIdentifier, limit } = req.body || {};

      if (sourceType) {
        const metrics = await JobIngestionService.ingestSource(sourceType, {
          boardIdentifier,
          limit: limit ? Number(limit) : undefined
        });
        res.status(200).json({
          success: metrics.success,
          data: metrics
        });
      } else {
        const allMetrics = await JobIngestionService.ingestAll({
          limit: limit ? Number(limit) : undefined
        });
        res.status(200).json({
          success: true,
          data: allMetrics
        });
      }
    } catch (err) {
      next(err);
    }
  }
}
