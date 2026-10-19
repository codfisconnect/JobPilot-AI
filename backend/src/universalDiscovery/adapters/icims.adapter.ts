import { IJobSourceStrategy, StrategyContext, StrategyExecutionResult } from '../strategy.interface.js';
import { safeFetchUrl } from '../../utils/safeFetch.js';
import { CompletenessEstimatorService } from '../completenessEstimator.service.js';
import { DiscoveredJobRaw } from '../types.js';
import { logger } from '../../utils/logger.js';
import * as cheerio from 'cheerio';

export class IcimsAdapter implements IJobSourceStrategy {
  public readonly name = 'ICIMS_ADAPTER';
  public readonly priority = 16;

  public canHandle(context: StrategyContext): boolean {
    if (context.fingerprint.atsVendor === 'ICIMS') return true;
    if (context.normalizedUrl.domain.includes('icims.com')) return true;
    if (context.fingerprint.iframeSources.some(src => src.includes('icims.com'))) return true;
    // Only handle if the page itself is an iCIMS hosted frame/portal, not merely a custom careers site mentioning icims in an external link
    if (context.initialHtml && (context.initialHtml.includes('icims_iframe') || context.initialHtml.includes('jobs.icims.com'))) return true;
    return false;
  }

  public async execute(context: StrategyContext): Promise<StrategyExecutionResult> {
    const { normalizedUrl, initialHtml, fingerprint } = context;
    let targetUrl = normalizedUrl.normalizedUrl;

    // Check if hosted inside iframe
    const icimsIframe = fingerprint.iframeSources.find(src => src.includes('icims.com'));
    if (icimsIframe) {
      targetUrl = icimsIframe;
    }

    logger.info(`[IcimsAdapter] Probing iCIMS portal at ${targetUrl}`);
    const allJobs: DiscoveredJobRaw[] = [];
    let expectedCount: number | null = null;
    let companyName = normalizedUrl.domain.split('.')[0];
    companyName = companyName.charAt(0).toUpperCase() + companyName.slice(1);

    try {
      const res = await safeFetchUrl(targetUrl, { timeoutMs: 10000 });
      if (res.status === 200) {
        const $ = cheerio.load(res.text);
        
        // iCIMS list rows: .iCIMS_JobsTable .row or table tr
        $('.iCIMS_JobsTable .row, .iCIMS_JobListItem, tr.iCIMS_TableRow').each((_, el) => {
          const titleEl = $(el).find('.title a, .iCIMS_JobTitle, a[href*="job"]');
          const title = titleEl.text().trim();
          const href = titleEl.attr('href');
          const location = $(el).find('.iCIMS_JobLocation, .location').text().trim();

          if (title && title.length > 2) {
            allJobs.push({
              title,
              location: location || undefined,
              applicationUrl: href ? new URL(href, targetUrl).toString() : undefined,
              description: title
            });
          }
        });
      }
    } catch (err: any) {
      logger.warn(`[IcimsAdapter] iCIMS portal probe error: ${err.message}`);
    }

    const completeness = CompletenessEstimatorService.evaluate(allJobs.length, expectedCount);

    return {
      matched: allJobs.length > 0,
      strategyName: this.name,
      sourceType: 'ICIMS',
      atsType: 'ICIMS',
      jobsEndpoint: targetUrl,
      httpMethod: 'GET',
      companyName,
      officialDomain: normalizedUrl.domain,
      jobs: allJobs,
      expectedJobCount: expectedCount,
      completeness: completeness.completeness,
      paginationSupported: false,
      mappingConfig: {
        titleField: 'title',
        locationField: 'location',
        applicationUrlField: 'applicationUrl'
      }
    };
  }
}
