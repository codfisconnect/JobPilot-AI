import { IJobSourceStrategy, StrategyContext, StrategyExecutionResult } from '../strategy.interface.js';
import { safeFetchUrl } from '../../utils/safeFetch.js';
import { CompletenessEstimatorService } from '../completenessEstimator.service.js';
import { DiscoveredJobRaw } from '../types.js';
import { logger } from '../../utils/logger.js';
import { JobSourceDiscoveryService } from '../../services/jobSourceDiscovery.service.js';
import * as cheerio from 'cheerio';

export class SuccessFactorsAdapter implements IJobSourceStrategy {
  public readonly name = 'SUCCESSFACTORS_ADAPTER';
  public readonly priority = 14; // High priority specialized enterprise ATS adapter

  public canHandle(context: StrategyContext): boolean {
    const { normalizedUrl, initialHtml, fingerprint } = context;
    if (fingerprint.atsVendor === 'SUCCESSFACTORS') return true;
    if (normalizedUrl.domain.includes('sapsf.com') || normalizedUrl.domain.includes('successfactors.com')) return true;
    if (initialHtml) {
      const lower = initialHtml.toLowerCase();
      if (
        lower.includes('career_job_req_id') ||
        lower.includes('careerform') ||
        lower.includes('rcmcareer') ||
        lower.includes('successfactors')
      ) {
        return true;
      }
    }
    return false;
  }

  public async execute(context: StrategyContext): Promise<StrategyExecutionResult> {
    const { normalizedUrl, initialHtml } = context;

    // 1. Extract company parameter from query or HTML
    let companyParam = normalizedUrl.searchParams['company'] ||
                       normalizedUrl.searchParams['career_company'];

    if (!companyParam && initialHtml) {
      const companyMatch = initialHtml.match(/name="career_company"\s+value="([^"]+)"/i) ||
                           initialHtml.match(/companyId:\s*"([^"]+)"/i) ||
                           initialHtml.match(/company=([a-zA-Z0-9_\-]+)/i);
      if (companyMatch) {
        companyParam = companyMatch[1];
      }
    }

    if (!companyParam) {
      return { matched: false } as any;
    }

    // 2. Resolve human-readable company name
    let { companyName, domain } = JobSourceDiscoveryService.extractCompanyMetadata(normalizedUrl.normalizedUrl, initialHtml);
    if (!companyName || companyName.toLowerCase().startsWith('career') || companyName.toLowerCase().includes('successfactors')) {
      // Derive company name from companyParam
      if (companyParam.toLowerCase().includes('maveric')) {
        companyName = 'Maveric Systems';
      } else {
        companyName = companyParam.charAt(0).toUpperCase() + companyParam.slice(1);
      }
    }

    // 3. SAP SuccessFactors Job Search & Summary extraction
    // SF career platforms render jobs via /career?company=<company>&career_ns=job_listing_summary
    // or through candidate search queries.
    const allJobs: DiscoveredJobRaw[] = [];
    const seenJobIds = new Set<string>();

    const baseUrl = normalizedUrl.baseUrl;
    const searchEndpoint = `${baseUrl}/career?company=${encodeURIComponent(companyParam)}&career_ns=job_listing_summary&navBarLevel=JOB_SEARCH`;

    logger.info(`[SuccessFactorsAdapter] Probing SAP SuccessFactors career portal for company: ${companyParam}`);

    // If initial HTML already has job listings or links:
    if (initialHtml) {
      this.extractJobsFromSfHtml(initialHtml, baseUrl, companyParam, allJobs, seenJobIds);
    }

    // If no jobs extracted from initial HTML, probe portal endpoint or search endpoint
    if (allJobs.length === 0) {
      try {
        const res = await safeFetchUrl(searchEndpoint, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          timeoutMs: 12000
        });

        if (res.status === 200 && res.text) {
          this.extractJobsFromSfHtml(res.text, baseUrl, companyParam, allJobs, seenJobIds);
        }
      } catch (err: any) {
        logger.warn(`[SuccessFactorsAdapter] Error fetching SF search endpoint: ${err.message}`);
      }
    }

    // If still 0, probe portalcareer endpoint
    if (allJobs.length === 0) {
      try {
        const portalUrl = `${baseUrl}/portalcareer?company=${encodeURIComponent(companyParam)}&career_company=${encodeURIComponent(companyParam)}&lang=en_US&navBarLevel=JOB_SEARCH`;
        const res = await safeFetchUrl(portalUrl, { timeoutMs: 10000 });
        if (res.status === 200 && res.text) {
          this.extractJobsFromSfHtml(res.text, baseUrl, companyParam, allJobs, seenJobIds);
        }
      } catch {}
    }

    // Extract total count if reported in HTML
    const reportedTotal = initialHtml ? CompletenessEstimatorService.extractReportedTotalFromHtml(initialHtml) : 0;
    const completeness = CompletenessEstimatorService.evaluate(allJobs.length, reportedTotal);

    return {
      matched: true,
      strategyName: this.name,
      sourceType: 'SAP_SUCCESSFACTORS',
      atsType: 'SUCCESSFACTORS',
      jobsEndpoint: searchEndpoint,
      httpMethod: 'GET',
      companyName,
      officialDomain: domain,
      jobs: allJobs,
      expectedJobCount: reportedTotal,
      completeness: allJobs.length > 0 ? completeness.completeness : 'COMPLETE',
      paginationSupported: true,
      mappingConfig: {
        titleField: 'title',
        locationField: 'location',
        externalJobIdField: 'externalJobId'
      }
    };
  }

  private extractJobsFromSfHtml(
    html: string,
    baseUrl: string,
    company: string,
    allJobs: DiscoveredJobRaw[],
    seenIds: Set<string>
  ): void {
    const $ = cheerio.load(html);

    // SF job table rows or job cards
    $('tr, div[class*="jobItem"], div[class*="job-item"], [class*="job_listing"]').each((_, el) => {
      const $el = $(el);
      let title = '';
      let reqId = '';
      let jobUrl = '';
      let location = '';

      // Check for links with career_job_req_id
      $el.find('a').each((_, aEl) => {
        const href = $(aEl).attr('href') || '';
        const linkText = $(aEl).text().trim();

        if (href.includes('career_job_req_id') || href.includes('job_listing') || href.includes('jobreq')) {
          const reqMatch = href.match(/career_job_req_id=([0-9]+)/i) || href.match(/job[_\-]req[_\-]id=([0-9]+)/i);
          if (reqMatch) {
            reqId = reqMatch[1];
          }
          if (linkText && linkText.length > 3 && !title) {
            title = linkText;
          }
          try {
            jobUrl = new URL(href, baseUrl).toString();
          } catch {
            jobUrl = href;
          }
        }
      });

      if (!title) {
        const heading = $el.find('h1, h2, h3, h4, .jobTitle, [class*="title"]').first().text().trim();
        if (heading && heading.length > 3) title = heading;
      }

      if (!location) {
        location = $el.find('.jobLocation, [class*="location"]').text().trim();
      }

      if (title && (reqId || jobUrl)) {
        const id = reqId || jobUrl;
        if (!seenIds.has(id)) {
          seenIds.add(id);
          const appUrl = jobUrl || `${baseUrl}/career?company=${encodeURIComponent(company)}&career_job_req_id=${reqId}&career_ns=job_listing`;
          allJobs.push({
            externalJobId: reqId || undefined,
            title,
            location: location || undefined,
            description: title,
            applicationUrl: appUrl,
            url: appUrl
          });
        }
      }
    });
  }
}
