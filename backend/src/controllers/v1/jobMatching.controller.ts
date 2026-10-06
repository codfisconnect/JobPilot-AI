import type { Request, Response, NextFunction } from 'express';
import { ProductionMatchingService } from '../../services/matching.service.js';

export class JobMatchingControllerV1 {
  public static async getMatch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const jobId = req.params.id as string;
      const match = await ProductionMatchingService.analyzeFit(userId, jobId, false);
      res.json({ success: true, data: match });
    } catch (err) {
      next(err);
    }
  }

  public static async recalculateMatch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const jobId = req.params.id as string;
      const match = await ProductionMatchingService.analyzeFit(userId, jobId, true);
      res.json({ success: true, data: match });
    } catch (err) {
      next(err);
    }
  }

  public static async getSkillGap(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const jobId = req.params.id as string;
      const skillGaps = await ProductionMatchingService.getSkillGaps(userId, jobId);
      res.json({ success: true, data: skillGaps });
    } catch (err) {
      next(err);
    }
  }

  public static async tailorResume(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const jobId = req.params.id as string;
      const mode = (req.body.mode || 'TARGETED') as 'FULL' | 'FOCUSED' | 'TARGETED';
      const tailored = await ProductionMatchingService.tailorResume(userId, jobId, mode);
      res.status(201).json({ success: true, data: tailored });
    } catch (err) {
      next(err);
    }
  }

  public static async getTailoredResumes(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const jobId = req.params.id as string;
      const versions = await ProductionMatchingService.getTailoredResumesForJob(userId, jobId);
      res.json({ success: true, data: versions });
    } catch (err) {
      next(err);
    }
  }
}
