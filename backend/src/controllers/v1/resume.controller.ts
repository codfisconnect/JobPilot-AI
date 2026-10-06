import type { Request, Response, NextFunction } from 'express';
import { ResumeService } from '../../services/resume.service.js';

export class ResumeControllerV1 {
  public static async uploadResume(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const title = req.body?.title;
      const resume = await ResumeService.uploadResume(userId, req.file, title);
      res.status(201).json({ success: true, data: resume });
    } catch (err) {
      next(err);
    }
  }

  public static async listResumes(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const resumes = await ResumeService.getResumes(userId);
      res.json({ success: true, data: resumes });
    } catch (err) {
      next(err);
    }
  }

  public static async getResume(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const id = String(req.params.id);
      const resume = await ResumeService.getResumeById(userId, id);
      res.json({ success: true, data: resume });
    } catch (err) {
      next(err);
    }
  }

  public static async deleteResume(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const id = String(req.params.id);
      await ResumeService.archiveResume(userId, id);
      res.json({ success: true, message: 'Resume archived successfully' });
    } catch (err) {
      next(err);
    }
  }

  public static async parseResume(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const id = String(req.params.id);
      const parsedData = await ResumeService.parseResume(userId, id);
      res.json({ success: true, data: parsedData });
    } catch (err) {
      next(err);
    }
  }

  public static async confirmParsedResume(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const id = String(req.params.id);
      const updatedProfile = await ResumeService.saveReviewedResumeData(userId, id, req.body);
      res.json({ success: true, data: updatedProfile });
    } catch (err) {
      next(err);
    }
  }

  public static async listVersions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const id = String(req.params.id);
      const versions = await ResumeService.getVersions(userId, id);
      res.json({ success: true, data: versions });
    } catch (err) {
      next(err);
    }
  }

  public static async createVersion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const id = String(req.params.id);
      const title = req.body?.title;
      const version = await ResumeService.createVersion(userId, id, title);
      res.status(201).json({ success: true, data: version });
    } catch (err) {
      next(err);
    }
  }

  public static async getVersionById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const id = String(req.params.id);
      const version = await ResumeService.getVersionById(userId, id);
      res.json({ success: true, data: version });
    } catch (err) {
      next(err);
    }
  }
}
