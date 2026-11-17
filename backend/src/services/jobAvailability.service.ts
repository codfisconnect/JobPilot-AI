import { prisma } from '../database/prisma.js';
import { logger } from '../utils/logger.js';
import { safeFetchUrl } from '../utils/safeFetch.js';

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
   * Covers RippleHire, Workday, Greenhouse, Lever, SmartRecruiters, and general ATSs.
   */
  public static readonly CLOSED_TEXT_PATTERNS: RegExp[] = [
    // RippleHire exact closed indicator
    /\b(?:this\s+job\s+opportunity\s+is\s+no\s+longer\s+available)\b/i,
    // Workday & Standard ATS indicators
    /\b(?:this\s+position\s+is\s+no\s+longer\s+available|position\s+is\s+no\s+longer\s+open)\b/i,
    /\b(?:the\s+job\s+you\s+are\s+looking\s+for\s+is\s+no\s+longer\s+open|the\s+job\s+you\s+are\s+looking\s+for\s+has\s+closed)\b/i,
    /\b(?:this\s+job\s+is\s+closed|job\s+is\s+no\s+longer\s+available)\b/i,
    /\b(?:no\s+longer\s+accepting\s+applications|not\s+accepting\s+applications)\b/i,
    /\b(?:this\s+position\s+has\s+been\s+filled|position\s+closed)\b/i,
    /\b(?:this\s+requisition\s+is\s+closed|requisition\s+has\s+closed)\b/i,
    /\b(?:job\s+has\s+expired|posting\s+expired|this\s+posting\s+has\s+closed)\b/i,
    /\b(?:applications?\s+for\s+this\s+role\s+are\s+now\s+closed)\b/i,
    /\b(?:job\s+opening\s+is\s+closed|opening\s+is\s+no\s+longer\s+active)\b/i
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
   * Performs an evidence-based live check against the employer job application URL or detail page.
   * If reliable closure evidence is confirmed, marks status as CLOSED and updates canonical record.
   * If inconclusive (e.g. network timeout or non-closing content), returns UNKNOWN without closing the job.
   */
  public static async checkLiveAvailability(job: {
    id: string;
    status?: string | null;
    applicationUrl?: string | null;
    sourceUrl?: string | null;
    sourceType?: string | null;
  }): Promise<JobAvailabilityResult> {
    const checkedAt = new Date().toISOString();

    // If already closed in DB, return immediately
    if (job.status === 'CLOSED' || job.status === 'EXPIRED' || job.status === 'REMOVED') {
      return {
        status: 'CLOSED',
        confidence: 100,
        evidence: `Database record status marked as ${job.status}`,
        checkedAt
      };
    }

    const targetUrl = job.applicationUrl || job.sourceUrl;
    if (!targetUrl || typeof targetUrl !== 'string' || !targetUrl.startsWith('http')) {
      return {
        status: 'UNKNOWN',
        confidence: 30,
        evidence: 'No valid external employer URL available for live inspection',
        checkedAt
      };
    }

    try {
      // 1. Specialized RippleHire Verification:
      // If target URL contains a RippleHire hash anchor like #detail/job/<jobSeq>
      const rippleHireJobSeqMatch = targetUrl.match(/ripplehire\.com.*?#detail\/job\/(\d+)/i) ||
        targetUrl.match(/#detail\/job\/(\d+)/i);

      if (rippleHireJobSeqMatch && targetUrl.includes('ripplehire.com')) {
        const jobSeq = rippleHireJobSeqMatch[1];
        const parsedUrl = new URL(targetUrl);
        const token = parsedUrl.searchParams.get('token');
        const source = parsedUrl.searchParams.get('source') || 'CAREERSITE';

        if (token) {
          try {
            // Check via RippleHire's candidate search endpoint to see if requisition is still listed
            const searchEndpoint = `${parsedUrl.origin}/candidate/candidatejobsearch`;
            const searchParams = {
              page: 0,
              search: `jobSeq:${jobSeq}`,
              token,
              source,
              pagesize: 5
            };
            const formBody = new URLSearchParams();
            formBody.append('careerSiteUrlParams', JSON.stringify(searchParams));
            formBody.append('lang', 'en');

            const rhRes = await safeFetchUrl(searchEndpoint, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'Accept': 'application/json'
              },
              body: formBody.toString(),
              timeoutMs: 6000
            });

            if (rhRes.status === 200 && rhRes.text) {
              const rhData = JSON.parse(rhRes.text);
              const list: any[] = rhData?.jobVoList || rhData?.data?.jobVoList || [];
              const foundInList = list.some((item: any) => String(item.jobSeq) === String(jobSeq));

              if (!foundInList && rhData?.totalJobCount !== undefined) {
                // Not found in active portal listing - confirmed closed opportunity
                const evidence = 'This job opportunity is no longer available on RippleHire employer portal';
                await this.markJobClosed(job.id, evidence, checkedAt);
                return {
                  status: 'CLOSED',
                  confidence: 95,
                  evidence,
                  checkedAt
                };
              } else if (foundInList) {
                return {
                  status: 'OPEN',
                  confidence: 90,
                  evidence: 'Requisition active in RippleHire employer portal',
                  checkedAt
                };
              }
            }
          } catch (rhErr: any) {
            logger.warn(`[JobAvailabilityService] RippleHire API check failed for job ${job.id}: ${rhErr.message}`);
          }
        }
      }

      // 2. Universal HTTP Page Inspection
      const fetchRes = await safeFetchUrl(targetUrl, {
        timeoutMs: 6000,
        maxResponseSizeBytes: 2 * 1024 * 1024 // 2MB max
      });

      // HTTP 404 or 410 Gone indicates posting was removed
      if (fetchRes.status === 404 || fetchRes.status === 410) {
        const evidence = `Employer portal returned HTTP ${fetchRes.status} (Resource removed or not found)`;
        await this.markJobClosed(job.id, evidence, checkedAt);
        return {
          status: 'CLOSED',
          confidence: 95,
          evidence,
          checkedAt
        };
      }

      // Check for closure notices in returned text/HTML
      if (fetchRes.text) {
        for (const pattern of this.CLOSED_TEXT_PATTERNS) {
          if (pattern.test(fetchRes.text)) {
            const evidence = `Employer page confirmed closed: ${pattern.source}`;
            await this.markJobClosed(job.id, evidence, checkedAt);
            return {
              status: 'CLOSED',
              confidence: 95,
              evidence,
              checkedAt
            };
          }
        }
      }

      // If HTTP 200 and no closure notice found
      if (fetchRes.status === 200) {
        return {
          status: 'OPEN',
          confidence: 85,
          evidence: 'Employer page active with no closure notice',
          checkedAt
        };
      }

      return {
        status: 'UNKNOWN',
        confidence: 45,
        evidence: `Employer page returned HTTP ${fetchRes.status}`,
        checkedAt
      };
    } catch (err: any) {
      // Inconclusive due to network timeout or connectivity: do NOT mark closed
      logger.warn(`[JobAvailabilityService] Live availability check inconclusive for ${job.id}: ${err.message}`);
      return {
        status: 'UNKNOWN',
        confidence: 40,
        evidence: `Live check inconclusive: ${err.message}`,
        checkedAt
      };
    }
  }

  /**
   * Updates database record status to CLOSED and records closure timestamp
   */
  public static async markJobClosed(jobId: string, evidence: string, checkedAt: string): Promise<void> {
    try {
      await prisma.job.update({
        where: { id: jobId },
        data: {
          status: 'CLOSED',
          lastCheckedAt: new Date(checkedAt)
        }
      });
      logger.info(`[JobAvailabilityService] Marked job ${jobId} as CLOSED in database: ${evidence}`);
    } catch (err: any) {
      logger.warn(`[JobAvailabilityService] Failed to mark job ${jobId} as CLOSED: ${err.message}`);
    }
  }

  /**
   * Verifies whether a specific job by ID in the database is open before allowing application submission.
   * If checkLive is true, performs live verification against employer site.
   */
  public static async verifyJobAvailability(jobId: string, checkLive = false): Promise<JobAvailabilityResult> {
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

      if (job.status === 'CLOSED' || job.status === 'EXPIRED' || job.status === 'REMOVED') {
        return {
          status: 'CLOSED',
          confidence: 100,
          evidence: `Database record status marked as ${job.status}`,
          checkedAt: new Date().toISOString()
        };
      }

      if (checkLive) {
        return await this.checkLiveAvailability(job);
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


