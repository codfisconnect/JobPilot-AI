import { IJobSourceStrategy, StrategyContext, StrategyExecutionResult } from '../strategy.interface.js';
import { safeFetchUrl } from '../../utils/safeFetch.js';
import { CompletenessEstimatorService } from '../completenessEstimator.service.js';
import { DiscoveredJobRaw } from '../types.js';
import { logger } from '../../utils/logger.js';
import * as cheerio from 'cheerio';

export class WorkdayAdapter implements IJobSourceStrategy {
  public readonly name = 'WORKDAY_ADAPTER';
  public readonly priority = 11;

  public canHandle(context: StrategyContext): boolean {
    if (context.fingerprint.atsVendor === 'WORKDAY') return true;
    if (context.normalizedUrl.domain.includes('myworkdayjobs.com') || context.normalizedUrl.domain.includes('workday.com')) return true;
    return false;
  }

  public async execute(context: StrategyContext): Promise<StrategyExecutionResult> {
    const { normalizedUrl, initialHtml } = context;
    let tenant = '';
    let site = '';

    // Typical Workday URL: https://tenant.wd3.myworkdayjobs.com/SiteName or https://company.myworkdayjobs.com/careers
    const hostParts = normalizedUrl.domain.split('.');
    tenant = hostParts[0];

    const pathParts = new URL(normalizedUrl.normalizedUrl).pathname.split('/').filter(Boolean);
    site = pathParts[0] || 'External';

    let companyName = tenant.charAt(0).toUpperCase() + tenant.slice(1);
    if (initialHtml) {
      const $ = cheerio.load(initialHtml);
      const title = $('title').text();
      if (title) {
        const clean = title.split(/[|\-]/)[0].trim();
        if (clean && clean.length > 2) companyName = clean;
      }
    }

    // Workday CXS JSON endpoint convention
    const endpoint = `${normalizedUrl.baseUrl}/wday/cxs/${tenant}/${site}/jobs`;
    logger.info(`[WorkdayAdapter] Probing Workday CXS endpoint: ${endpoint}`);

    const allJobs: DiscoveredJobRaw[] = [];
    let expectedCount: number | null = null;
    let paginationSupported = false;

    try {
      const res = await safeFetchUrl(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          appliedFacets: {},
          limit: 20,
          offset: 0,
          searchText: ''
        }),
        timeoutMs: 8000
      });

      if (res.status === 200) {
        const payload = JSON.parse(res.text);
        expectedCount = payload.total !== undefined ? payload.total : null;
        const postings = payload.jobPostings || [];
        paginationSupported = true;

        for (const item of postings) {
          const path = item.externalPath || '';
          const appUrl = path ? `${normalizedUrl.baseUrl}${path}` : undefined;
          allJobs.push({
            externalJobId: item.bulletFields?.[0] || item.jobReqId || item.id || undefined,
            title: item.title || 'Job Opening',
            location: item.locationsText || undefined,
            postedAt: item.postedOn ? new Date(item.postedOn) : undefined,
            description: item.title || undefined,
            applicationUrl: appUrl,
            rawPayload: item
          });
        }
      }
    } catch (err: any) {
      logger.warn(`[WorkdayAdapter] Workday CXS probe returned error: ${err.message}`);
    }

    const completeness = CompletenessEstimatorService.evaluate(allJobs.length, expectedCount);

    return {
      matched: allJobs.length > 0,
      strategyName: this.name,
      sourceType: 'WORKDAY',
      atsType: 'WORKDAY',
      jobsEndpoint: endpoint,
      httpMethod: 'POST',
      companyName,
      officialDomain: normalizedUrl.domain,
      jobs: allJobs,
      expectedJobCount: expectedCount,
      completeness: completeness.completeness,
      paginationSupported,
      mappingConfig: {
        externalJobIdField: 'bulletFields.0',
        titleField: 'title',
        locationField: 'locationsText',
        applicationUrlField: 'externalPath'
      }
    };
  }
}
