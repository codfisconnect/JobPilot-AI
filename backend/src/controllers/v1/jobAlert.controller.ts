import type { Request, Response, NextFunction } from 'express';
import { JobAlertService } from '../../services/jobAlert.service.js';
import { prisma } from '../../database/prisma.js';

export class JobAlertController {
  /**
   * GET /api/v1/alerts/unsubscribe?token=...
   * Public unsubscribe endpoint with cryptographic token verification
   */
  public static async unsubscribe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const token = req.query.token as string;
      if (!token) {
        res.status(400).send(`
          <html>
            <body style="font-family: sans-serif; text-align: center; padding: 40px; background: #f8fafc;">
              <h2 style="color: #dc2626;">Invalid Unsubscribe Request</h2>
              <p>Missing or invalid unsubscribe token.</p>
            </body>
          </html>
        `);
        return;
      }

      const outcome = await JobAlertService.unsubscribeByToken(token);
      res.send(`
        <html>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; text-align: center; padding: 60px 20px; background: #f8fafc;">
            <div style="max-width: 500px; margin: 0 auto; background: #fff; padding: 40px; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
              <h2 style="color: #0f172a; margin-top: 0;">${outcome.success ? '✓ Unsubscribed' : 'Unsubscribe Notice'}</h2>
              <p style="color: #475569; font-size: 15px; line-height: 1.6;">${outcome.message}</p>
              <div style="margin-top: 24px;">
                <a href="/" style="display: inline-block; background: #4f46e5; color: #fff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 14px;">Return to Pilot Mama</a>
              </div>
            </div>
          </body>
        </html>
      `);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/alerts/preferences
   * Authenticated candidate notification preferences
   */
  public static async getPreferences(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const profile = await prisma.candidateProfile.findUnique({
        where: { userId },
        include: { preferences: true }
      });

      const jobAlertsEnabled = profile?.preferences?.jobAlertsEnabled ?? true;

      res.json({
        success: true,
        data: {
          jobAlertsEnabled
        }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PUT /api/v1/alerts/preferences
   * Toggle job alerts notification preference
   */
  public static async updatePreferences(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { jobAlertsEnabled } = req.body;

      const profile = await prisma.candidateProfile.findUnique({
        where: { userId }
      });

      if (!profile) {
        res.status(404).json({ success: false, message: 'Candidate profile not found' });
        return;
      }

      await prisma.candidatePreference.upsert({
        where: { candidateProfileId: profile.id },
        update: { jobAlertsEnabled: Boolean(jobAlertsEnabled) },
        create: { candidateProfileId: profile.id, jobAlertsEnabled: Boolean(jobAlertsEnabled) }
      });

      res.json({
        success: true,
        data: {
          jobAlertsEnabled: Boolean(jobAlertsEnabled)
        }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/alerts/process
   * Trigger processing of pending outbox queue
   */
  public static async processQueue(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await JobAlertService.processOutboxBatch(req.body?.batchLimit || 50);
      res.json({
        success: true,
        data: result
      });
    } catch (err) {
      next(err);
    }
  }
}
