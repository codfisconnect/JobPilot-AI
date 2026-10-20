import { IJobSourceStrategy, StrategyContext, StrategyExecutionResult } from '../strategy.interface.js';
import { safeFetchUrl } from '../../utils/safeFetch.js';
import { CompletenessEstimatorService } from '../completenessEstimator.service.js';
import { DiscoveredJobRaw } from '../types.js';
import { logger } from '../../utils/logger.js';
import { safeParseJson } from '../../utils/safeJson.js';
import * as cheerio from 'cheerio';

export class RippleHireAdapter implements IJobSourceStrategy {
  public readonly name = 'RIPPLEHIRE_ADAPTER';
  public readonly priority = 10; // High priority accelerator

  public canHandle(context: StrategyContext): boolean {
    if (context.fingerprint.atsVendor === 'RIPPLEHIRE') return true;
    if (context.normalizedUrl.domain.includes('ripplehire.com')) return true;
    if (context.initialHtml && context.initialHtml.toLowerCase().includes('ripplehire')) return true;
    return false;
  }

  public async execute(context: StrategyContext): Promise<StrategyExecutionResult> {
    const { normalizedUrl, initialHtml } = context;
    const baseUrl = normalizedUrl.baseUrl;
    const token = normalizedUrl.searchParams.token || 'ncskoGgjoqYnuqre7tUl';
    const source = normalizedUrl.searchParams.source || 'CAREERSITE';

    // Derive company name safely
    let companyName = normalizedUrl.domain.split('.')[0];
    companyName = companyName.charAt(0).toUpperCase() + companyName.slice(1);
    if (initialHtml) {
      const $ = cheerio.load(initialHtml);
      const title = $('title').text();
      if (title.includes('Careers') || title.includes('|')) {
        const parts = title.split(/[|\-]/);
        if (parts[0] && parts[0].trim()) {
          companyName = parts[0].replace(/Careers/i, '').trim() || companyName;
        }
      }
    }

    const endpoint = `${baseUrl}/candidate/candidatejobsearch`;
    logger.info(`[RippleHireAdapter] Querying RippleHire endpoint for token: [REDACTED] at ${baseUrl}`);

    const allJobs: DiscoveredJobRaw[] = [];
    let expectedCount: number | null = null;
    const pageSize = 50;
    let page = 0;
    const maxPages = 20; // Bound to protect against runaway pagination

    while (page < maxPages) {
      const searchParams = {
        page,
        search: '*:*',
        token,
        source,
        pagesize: pageSize
      };

      const formBody = new URLSearchParams();
      formBody.append('careerSiteUrlParams', JSON.stringify(searchParams));
      formBody.append('lang', 'en');

      try {
        const res = await safeFetchUrl(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'Accept': 'application/json'
          },
          body: formBody.toString(),
          timeoutMs: 12000
        });

        if (res.status !== 200) {
          logger.warn(`[RippleHireAdapter] Response status ${res.status} on page ${page}`);
          break;
        }

        const jsonResult = safeParseJson(res.text, res.contentType || res.headers?.['content-type']);
        if (!jsonResult.success || !jsonResult.data) {
          logger.warn(`[RippleHireAdapter] Non-JSON payload on page ${page}`);
          break;
        }

        const data = jsonResult.data;
        if (expectedCount === null && data.totalJobCount !== undefined) {
          expectedCount = data.totalJobCount;
        }

        const rawList = data.jobVoList || [];
        if (!Array.isArray(rawList) || rawList.length === 0) {
          break;
        }

        for (const item of rawList) {
          const jobSeq = item.jobSeq || item.jobId;
          const appUrl = `${baseUrl}/candidate/?token=${token}&source=${source}#detail/job/${jobSeq}`;
          
          allJobs.push({
            externalJobId: String(jobSeq || item.jobCode || ''),
            title: item.jobTitle || 'Job Opening',
            location: item.locations || item.jobLocation || undefined,
            experience: item.jobReqExp || (item.jobMinExp ? `${item.jobMinExp} - ${item.jobMaxExp || ''} Years` : undefined),
            description: item.jobDesc || `${item.jobTitle || 'Role'} - Requisition ${item.jobCode || jobSeq || ''}`,
            employmentType: item.jobType || 'FULL_TIME',
            applicationUrl: appUrl,
            rawPayload: item
          });
        }

        if (rawList.length < pageSize || allJobs.length >= (expectedCount || 0)) {
          break; // Completed all available pages
        }

        page++;
      } catch (err: any) {
        logger.error(`[RippleHireAdapter] Error fetching page ${page}: ${err.message}`);
        break;
      }
    }

    const completenessEval = CompletenessEstimatorService.evaluate(allJobs.length, expectedCount);

    return {
      matched: allJobs.length > 0,
      strategyName: this.name,
      sourceType: 'SPECIALIZED_ATS',
      atsType: 'RIPPLEHIRE',
      jobsEndpoint: endpoint,
      httpMethod: 'POST',
      companyName,
      officialDomain: normalizedUrl.domain,
      jobs: allJobs,
      expectedJobCount: expectedCount,
      completeness: completenessEval.completeness,
      paginationSupported: true,
      paginationConfig: {
        strategy: 'PAGE_OFFSET',
        pageSize,
        maxPages
      },
      mappingConfig: {
        externalJobIdField: 'jobSeq',
        titleField: 'jobTitle',
        locationField: 'locations',
        experienceField: 'jobReqExp',
        descriptionField: 'jobDesc',
        applicationUrlField: 'applicationUrl'
      }
    };
  }
}
