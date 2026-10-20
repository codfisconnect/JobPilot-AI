import { IJobSourceStrategy, StrategyContext, StrategyExecutionResult } from '../strategy.interface.js';
import { GenericBrowserDiscoveryService } from '../services/genericBrowserDiscovery.service.js';
import { CompletenessEstimatorService } from '../completenessEstimator.service.js';
import { JobSourceDiscoveryService } from '../../services/jobSourceDiscovery.service.js';
import { logger } from '../../utils/logger.js';

export class BrowserRenderedStrategy implements IJobSourceStrategy {
  public readonly name = 'BROWSER_RENDERED_STRATEGY';
  public readonly priority = 45; // Runs after direct/structured fetch fails or receives 403 / Cloudflare challenge

  public canHandle(context: StrategyContext): boolean {
    const { initialHtml, fingerprint, initialResponseHeaders } = context;

    // Check if initial fetch was blocked by anti-bot challenge (e.g. Cloudflare Just a moment...)
    if (initialHtml) {
      const lower = initialHtml.toLowerCase();
      if (
        lower.includes('just a moment') ||
        lower.includes('cloudflare') ||
        lower.includes('security verification') ||
        lower.includes('enable javascript') ||
        lower.includes('performing security verification')
      ) {
        return true;
      }
    }

    // Check if source is a Single Page Application or heavily dynamic
    if (fingerprint.isSinglePageApp || fingerprint.atsVendor === 'SUCCESSFACTORS') {
      return true;
    }

    return false;
  }

  public async execute(context: StrategyContext): Promise<StrategyExecutionResult> {
    const { normalizedUrl, initialHtml } = context;
    const { companyName, domain } = JobSourceDiscoveryService.extractCompanyMetadata(normalizedUrl.normalizedUrl, initialHtml);

    logger.info(`[BrowserRenderedStrategy] Initiating generic browser discovery for ${companyName} at ${normalizedUrl.normalizedUrl}`);

    const result = await GenericBrowserDiscoveryService.discoverRenderedJobs(
      normalizedUrl.normalizedUrl,
      companyName,
      { maxPages: 5 }
    );

    if (result.jobs.length === 0) {
      return { matched: false } as any;
    }

    const completeness = CompletenessEstimatorService.evaluate(result.jobs.length, result.sourceTotal);

    return {
      matched: true,
      strategyName: this.name,
      sourceType: 'BROWSER_RENDERED',
      jobsEndpoint: normalizedUrl.normalizedUrl,
      httpMethod: 'GET',
      companyName,
      officialDomain: domain,
      jobs: result.jobs,
      expectedJobCount: result.sourceTotal,
      completeness: completeness.completeness,
      paginationSupported: result.sourceTotal !== null && result.sourceTotal > result.jobs.length,
      paginationConfig: {
        pagesFetched: result.pagesFetched,
        pageSize: result.pageSize,
        sourceTotal: result.sourceTotal
      },
      mappingConfig: {
        titleField: 'title',
        locationField: 'location',
        externalJobIdField: 'externalJobId'
      }
    };
  }
}
