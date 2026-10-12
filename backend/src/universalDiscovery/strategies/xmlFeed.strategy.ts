import { IJobSourceStrategy, StrategyContext, StrategyExecutionResult } from '../strategy.interface.js';
import * as cheerio from 'cheerio';
import { CompletenessEstimatorService } from '../completenessEstimator.service.js';
import { DiscoveredJobRaw } from '../types.js';
import { JobSourceDiscoveryService } from '../../services/jobSourceDiscovery.service.js';

export class XmlFeedStrategy implements IJobSourceStrategy {
  public readonly name = 'XML_FEED_STRATEGY';
  public readonly priority = 30;

  public canHandle(context: StrategyContext): boolean {
    const ct = (context.initialResponseHeaders?.['content-type'] || '').toLowerCase();
    if (ct.includes('xml') || ct.includes('rss') || ct.includes('atom')) return true;
    if (context.initialHtml && (context.initialHtml.trim().startsWith('<?xml') || context.initialHtml.includes('<rss') || context.initialHtml.includes('<feed'))) {
      return true;
    }
    return false;
  }

  public async execute(context: StrategyContext): Promise<StrategyExecutionResult> {
    const { normalizedUrl, initialHtml } = context;
    if (!initialHtml) return { matched: false } as any;

    const $ = cheerio.load(initialHtml, { xmlMode: true });
    const rawJobs: DiscoveredJobRaw[] = [];

    // RSS items or Atom entries or generic <job> tags
    $('item, entry, job').each((_, el) => {
      const title = $(el).find('title').text().trim();
      const link = $(el).find('link').text().trim() || $(el).find('link').attr('href') || $(el).find('url').text().trim();
      const description = $(el).find('description, content, summary').text().trim();
      const location = $(el).find('location, city').text().trim();
      const pubDate = $(el).find('pubDate, updated, published').text().trim();
      const id = $(el).find('guid, id, jobid').text().trim();

      if (title && title.length > 2) {
        rawJobs.push({
          externalJobId: id || undefined,
          title,
          location: location || undefined,
          description: description || title,
          applicationUrl: link || undefined,
          postedAt: pubDate ? new Date(pubDate) : undefined
        });
      }
    });

    if (rawJobs.length === 0) {
      return { matched: false } as any;
    }

    const { companyName, domain } = JobSourceDiscoveryService.extractCompanyMetadata(normalizedUrl.normalizedUrl);
    const completeness = CompletenessEstimatorService.evaluate(rawJobs.length, rawJobs.length);

    return {
      matched: true,
      strategyName: this.name,
      sourceType: 'XML_FEED',
      jobsEndpoint: normalizedUrl.normalizedUrl,
      httpMethod: 'GET',
      companyName,
      officialDomain: domain,
      jobs: rawJobs,
      expectedJobCount: rawJobs.length,
      completeness: completeness.completeness,
      paginationSupported: false,
      mappingConfig: {
        titleField: 'title',
        locationField: 'location',
        applicationUrlField: 'link'
      }
    };
  }
}
