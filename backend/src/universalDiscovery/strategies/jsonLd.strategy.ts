import { IJobSourceStrategy, StrategyContext, StrategyExecutionResult } from '../strategy.interface.js';
import * as cheerio from 'cheerio';
import { CompletenessEstimatorService } from '../completenessEstimator.service.js';
import { FieldMapperService } from '../../services/fieldMapper.service.js';
import { DiscoveredJobRaw } from '../types.js';
import { JobSourceDiscoveryService } from '../../services/jobSourceDiscovery.service.js';

export class JsonLdStrategy implements IJobSourceStrategy {
  public readonly name = 'JSON_LD_STRATEGY';
  public readonly priority = 22;

  public canHandle(context: StrategyContext): boolean {
    return context.fingerprint.hasJsonLd;
  }

  public async execute(context: StrategyContext): Promise<StrategyExecutionResult> {
    const { normalizedUrl, initialHtml } = context;
    if (!initialHtml) return { matched: false } as any;

    const $ = cheerio.load(initialHtml);
    const jsonLdJobs: any[] = [];

    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const parsed = JSON.parse($(el).html() || '{}');
        if (parsed['@type'] === 'JobPosting') {
          jsonLdJobs.push(parsed);
        } else if (parsed['@type'] === 'ItemList' && Array.isArray(parsed.itemListElement)) {
          parsed.itemListElement.forEach((item: any) => {
            if (item && (item['@type'] === 'JobPosting' || item.item?.['@type'] === 'JobPosting')) {
              jsonLdJobs.push(item.item || item);
            }
          });
        } else if (Array.isArray(parsed['@graph'])) {
          parsed['@graph'].forEach((item: any) => {
            if (item['@type'] === 'JobPosting') jsonLdJobs.push(item);
          });
        }
      } catch {}
    });

    if (jsonLdJobs.length === 0) {
      return { matched: false } as any;
    }

    const { companyName, domain } = JobSourceDiscoveryService.extractCompanyMetadata(normalizedUrl.normalizedUrl, initialHtml);
    const mapping = FieldMapperService.inferDeterministicMapping(jsonLdJobs);

    const jobs: DiscoveredJobRaw[] = [];
    for (const raw of jsonLdJobs) {
      const loc = typeof raw.jobLocation === 'string'
        ? raw.jobLocation
        : raw.jobLocation?.address?.addressLocality || raw.jobLocation?.address?.addressRegion || undefined;
      
      jobs.push({
        externalJobId: raw.identifier?.value || raw.identifier || undefined,
        title: raw.title || 'Job Opening',
        location: loc,
        description: raw.description || raw.title,
        applicationUrl: raw.url || raw.directApplyUrl || undefined,
        postedAt: raw.datePosted ? new Date(raw.datePosted) : undefined,
        rawPayload: raw
      });
    }

    const completeness = CompletenessEstimatorService.evaluate(jobs.length, jobs.length);

    return {
      matched: jobs.length > 0,
      strategyName: this.name,
      sourceType: 'JSON_LD',
      jobsEndpoint: normalizedUrl.normalizedUrl,
      httpMethod: 'GET',
      companyName,
      officialDomain: domain,
      jobs,
      expectedJobCount: jobs.length,
      completeness: completeness.completeness,
      paginationSupported: false,
      mappingConfig: mapping
    };
  }
}
