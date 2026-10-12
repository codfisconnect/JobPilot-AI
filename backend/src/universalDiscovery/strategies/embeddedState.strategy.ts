import { IJobSourceStrategy, StrategyContext, StrategyExecutionResult } from '../strategy.interface.js';
import { EmbeddedDataDiscoveryService } from '../../services/embeddedDataDiscovery.service.js';
import { FieldMapperService } from '../../services/fieldMapper.service.js';
import { CompletenessEstimatorService } from '../completenessEstimator.service.js';
import { DiscoveredJobRaw } from '../types.js';
import { JobSourceDiscoveryService } from '../../services/jobSourceDiscovery.service.js';

export class EmbeddedStateStrategy implements IJobSourceStrategy {
  public readonly name = 'EMBEDDED_STATE_STRATEGY';
  public readonly priority = 24;

  public canHandle(context: StrategyContext): boolean {
    return context.fingerprint.hasEmbeddedState;
  }

  public async execute(context: StrategyContext): Promise<StrategyExecutionResult> {
    const { normalizedUrl, initialHtml } = context;
    if (!initialHtml) return { matched: false } as any;

    const embeddedResult = EmbeddedDataDiscoveryService.extractEmbeddedJobsFromHtml(initialHtml);
    if (!embeddedResult || embeddedResult.jobs.length === 0) {
      return { matched: false } as any;
    }

    const { companyName, domain } = JobSourceDiscoveryService.extractCompanyMetadata(normalizedUrl.normalizedUrl, initialHtml);
    const mapping = FieldMapperService.inferDeterministicMapping(embeddedResult.jobs);
    if (embeddedResult.rootPath) {
      mapping.rootJobsPath = embeddedResult.rootPath;
    }

    const jobs: DiscoveredJobRaw[] = [];
    for (const item of embeddedResult.jobs) {
      const mapped = FieldMapperService.mapRecord(item, mapping, {
        companyName,
        companyDomain: domain,
        careersUrl: normalizedUrl.normalizedUrl,
        sourceType: 'EMBEDDED_DATA',
        sourceName: companyName
      });
      if (mapped && mapped.title) {
        jobs.push({
          externalJobId: mapped.externalJobId,
          title: mapped.title,
          location: mapped.location,
          description: mapped.description,
          applicationUrl: mapped.applicationUrl,
          postedAt: mapped.postedAt,
          rawPayload: item
        });
      }
    }

    const completeness = CompletenessEstimatorService.evaluate(jobs.length, jobs.length);

    return {
      matched: jobs.length > 0,
      strategyName: this.name,
      sourceType: 'EMBEDDED_DATA',
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
