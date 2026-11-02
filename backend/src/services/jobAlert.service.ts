import crypto from 'crypto';
import { prisma } from '../database/prisma.js';
import { logger } from '../utils/logger.js';
import { JobRecommendationService } from './jobRecommendation.service.js';
import { calculateWorkHistoryExperienceYears } from '../utils/readiness.js';
import { EmailService } from './email/email.service.js';
import { MatchedJobAlertItem } from './email/emailTemplates.js';
import { JobAlertStatus, JobAlertTier } from '@prisma/client';
import { env } from '../config/env.js';

export class JobAlertService {
  private static UNSUBSCRIBE_SECRET = env.JWT_ACCESS_SECRET || 'pilotmama-unsubscribe-secret-salt';

  /**
   * Generate secure candidate unsubscribe token (HMAC-SHA256)
   */
  public static generateUnsubscribeToken(candidateId: string): string {
    const payload = `${candidateId}:${Date.now()}`;
    const hmac = crypto.createHmac('sha256', this.UNSUBSCRIBE_SECRET).update(payload).digest('hex');
    return Buffer.from(`${payload}:${hmac}`).toString('base64url');
  }

  /**
   * Verify candidate unsubscribe token
   */
  public static verifyUnsubscribeToken(token: string): { valid: boolean; candidateId?: string } {
    try {
      const decoded = Buffer.from(token, 'base64url').toString('utf8');
      const parts = decoded.split(':');
      if (parts.length !== 3) return { valid: false };

      const [candidateId, timestamp, receivedHmac] = parts;
      const expectedHmac = crypto
        .createHmac('sha256', this.UNSUBSCRIBE_SECRET)
        .update(`${candidateId}:${timestamp}`)
        .digest('hex');

      if (!crypto.timingSafeEqual(Buffer.from(receivedHmac, 'utf8'), Buffer.from(expectedHmac, 'utf8'))) {
        return { valid: false };
      }

      return { valid: true, candidateId };
    } catch {
      return { valid: false };
    }
  }

  /**
   * Unsubscribe candidate from job alerts using secure token
   */
  public static async unsubscribeByToken(token: string): Promise<{ success: boolean; message: string }> {
    const verification = this.verifyUnsubscribeToken(token);
    if (!verification.valid || !verification.candidateId) {
      return { success: false, message: 'Invalid or expired unsubscribe link.' };
    }

    await prisma.candidatePreference.upsert({
      where: { candidateProfileId: verification.candidateId },
      update: { jobAlertsEnabled: false },
      create: { candidateProfileId: verification.candidateId, jobAlertsEnabled: false }
    });

    logger.info(`[JobAlertService] Candidate ${verification.candidateId} unsubscribed from new job alerts via secure token`);
    return {
      success: true,
      message: 'You have been successfully unsubscribed from new job alert emails. You can re-enable alerts anytime in your profile settings.'
    };
  }

  /**
   * Evaluate a newly discovered canonical job against all eligible candidates and enqueue outbox entries
   */
  public static async evaluateAndEnqueue(job: any): Promise<{ evaluated: number; enqueued: number }> {
    if (!job || !job.id) {
      return { evaluated: 0, enqueued: 0 };
    }

    try {
      // 1. Fetch eligible candidates: verified email, active user, jobAlertsEnabled = true
      const candidateProfiles = await prisma.candidateProfile.findMany({
        where: {
          user: {
            isActive: true,
            emailVerified: true
          },
          OR: [
            { preferences: { jobAlertsEnabled: true } },
            { preferences: null }
          ]
        },
        include: {
          user: { select: { id: true, email: true } },
          preferences: true,
          skills: { include: { skill: true } },
          experiences: true,
          resumes: {
            where: { isMaster: true },
            take: 1
          }
        }
      });

      let enqueued = 0;

      for (const profile of candidateProfiles) {
        const candidateEmail = profile.email || profile.user.email;
        if (!candidateEmail) continue;

        // Extract candidate profile features
        const candidateSkillsList = profile.skills.map(s => s.skill.name);
        const preferredResume = profile.resumes[0];

        if (preferredResume?.parsedData) {
          const parsed = preferredResume.parsedData as any;
          if (Array.isArray(parsed.skills)) {
            parsed.skills.forEach((sk: string) => {
              if (sk && !candidateSkillsList.includes(sk)) candidateSkillsList.push(sk);
            });
          }
        }

        const candidateSkillsLower = new Set(candidateSkillsList.map(s => s.toLowerCase().trim()));

        // Extract target roles
        const rawTargetRoles: string[] = profile.preferences?.targetRoles || [];
        const candidateRoleCandidates: string[] = [];
        const splitRoles = (str?: string | null) => {
          if (!str || !str.trim()) return [];
          return str.split(/[/|,;]|(?:\s+or\s+)/i).map(r => r.trim()).filter(Boolean);
        };

        if (preferredResume?.parsedData && (preferredResume.parsedData as any).personalInfo?.headline) {
          candidateRoleCandidates.push(...splitRoles((preferredResume.parsedData as any).personalInfo.headline));
        }
        if (rawTargetRoles.length > 0) {
          for (const tr of rawTargetRoles) {
            candidateRoleCandidates.push(...splitRoles(tr));
          }
        }
        if (profile.headline) {
          candidateRoleCandidates.push(...splitRoles(profile.headline));
        }
        if (Array.isArray(profile.experiences)) {
          for (const exp of profile.experiences) {
            if (exp.jobTitle) candidateRoleCandidates.push(...splitRoles(exp.jobTitle));
          }
        }

        const dedupedRoles: string[] = [];
        for (const r of candidateRoleCandidates) {
          if (!dedupedRoles.some(d => d.toLowerCase() === r.toLowerCase())) {
            dedupedRoles.push(r);
          }
        }

        const primaryRole = dedupedRoles[0] || 'Software Engineer';
        const secondaryRoles = dedupedRoles.slice(1);
        const candidateLocation = profile.location || profile.city || '';
        const preferredLocations = (profile.preferences?.preferredLocations || []).map(l => l.toLowerCase());
        const remotePref = profile.preferences?.remotePreference || 'ANY';
        const workExpYears = calculateWorkHistoryExperienceYears(profile.experiences);
        const candidateExpYears = workExpYears > 0 ? workExpYears : (profile.experiences?.length || 2);

        // Evaluate relevance using the multi-factor scoring engine
        const evaluation = JobRecommendationService.evaluateJobRecommendation(job, {
          primaryRole,
          secondaryRoles,
          candidateSkillsLower,
          candidateExpYears,
          candidateLocation,
          preferredLocations,
          remotePref
        });

        // Minimum threshold check: Must be at least RELEVANT (>= 55%)
        let tier: JobAlertTier = JobAlertTier.NOT_RELEVANT;
        if (evaluation.score >= 70) {
          tier = JobAlertTier.HIGHLY_RELEVANT;
        } else if (evaluation.score >= 55) {
          tier = JobAlertTier.RELEVANT;
        }

        if (tier === JobAlertTier.NOT_RELEVANT) {
          continue;
        }

        // Check if outbox entry already exists (idempotency & retry-safety)
        const existingOutbox = await prisma.jobAlertOutbox.findUnique({
          where: {
            candidateId_jobId: {
              candidateId: profile.id,
              jobId: job.id
            }
          }
        });

        if (existingOutbox) {
          continue;
        }

        // Insert into outbox
        await prisma.jobAlertOutbox.create({
          data: {
            candidateId: profile.id,
            jobId: job.id,
            email: candidateEmail,
            status: JobAlertStatus.PENDING,
            relevanceScore: evaluation.score,
            relevanceTier: tier,
            reasonEvidence: {
              headline: evaluation.headline,
              reasons: evaluation.reasons,
              primaryRole,
              matchedTrack: evaluation.headline
            }
          }
        });

        enqueued++;
      }

      logger.info(`[JobAlertService] Evaluated new job "${job.title}" (${job.id}) against ${candidateProfiles.length} candidates -> enqueued ${enqueued} alerts`);
      return { evaluated: candidateProfiles.length, enqueued };
    } catch (err: any) {
      logger.error(`[JobAlertService] Error during job alert evaluation: ${err.message}`);
      return { evaluated: 0, enqueued: 0 };
    }
  }

  /**
   * Process pending outbox alerts with batching and retry backoff
   */
  public static async processOutboxBatch(batchLimit = 50): Promise<{ processed: number; sent: number; failed: number }> {
    const pendingAlerts = await prisma.jobAlertOutbox.findMany({
      where: {
        status: JobAlertStatus.PENDING,
        retryCount: { lt: 3 }
      },
      include: {
        candidate: {
          include: {
            user: { select: { emailVerified: true, isActive: true } },
            preferences: true
          }
        },
        job: {
          include: {
            company: { select: { name: true } }
          }
        }
      },
      take: batchLimit,
      orderBy: { createdAt: 'asc' }
    });

    if (pendingAlerts.length === 0) {
      return { processed: 0, sent: 0, failed: 0 };
    }

    // Group alerts by candidateId to avoid flooding candidate with separate emails
    const candidateGroupMap = new Map<string, typeof pendingAlerts>();
    for (const alert of pendingAlerts) {
      // Guard: Ensure candidate email is verified and jobAlertsEnabled is true
      if (!alert.candidate.user.emailVerified || !alert.candidate.user.isActive) {
        await prisma.jobAlertOutbox.update({
          where: { id: alert.id },
          data: { status: JobAlertStatus.CANCELLED, failedReason: 'Candidate account unverified or inactive' }
        });
        continue;
      }

      if (alert.candidate.preferences && alert.candidate.preferences.jobAlertsEnabled === false) {
        await prisma.jobAlertOutbox.update({
          where: { id: alert.id },
          data: { status: JobAlertStatus.CANCELLED, failedReason: 'Candidate disabled job alert notifications' }
        });
        continue;
      }

      const list = candidateGroupMap.get(alert.candidateId) || [];
      list.push(alert);
      candidateGroupMap.set(alert.candidateId, list);
    }

    let sentCount = 0;
    let failedCount = 0;
    const appBaseUrl = env.APP_BASE_URL || 'https://job-pilot-ai-pearl.vercel.app';

    for (const [candidateId, alerts] of candidateGroupMap.entries()) {
      const firstAlert = alerts[0];
      const candidateName = firstAlert.candidate.fullName.split(' ')[0] || 'Candidate';
      const candidateEmail = firstAlert.email;
      const unsubscribeToken = this.generateUnsubscribeToken(candidateId);

      // Build matched items list
      const matchedItems: MatchedJobAlertItem[] = alerts.map(a => {
        const evidence = (a.reasonEvidence as any) || {};
        const companyName = a.job.company?.name || a.job.sourceName || 'Hiring Company';
        const exp = a.job.experienceMin !== null && a.job.experienceMin !== undefined
          ? `${a.job.experienceMin}+ yrs`
          : 'Experience flexible';

        return {
          id: a.job.id,
          title: a.job.title,
          company: companyName,
          location: a.job.location || 'Flexible Location',
          workMode: a.job.remoteType || 'Full-time',
          experience: exp,
          descriptionSnippet: (a.job.description || '').slice(0, 160) + '...',
          relevanceScore: Math.round(a.relevanceScore),
          relevanceTier: a.relevanceTier,
          reasons: evidence.reasons || [],
          jobUrl: `${appBaseUrl}/jobs?jobId=${encodeURIComponent(a.job.id)}`
        };
      });

      // Mark all alerts in this group as SENDING
      const alertIds = alerts.map(a => a.id);
      await prisma.jobAlertOutbox.updateMany({
        where: { id: { in: alertIds } },
        data: { status: JobAlertStatus.SENDING }
      });

      // Send batched email
      const result = await EmailService.sendJobAlertEmail(
        candidateEmail,
        candidateName,
        matchedItems,
        unsubscribeToken
      );

      if (result.success) {
        await prisma.jobAlertOutbox.updateMany({
          where: { id: { in: alertIds } },
          data: {
            status: JobAlertStatus.SENT,
            sentAt: new Date(),
            providerMessageId: result.messageId
          }
        });
        sentCount += alertIds.length;
      } else {
        await prisma.jobAlertOutbox.updateMany({
          where: { id: { in: alertIds } },
          data: {
            status: JobAlertStatus.FAILED,
            failedAt: new Date(),
            failedReason: result.error || 'Email dispatch failed',
            retryCount: { increment: 1 }
          }
        });
        failedCount += alertIds.length;
      }
    }

    return { processed: pendingAlerts.length, sent: sentCount, failed: failedCount };
  }
}
