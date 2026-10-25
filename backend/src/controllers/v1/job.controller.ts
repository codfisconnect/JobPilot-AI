import { Request, Response, NextFunction } from 'express';
import { JobQueryService } from '../../services/jobQuery.service.js';
import { JobIngestionService } from '../../services/jobIngestion.service.js';
import { JobRecommendationService } from '../../services/jobRecommendation.service.js';
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
        postedAfter,
        postedDays,
        sortBy,
        page,
        pageSize,
        lightweight
      } = req.query;

      const parsedPage = Math.max(1, Math.min(10000, Number(page) || 1));
      const parsedPageSize = Math.max(1, Math.min(100, Number(pageSize) || 20));
      const isLightweight = lightweight === 'true' || lightweight === '1' || parsedPageSize <= 6;

      let computedPostedAfter: Date | undefined = undefined;
      if (postedAfter && !isNaN(new Date(String(postedAfter)).getTime())) {
        computedPostedAfter = new Date(String(postedAfter));
      } else if (postedDays && !isNaN(Number(postedDays))) {
        const days = Number(postedDays);
        computedPostedAfter = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      }

      const validSortOptions = ['latest', 'oldest', 'salary', 'company', 'location', 'relevance'];
      const resolvedSortBy = typeof sortBy === 'string' && validSortOptions.includes(sortBy)
        ? (sortBy as any)
        : 'latest';

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
        postedAfter: computedPostedAfter,
        sortBy: resolvedSortBy,
        page: parsedPage,
        pageSize: parsedPageSize,
        lightweight: isLightweight,
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
   * GET /api/v1/jobs/recommended - Get personalized recommendations for authenticated candidate
   */
  public static async getRecommendedJobs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(200).json({
          success: true,
          data: [],
          pagination: { page: 1, pageSize: 12, total: 0, totalPages: 0 },
          hasProfileData: false,
          profileState: 'EMPTY'
        });
        return;
      }

      const { page, pageSize, country, location, remoteType, employmentType } = req.query;

      const result = await JobRecommendationService.getRecommendations(userId, {
        page: page ? Number(page) : 1,
        pageSize: pageSize ? Number(pageSize) : 12,
        country: country ? String(country) : undefined,
        location: location ? String(location) : undefined,
        remoteType: remoteType ? String(remoteType) : undefined,
        employmentType: employmentType ? String(employmentType) : undefined
      });

      res.status(200).json({
        success: true,
        status: result.status,
        data: result.items,
        pagination: result.pagination,
        hasProfileData: result.hasProfileData,
        profileState: result.profileState,
        profileSummary: result.profileSummary
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
