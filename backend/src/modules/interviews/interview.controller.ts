import type { Request, Response, NextFunction } from 'express';
import { InterviewService } from './interview.service.js';
import {
  CreateInterviewSessionSchema,
  GenerateQuestionsSchema,
  SubmitAnswerSchema
} from './interview.schemas.js';

export class InterviewControllerV1 {
  /**
   * POST /api/v1/jobs/:id/interview/sessions
   * Create interview session for job
   */
  public static async createSessionForJob(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const jobId = String(req.params.id);
      const { resumeVersionId } = CreateInterviewSessionSchema.parse(req.body || {});

      const session = await InterviewService.createSession(userId, jobId, resumeVersionId);
      res.status(201).json({ success: true, data: session });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/interview/sessions
   * List interview sessions for candidate
   */
  public static async getSessions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const sessions = await InterviewService.getSessions(userId);
      res.json({ success: true, data: sessions });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/interview/sessions/:id
   * Get specific session details and questions
   */
  public static async getSessionById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const sessionId = String(req.params.id);
      const session = await InterviewService.getSessionById(userId, sessionId);
      res.json({ success: true, data: session });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/interview/sessions/:id/questions
   * Generate new or additional questions for a session
   */
  public static async generateQuestions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const sessionId = String(req.params.id);
      const validatedInput = GenerateQuestionsSchema.parse(req.body || {});

      const profile = await InterviewService.assertCandidateProfile(userId);
      const questions = await InterviewService.generateQuestionsForSession(
        profile.id,
        sessionId,
        validatedInput
      );

      res.status(201).json({ success: true, data: questions });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/interview/questions/:id/answer
   * Submit an answer for a question
   */
  public static async submitAnswer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const questionId = String(req.params.id);
      const { answerText } = SubmitAnswerSchema.parse(req.body);

      const answer = await InterviewService.submitAnswer(userId, questionId, answerText);
      res.status(201).json({ success: true, data: answer });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/interview/questions/:id/evaluate
   * Evaluate candidate's answer for question
   */
  public static async evaluateAnswer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const questionId = String(req.params.id);
      const answerId = req.body?.answerId ? String(req.body.answerId) : undefined;

      const evaluation = await InterviewService.evaluateAnswer(userId, questionId, answerId);
      res.status(200).json({ success: true, data: evaluation });
    } catch (err) {
      next(err);
    }
  }
}
