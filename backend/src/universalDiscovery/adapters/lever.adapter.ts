import { IJobSourceStrategy, StrategyContext, StrategyExecutionResult } from '../strategy.interface.js';
import { safeFetchUrl } from '../../utils/safeFetch.js';
import { CompletenessEstimatorService } from '../completenessEstimator.service.js';
import { DiscoveredJobRaw } from '../types.js';
import { logger } from '../../utils/logger.js';
import { safeParseJson } from '../../utils/safeJson.js';

export class LeverAdapter implements IJobSourceStrategy {
  public readonly name = 'LEVER_ADAPTER';
  public readonly priority = 13;

  public canHandle(context: StrategyContext): boolean {
    if (context.fingerprint.atsVendor === 'LEVER') return true;
    if (context.normalizedUrl.domain.includes('jobs.lever.co')) return true;
    if (context.initialHtml && context.initialHtml.includes('jobs.lever.co')) return true;
    return false;
  }

  public async execute(context: StrategyContext): Promise<StrategyExecutionResult> {
    const { normalizedUrl } = context;
    let siteName = '';

    const match = normalizedUrl.normalizedUrl.match(/jobs\.lever\.co\/([^/?#]+)/i);
    if (match && match[1]) {
      siteName = match[1];
    } else {
      const parts = normalizedUrl.normalizedUrl.split('/').filter(Boolean);
      siteName = parts[parts.length - 1];
    }

    const endpoint = `https://api.lever.co/v0/postings/${siteName}?mode=json`;
    logger.info(`[LeverAdapter] Querying Lever API at ${endpoint}`);

    const allJobs: DiscoveredJobRaw[] = [];
    let expectedCount: number | null = null;
    let companyName = siteName.charAt(0).toUpperCase() + siteName.slice(1);

    try {
      const res = await safeFetchUrl(endpoint, { timeoutMs: 10000 });
      if (res.status === 200 && res.text) {
        const jsonResult = safeParseJson(res.text, res.contentType || res.headers?.['content-type']);
        if (!jsonResult.success || !jsonResult.data) {
          logger.warn(`[LeverAdapter] Non-JSON payload received`);
          return { matched: false } as any;
        }
        const rawJobs = jsonResult.data;
        if (Array.isArray(rawJobs)) {
          expectedCount = rawJobs.length;
          for (const item of rawJobs) {
            allJobs.push({
              externalJobId: String(item.id || ''),
              title: item.text || item.title || 'Job Opening',
              location: item.categories?.location || undefined,
              department: item.categories?.department || item.categories?.team || undefined,
              employmentType: item.categories?.commitment || 'FULL_TIME',
              description: item.descriptionPlain || item.description || undefined,
              applicationUrl: item.applyUrl || item.hostedUrl || undefined,
              postedAt: item.createdAt ? new Date(item.createdAt) : undefined,
              rawPayload: item
            });
          }
        }
      }
    } catch (err: any) {
      logger.warn(`[LeverAdapter] Failed to fetch Lever site ${siteName}: ${err.message}`);
    }

    const completeness = CompletenessEstimatorService.evaluate(allJobs.length, expectedCount);

    return {
      matched: allJobs.length > 0,
      strategyName: this.name,
      sourceType: 'LEVER',
      atsType: 'LEVER',
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
        titleField: 'text',
        locationField: 'categories.location',
        applicationUrlField: 'hostedUrl'
      }
    };
  }
}
