import { IJobSourceStrategy, StrategyContext, StrategyExecutionResult } from '../strategy.interface.js';
import { safeFetchUrl } from '../../utils/safeFetch.js';
import { CompletenessEstimatorService } from '../completenessEstimator.service.js';
import { DiscoveredJobRaw } from '../types.js';
import { logger } from '../../utils/logger.js';
import * as cheerio from 'cheerio';

export class GreenhouseAdapter implements IJobSourceStrategy {
  public readonly name = 'GREENHOUSE_ADAPTER';
  public readonly priority = 12;

  public canHandle(context: StrategyContext): boolean {
    if (context.fingerprint.atsVendor === 'GREENHOUSE') return true;
    if (context.normalizedUrl.domain.includes('greenhouse.io')) return true;
    if (context.initialHtml && (context.initialHtml.includes('boards.greenhouse.io') || context.initialHtml.includes('grnh.se'))) return true;
    return false;
  }

  public async execute(context: StrategyContext): Promise<StrategyExecutionResult> {
    const { normalizedUrl } = context;
    let boardToken = '';

    // Extract board token from path or query
    const match = normalizedUrl.normalizedUrl.match(/boards\.greenhouse\.io\/(?:embed\/job_board\?for=)?([^/?#]+)/i);
    if (match && match[1]) {
      boardToken = match[1];
    } else {
      const parts = normalizedUrl.normalizedUrl.split('/').filter(Boolean);
      boardToken = parts[parts.length - 1];
    }

    const endpoint = `https://boards-api.greenhouse.io/v1/boards/${boardToken}/jobs?content=true`;
    logger.info(`[GreenhouseAdapter] Querying Greenhouse API at ${endpoint}`);

    const allJobs: DiscoveredJobRaw[] = [];
    let expectedCount: number | null = null;
    let companyName = boardToken.charAt(0).toUpperCase() + boardToken.slice(1);

    try {
      const res = await safeFetchUrl(endpoint, { timeoutMs: 10000 });
      if (res.status === 200) {
        const payload = JSON.parse(res.text);
        const rawJobs = payload.jobs || [];
        expectedCount = rawJobs.length;

        for (const item of rawJobs) {
          allJobs.push({
            externalJobId: String(item.id || ''),
            title: item.title || 'Job Opening',
            location: item.location?.name || undefined,
            description: item.content || undefined,
            applicationUrl: item.absolute_url || undefined,
            postedAt: item.updated_at || undefined,
            rawPayload: item
          });
        }
      }
    } catch (err: any) {
      logger.warn(`[GreenhouseAdapter] Failed to fetch board ${boardToken}: ${err.message}`);
    }

    const completeness = CompletenessEstimatorService.evaluate(allJobs.length, expectedCount);

    return {
      matched: allJobs.length > 0,
      strategyName: this.name,
      sourceType: 'GREENHOUSE',
      atsType: 'GREENHOUSE',
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
        locationField: 'location.name',
        applicationUrlField: 'absolute_url'
      }
    };
  }
}
