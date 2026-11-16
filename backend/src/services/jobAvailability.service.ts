import { prisma } from '../database/prisma.js';
import { logger } from '../utils/logger.js';

export type AvailabilityStatus = 'OPEN' | 'CLOSED' | 'UNKNOWN';

export interface JobAvailabilityResult {
  status: AvailabilityStatus;
  confidence: number; // 0 - 100
  evidence: string;
  sourceType?: string;
  checkedAt: string;
  closingDate?: string | null;
}

export class JobAvailabilityService {
  /**
   * Keywords strongly indicating a posting has been closed or unlisted
   */
  private static readonly CLOSED_TEXT_PATTERNS: RegExp[] = [
    /\b(?:this\s+job\s+is\s+closed|job\s+is\s+no\s+longer\s+available)\b/i,
    /\b(?:no\s+longer\s+accepting\s+applications|not\s+accepting\s+applications)\b/i,
    /\b(?:this\s+position\s+has\s+been\s+filled|position\s+closed)\b/i,
    /\b(?:this\s+requisition\s+is\s+closed|requisition\s+has\s+closed)\b/i,
    /\b(?:job\s+has\s+expired|posting\s+expired)\b/i,
    /\b(?:applications?\s+for\s+this\s+role\s+are\s+now\s+closed)\b/i
  ];

  /**
   * Detects availability from structured job records, external API payload, or HTML content
   */
  public static detectAvailability(
    job: {
      status?: string | null;
      validThrough?: Date | string | null;
      metadata?: any;
      applicationUrl?: string | null;
      sourceUrl?: string | null;
    },
    rawPayload?: any,
    pageHtml?: string
  ): JobAvailabilityResult {
    const checkedAt = new Date().toISOString();

    // 1. Check explicit database status
    if (job.status === 'CLOSED' || job.status === 'EXPIRED' || job.status === 'REMOVED') {
      return {
        status: 'CLOSED',
        confidence: 100,
        evidence: `Database record status marked as ${job.status}`,
        checkedAt
      };
    }

    // 2. Check structured closing date (validThrough)
    const validThroughDate = job.validThrough || (rawPayload && (rawPayload.validThrough || rawPayload.valid_through || rawPayload.closingDate || rawPayload.expireDttm));
    if (validThroughDate) {
      const parsedDate = new Date(validThroughDate);
      if (!isNaN(parsedDate.getTime())) {
        if (parsedDate.getTime() < Date.now()) {
          return {
            status: 'CLOSED',
            confidence: 95,
            evidence: `Structured validThrough date expired on ${parsedDate.toISOString()}`,
            checkedAt,
            closingDate: parsedDate.toISOString()
          };
        }
      }
    }

    // 3. Inspect raw ATS payload status flags if available
    if (rawPayload && typeof rawPayload === 'object') {
      const atsStatus = String(rawPayload.status || rawPayload.jobStatus || rawPayload.state || '').toUpperCase();
      if (['CLOSED', 'INACTIVE', 'EXPIRED', 'FILLED', 'ARCHIVED', 'CANCELLED'].includes(atsStatus)) {
        return {
          status: 'CLOSED',
          confidence: 95,
          evidence: `Employer ATS reported status as ${atsStatus}`,
          checkedAt
        };
      }

      if (['ACTIVE', 'OPEN', 'PUBLISHED'].includes(atsStatus)) {
        return {
          status: 'OPEN',
          confidence: 90,
          evidence: `Employer ATS reported status as ${atsStatus}`,
          checkedAt
        };
      }
    }

    // 4. Inspect HTML content evidence if provided (e.g. from scraping or crawler inspection)
    if (pageHtml && typeof pageHtml === 'string') {
      for (const pattern of this.CLOSED_TEXT_PATTERNS) {
        if (pattern.test(pageHtml)) {
          return {
            status: 'CLOSED',
            confidence: 90,
            evidence: `Job page contains closure notice matching pattern: ${pattern.source}`,
            checkedAt
          };
        }
      }
    }

    // 5. If status is ACTIVE and no closing signals detected
    if (job.status === 'ACTIVE') {
      return {
        status: 'OPEN',
        confidence: 80,
        evidence: 'Job record is active with no closing indicators',
        checkedAt
      };
    }

    return {
      status: 'UNKNOWN',
      confidence: 50,
      evidence: 'No conclusive availability signals detected',
      checkedAt
    };
  }

  /**
   * Verifies whether a specific job by ID in the database is open before allowing application submission
   */
  public static async verifyJobAvailability(jobId: string): Promise<JobAvailabilityResult> {
    try {
      const job = await prisma.job.findUnique({
        where: { id: jobId },
        select: {
          id: true,
          status: true,
          applicationUrl: true,
          sourceUrl: true,
          sourceType: true,
          updatedAt: true
        }
      });

      if (!job) {
        return {
          status: 'CLOSED',
          confidence: 100,
          evidence: 'Job does not exist in canonical database',
          checkedAt: new Date().toISOString()
        };
      }

      return this.detectAvailability(job);
    } catch (err: any) {
      logger.warn(`[JobAvailabilityService] Failed to check availability for job ${jobId}: ${err.message}`);
      return {
        status: 'UNKNOWN',
        confidence: 40,
        evidence: `Availability lookup encountered temporary error: ${err.message}`,
        checkedAt: new Date().toISOString()
      };
    }
  }
}

