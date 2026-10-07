import type { Request, Response, NextFunction } from 'express';
import { adminService } from './admin.service.js';
import {
  paginationQuerySchema,
  jobsFilterSchema,
  resumesFilterSchema,
  applicationsFilterSchema,
  paymentsFilterSchema,
  subscriptionsFilterSchema
} from './admin.schemas.js';

export class AdminController {
  async getDashboard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await adminService.getDashboardMetrics();
      res.status(200).json({
        success: true,
        data,
        meta: {
          requestId: (req as any).id,
          timestamp: new Date().toISOString()
        }
      });
    } catch (err) {
      next(err);
    }
  }

  async getCandidates(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = paginationQuerySchema.parse(req.query);
      const data = await adminService.getCandidates(query);
      res.status(200).json({
        success: true,
        data: data.items,
        pagination: {
          total: data.total,
          page: data.page,
          pageSize: data.pageSize,
          totalPages: data.totalPages
        },
        meta: {
          requestId: (req as any).id,
          timestamp: new Date().toISOString()
        }
      });
    } catch (err) {
      next(err);
    }
  }

  async getCandidateById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await adminService.getCandidateById(req.params.id);
      res.status(200).json({
        success: true,
        data,
        meta: {
          requestId: (req as any).id,
          timestamp: new Date().toISOString()
        }
      });
    } catch (err) {
      next(err);
    }
  }

  async getResumes(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = resumesFilterSchema.parse(req.query);
      const data = await adminService.getResumes(query);
      res.status(200).json({
        success: true,
        data: data.items,
        pagination: {
          total: data.total,
          page: data.page,
          pageSize: data.pageSize,
          totalPages: data.totalPages
        },
        meta: {
          requestId: (req as any).id,
          timestamp: new Date().toISOString()
        }
      });
    } catch (err) {
      next(err);
    }
  }

  async getJobs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = jobsFilterSchema.parse(req.query);
      const data = await adminService.getJobs(query);
      res.status(200).json({
        success: true,
        data: data.items,
        pagination: {
          total: data.total,
          page: data.page,
          pageSize: data.pageSize,
          totalPages: data.totalPages
        },
        meta: {
          requestId: (req as any).id,
          timestamp: new Date().toISOString()
        }
      });
    } catch (err) {
      next(err);
    }
  }

  async getApplications(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = applicationsFilterSchema.parse(req.query);
      const data = await adminService.getApplications(query);
      res.status(200).json({
        success: true,
        data: data.items,
        pagination: {
          total: data.total,
          page: data.page,
          pageSize: data.pageSize,
          totalPages: data.totalPages
        },
        meta: {
          requestId: (req as any).id,
          timestamp: new Date().toISOString()
        }
      });
    } catch (err) {
      next(err);
    }
  }

  async getEmployers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = paginationQuerySchema.parse(req.query);
      const data = await adminService.getEmployers(query);
      res.status(200).json({
        success: true,
        data: data.items,
        pagination: {
          total: data.total,
          page: data.page,
          pageSize: data.pageSize,
          totalPages: data.totalPages
        },
        meta: {
          requestId: (req as any).id,
          timestamp: new Date().toISOString()
        }
      });
    } catch (err) {
      next(err);
    }
  }

  async getPayments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = paymentsFilterSchema.parse(req.query);
      const data = await adminService.getPayments(query);
      res.status(200).json({
        success: true,
        data: data.items,
        pagination: {
          total: data.total,
          page: data.page,
          pageSize: data.pageSize,
          totalPages: data.totalPages
        },
        meta: {
          requestId: (req as any).id,
          timestamp: new Date().toISOString()
        }
      });
    } catch (err) {
      next(err);
    }
  }

  async getSubscriptions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = subscriptionsFilterSchema.parse(req.query);
      const data = await adminService.getSubscriptions(query);
      res.status(200).json({
        success: true,
        data: data.items,
        pagination: {
          total: data.total,
          page: data.page,
          pageSize: data.pageSize,
          totalPages: data.totalPages
        },
        meta: {
          requestId: (req as any).id,
          timestamp: new Date().toISOString()
        }
      });
    } catch (err) {
      next(err);
    }
  }

  async getCredits(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = paginationQuerySchema.parse(req.query);
      const data = await adminService.getCredits(query);
      res.status(200).json({
        success: true,
        data: {
          wallets: data.wallets,
          recentActivity: data.recentActivity
        },
        pagination: {
          total: data.total,
          page: data.page,
          pageSize: data.pageSize,
          totalPages: data.totalPages
        },
        meta: {
          requestId: (req as any).id,
          timestamp: new Date().toISOString()
        }
      });
    } catch (err) {
      next(err);
    }
  }

  async getHealth(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await adminService.getSystemHealth();
      res.status(200).json({
        success: true,
        data,
        meta: {
          requestId: (req as any).id,
          timestamp: new Date().toISOString()
        }
      });
    } catch (err) {
      next(err);
    }
  }
}

export const adminController = new AdminController();
