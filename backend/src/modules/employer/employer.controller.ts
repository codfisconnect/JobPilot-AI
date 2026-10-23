import type { Request, Response, NextFunction } from 'express';
import { EmployerService } from './employer.service.js';
import {
  createOrganizationSchema,
  createEmployerJobSchema,
  updateEmployerJobSchema,
  updateApplicationStageSchema,
  addApplicationNoteSchema
} from './employer.schemas.js';
import { UnauthorizedError } from '../../utils/errors.js';
import { EmployerJobStatus } from '@prisma/client';

export class EmployerController {
  constructor(private service: EmployerService = new EmployerService()) {}

  private getUserId(req: Request): string {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedError('Authentication required');
    }
    return userId;
  }

  createOrganization = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = this.getUserId(req);
      const parsed = createOrganizationSchema.parse(req.body);
      const result = await this.service.createOrganization(userId, parsed);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };

  getMyOrganization = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = this.getUserId(req);
      const result = await this.service.getMyOrganization(userId);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };

  getDashboardMetrics = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = this.getUserId(req);
      const metrics = await this.service.getDashboardMetrics(userId);
      res.json({ success: true, data: metrics });
    } catch (err) {
      next(err);
    }
  };

  listJobs = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = this.getUserId(req);
      const jobs = await this.service.listJobs(userId);
      res.json({ success: true, data: jobs });
    } catch (err) {
      next(err);
    }
  };

  createJob = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = this.getUserId(req);
      const parsed = createEmployerJobSchema.parse(req.body);
      const job = await this.service.createJob(userId, parsed);
      res.status(201).json({ success: true, data: job });
    } catch (err) {
      next(err);
    }
  };

  getJob = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = this.getUserId(req);
      const id = String(req.params.id);
      const job = await this.service.getJob(userId, id);
      res.json({ success: true, data: job });
    } catch (err) {
      next(err);
    }
  };

  updateJob = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = this.getUserId(req);
      const id = String(req.params.id);
      const parsed = updateEmployerJobSchema.parse(req.body);
      const job = await this.service.updateJob(userId, id, parsed);
      res.json({ success: true, data: job });
    } catch (err) {
      next(err);
    }
  };

  publishJob = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = this.getUserId(req);
      const id = String(req.params.id);
      const job = await this.service.updateJobStatus(userId, id, EmployerJobStatus.PUBLISHED);
      res.json({ success: true, data: job });
    } catch (err) {
      next(err);
    }
  };

  pauseJob = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = this.getUserId(req);
      const id = String(req.params.id);
      const job = await this.service.updateJobStatus(userId, id, EmployerJobStatus.PAUSED);
      res.json({ success: true, data: job });
    } catch (err) {
      next(err);
    }
  };

  closeJob = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = this.getUserId(req);
      const id = String(req.params.id);
      const job = await this.service.updateJobStatus(userId, id, EmployerJobStatus.CLOSED);
      res.json({ success: true, data: job });
    } catch (err) {
      next(err);
    }
  };

  listJobApplications = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = this.getUserId(req);
      const id = String(req.params.id);
      const apps = await this.service.listJobApplications(userId, id);
      res.json({ success: true, data: apps });
    } catch (err) {
      next(err);
    }
  };

  getApplicationDetail = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = this.getUserId(req);
      const id = String(req.params.id);
      const app = await this.service.getApplicationDetail(userId, id);
      res.json({ success: true, data: app });
    } catch (err) {
      next(err);
    }
  };

  updateApplicationStage = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = this.getUserId(req);
      const id = String(req.params.id);
      const parsed = updateApplicationStageSchema.parse(req.body);
      const review = await this.service.updateApplicationStage(userId, id, parsed);
      res.json({ success: true, data: review });
    } catch (err) {
      next(err);
    }
  };

  addApplicationNote = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = this.getUserId(req);
      const id = String(req.params.id);
      const parsed = addApplicationNoteSchema.parse(req.body);
      const review = await this.service.addApplicationNote(userId, id, parsed);
      res.status(201).json({ success: true, data: review });
    } catch (err) {
      next(err);
    }
  };

  connectCareersUrl = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = this.getUserId(req);
      const { careersUrl } = req.body;
      if (!careersUrl || typeof careersUrl !== 'string') {
        res.status(400).json({ success: false, error: 'A valid careers URL is required' });
        return;
      }
      const result = await this.service.connectCareersUrl(userId, careersUrl);
      res.status(200).json({
        success: true,
        data: result,
        message: 'Careers URL connected and initial sync triggered successfully'
      });
    } catch (err) {
      next(err);
    }
  };

  searchCandidates = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = this.getUserId(req);
      const query = String(req.query.query || '');
      const skills = String(req.query.skills || '');
      const location = String(req.query.location || '');
      const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
      const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 20));

      const result = await this.service.searchCandidates(userId, {
        query: query || undefined,
        skills: skills || undefined,
        location: location || undefined,
        page,
        limit
      });
      res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  };

  listMembers = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = this.getUserId(req);
      const members = await this.service.listMembers(userId);
      res.status(200).json({ success: true, data: members });
    } catch (err) {
      next(err);
    }
  };

  addMember = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = this.getUserId(req);
      const { email, role, title } = req.body;
      if (!email || !role) {
        res.status(400).json({ success: false, error: 'Email and role are required' });
        return;
      }
      const member = await this.service.addMember(userId, { email, role, title });
      res.status(201).json({ success: true, data: member });
    } catch (err) {
      next(err);
    }
  };
}

