import { IJobSourceStrategy, StrategyContext, StrategyExecutionResult } from '../strategy.interface.js';
import { safeFetchUrl } from '../../utils/safeFetch.js';
import { CompletenessEstimatorService } from '../completenessEstimator.service.js';
import { DiscoveredJobRaw } from '../types.js';
import { logger } from '../../utils/logger.js';
import { safeParseJson } from '../../utils/safeJson.js';

export class AshbyAdapter implements IJobSourceStrategy {
  public readonly name = 'ASHBY_ADAPTER';
  public readonly priority = 14;

  public canHandle(context: StrategyContext): boolean {
    if (context.fingerprint.atsVendor === 'ASHBY') return true;
    if (context.normalizedUrl.domain.includes('jobs.ashbyhq.com')) return true;
    if (context.initialHtml && context.initialHtml.includes('ashbyhq.com')) return true;
    return false;
  }

  public async execute(context: StrategyContext): Promise<StrategyExecutionResult> {
    const { normalizedUrl } = context;
    let orgName = '';

    const match = normalizedUrl.normalizedUrl.match(/jobs\.ashbyhq\.com\/([^/?#]+)/i);
    if (match && match[1]) {
      orgName = match[1];
    } else {
      const parts = normalizedUrl.normalizedUrl.split('/').filter(Boolean);
      orgName = parts[parts.length - 1];
    }

    const endpoint = `https://api.ashbyhq.com/posting-api/job-board/${orgName}`;
    logger.info(`[AshbyAdapter] Querying Ashby API at ${endpoint}`);

    const allJobs: DiscoveredJobRaw[] = [];
    let expectedCount: number | null = null;
    let companyName = orgName.charAt(0).toUpperCase() + orgName.slice(1);

    try {
      const res = await safeFetchUrl(endpoint, { timeoutMs: 10000 });
      if (res.status === 200 && res.text) {
        const jsonResult = safeParseJson(res.text, res.contentType || res.headers?.['content-type']);
        if (!jsonResult.success || !jsonResult.data) {
          logger.warn(`[AshbyAdapter] Non-JSON payload received`);
          return { matched: false } as any;
        }
        const payload = jsonResult.data;
        const rawJobs = payload.jobs || [];
        expectedCount = rawJobs.length;

        for (const item of rawJobs) {
          allJobs.push({
            externalJobId: String(item.id || ''),
            title: item.title || 'Job Opening',
            location: item.location || item.locationName || undefined,
            department: item.department || item.team || undefined,
            employmentType: item.employmentType || 'FULL_TIME',
            description: item.descriptionPlain || item.descriptionHtml || undefined,
            applicationUrl: item.jobUrl || item.applicationUrl || undefined,
            postedAt: item.publishedAt ? new Date(item.publishedAt) : undefined,
            rawPayload: item
          });
        }
      }
    } catch (err: any) {
      logger.warn(`[AshbyAdapter] Failed to fetch Ashby org ${orgName}: ${err.message}`);
    }

    const completeness = CompletenessEstimatorService.evaluate(allJobs.length, expectedCount);

    return {
      matched: allJobs.length > 0,
      strategyName: this.name,
      sourceType: 'ASHBY',
      atsType: 'ASHBY',
      jobsEndpoint: endpoint,
      httpMethod: 'GET',
      companyName,
      officialDomain: normalizedUrl.domain,
      jobs: allJobs,
      expectedJobCount: expectedCount,
      completeness: completeness.completeness,
      paginationSupported: false,
      mappingConfig: {
        externalJobIdField: 'id',
        titleField: 'title',
        locationField: 'locationName',
        applicationUrlField: 'jobUrl'
      }
    };
  }
}
