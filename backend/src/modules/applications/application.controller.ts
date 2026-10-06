import type { Request, Response, NextFunction } from 'express';
import { ApplicationService } from './application.service.js';
import { SavedJobService } from './saved-job.service.js';
import {
  CreateApplicationSchema,
  UpdateApplicationSchema,
  UpdateApplicationStatusSchema,
  CreateApplicationNoteSchema,
  CreateApplicationReminderSchema,
  ApplicationFilterSchema,
  SaveJobBodySchema
} from './application.schemas.js';

export class ApplicationController {
  // GET /api/v1/applications
  public static async listApplications(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const query = ApplicationFilterSchema.parse(req.query);
      const result = await ApplicationService.listApplications(userId, query);
      res.json({
        success: true,
        data: result.items,
        pagination: result.pagination
      });
    } catch (err) {
      next(err);
    }
  }

  // GET /api/v1/applications/stats
  public static async getStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const stats = await ApplicationService.getStats(userId);
      res.json({
        success: true,
        data: stats
      });
    } catch (err) {
      next(err);
    }
  }

  // GET /api/v1/applications/:id
  public static async getApplicationById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const application = await ApplicationService.getApplicationById(userId, id);
      res.json({
        success: true,
        data: application
      });
    } catch (err) {
      next(err);
    }
  }

  // POST /api/v1/applications
  public static async createApplication(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const body = CreateApplicationSchema.parse(req.body);
      const created = await ApplicationService.createApplication(userId, body);
      res.status(201).json({
        success: true,
        data: created
      });
    } catch (err) {
      next(err);
    }
  }

  // PATCH /api/v1/applications/:id
  public static async updateApplication(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const body = UpdateApplicationSchema.parse(req.body);
      const updated = await ApplicationService.updateApplication(userId, id, body);
      res.json({
        success: true,
        data: updated
      });
    } catch (err) {
      next(err);
    }
  }

  // DELETE /api/v1/applications/:id
  public static async deleteApplication(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await ApplicationService.deleteApplication(userId, id);
      res.json({
        success: true,
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  // POST /api/v1/applications/:id/status
  public static async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const body = UpdateApplicationStatusSchema.parse(req.body);
      const updated = await ApplicationService.updateStatus(userId, id, body);
      res.json({
        success: true,
        data: updated
      });
    } catch (err) {
      next(err);
    }
  }

  // GET /api/v1/applications/:id/history
  public static async getStatusHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const history = await ApplicationService.getStatusHistory(userId, id);
      res.json({
        success: true,
        data: history
      });
    } catch (err) {
      next(err);
    }
  }

  // GET /api/v1/applications/:id/notes
  public static async getNotes(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const notes = await ApplicationService.getNotes(userId, id);
      res.json({
        success: true,
        data: notes
      });
    } catch (err) {
      next(err);
    }
  }

  // POST /api/v1/applications/:id/notes
  public static async addNote(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const body = CreateApplicationNoteSchema.parse(req.body);
      const note = await ApplicationService.addNote(userId, id, body);
      res.status(201).json({
        success: true,
        data: note
      });
    } catch (err) {
      next(err);
    }
  }

  // DELETE /api/v1/applications/:id/notes/:noteId
  public static async deleteNote(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const noteId = Array.isArray(req.params.noteId) ? req.params.noteId[0] : req.params.noteId;
      const result = await ApplicationService.deleteNote(userId, id, noteId);
      res.json({
        success: true,
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  // GET /api/v1/applications/:id/reminders
  public static async getReminders(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const reminders = await ApplicationService.getReminders(userId, id);
      res.json({
        success: true,
        data: reminders
      });
    } catch (err) {
      next(err);
    }
  }

  // POST /api/v1/applications/:id/reminders
  public static async addReminder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const body = CreateApplicationReminderSchema.parse(req.body);
      const reminder = await ApplicationService.addReminder(userId, id, body);
      res.status(201).json({
        success: true,
        data: reminder
      });
    } catch (err) {
      next(err);
    }
  }

  // DELETE /api/v1/applications/:id/reminders/:reminderId
  public static async deleteReminder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const reminderId = Array.isArray(req.params.reminderId) ? req.params.reminderId[0] : req.params.reminderId;
      const result = await ApplicationService.deleteReminder(userId, id, reminderId);
      res.json({
        success: true,
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  // GET /api/v1/saved-jobs
  public static async listSavedJobs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const list = await SavedJobService.listSavedJobs(userId);
      res.json({
        success: true,
        data: list
      });
    } catch (err) {
      next(err);
    }
  }

  // POST /api/v1/saved-jobs/:jobId
  public static async saveJob(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const jobId = Array.isArray(req.params.jobId) ? req.params.jobId[0] : req.params.jobId;
      const body = SaveJobBodySchema.parse(req.body || {});
      const saved = await SavedJobService.saveJob(userId, jobId, body.notes);
      res.status(201).json({
        success: true,
        data: saved
      });
    } catch (err) {
      next(err);
    }
  }

  // DELETE /api/v1/saved-jobs/:jobId
  public static async removeSavedJob(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const jobId = Array.isArray(req.params.jobId) ? req.params.jobId[0] : req.params.jobId;
      const result = await SavedJobService.removeSavedJob(userId, jobId);
      res.json({
        success: true,
        data: result
      });
    } catch (err) {
      next(err);
    }
  }
}
