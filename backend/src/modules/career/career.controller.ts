import type { Request, Response, NextFunction } from 'express';
import { CareerService } from './career.service.js';
import {
  CreateLearningPlanSchema,
  UpdateLearningPlanItemSchema
} from './career.schemas.js';

export class CareerControllerV1 {
  /**
   * GET /api/v1/career/profile
   */
  public static async getCareerProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const targetJobId = req.query.targetJobId ? String(req.query.targetJobId) : undefined;
      const profile = await CareerService.getCareerProfile(userId, targetJobId);
      res.json({ success: true, data: profile });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/career/skills
   */
  public static async getCareerSkills(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const targetJobId = req.query.targetJobId ? String(req.query.targetJobId) : undefined;
      const skills = await CareerService.getCareerSkills(userId, targetJobId);
      res.json({ success: true, data: skills });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/career/learning-plan
   */
  public static async getLearningPlan(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const plans = await CareerService.getLearningPlans(userId);
      res.json({ success: true, data: plans });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/career/learning-plan
   */
  public static async createLearningPlan(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const input = CreateLearningPlanSchema.parse(req.body || {});
      const plan = await CareerService.createLearningPlan(userId, input);
      res.status(201).json({ success: true, data: plan });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PATCH /api/v1/career/learning-plan/items/:id
   */
  public static async updatePlanItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const itemId = String(req.params.id);
      const input = UpdateLearningPlanItemSchema.parse(req.body || {});
      const updated = await CareerService.updatePlanItem(userId, itemId, input);
      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }
}
