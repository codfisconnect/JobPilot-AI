import { IJobSourceStrategy, StrategyContext, StrategyExecutionResult } from '../strategy.interface.js';
import { safeFetchUrl } from '../../utils/safeFetch.js';
import { FieldMapperService } from '../../services/fieldMapper.service.js';
import { CompletenessEstimatorService } from '../completenessEstimator.service.js';
import { JobRecordScoringService } from '../jobRecordScoring.service.js';
import { DiscoveredJobRaw } from '../types.js';
import { logger } from '../../utils/logger.js';
import { JobSourceDiscoveryService } from '../../services/jobSourceDiscovery.service.js';

export class DirectJsonStrategy implements IJobSourceStrategy {
  public readonly name = 'DIRECT_JSON_STRATEGY';
  public readonly priority = 20;

  public canHandle(context: StrategyContext): boolean {
    const ct = (context.initialResponseHeaders?.['content-type'] || '').toLowerCase();
    if (ct.includes('application/json')) return true;
    if (context.initialHtml && (context.initialHtml.trim().startsWith('{') || context.initialHtml.trim().startsWith('['))) {
      return true;
    }
    return false;
  }

  public async execute(context: StrategyContext): Promise<StrategyExecutionResult> {
    const { normalizedUrl, initialHtml } = context;
    let payload: any;
    try {
      payload = JSON.parse(initialHtml || '{}');
    } catch {
      return { matched: false } as any;
    }

    const { jobs, rootPath } = FieldMapperService.extractJobsArray(payload);
    const scoreCheck = JobRecordScoringService.scoreCandidateArray(jobs);
    if (!scoreCheck.isJobCollection || jobs.length === 0) {
      return { matched: false } as any;
    }

    const expectedCount = CompletenessEstimatorService.extractReportedTotal(payload);
    const { companyName, domain } = JobSourceDiscoveryService.extractCompanyMetadata(normalizedUrl.normalizedUrl, undefined, payload);
    const mapping = FieldMapperService.inferDeterministicMapping(jobs);
    mapping.rootJobsPath = rootPath;

    const mappedJobs: DiscoveredJobRaw[] = [];
    for (const item of jobs) {
      const mapped = FieldMapperService.mapRecord(item, mapping, {
        companyName,
        companyDomain: domain,
        careersUrl: normalizedUrl.normalizedUrl,
        sourceType: 'DIRECT_JSON',
        sourceName: companyName
      });
      if (mapped && mapped.title) {
        mappedJobs.push({
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

    const completeness = CompletenessEstimatorService.evaluate(mappedJobs.length, expectedCount);

    return {
      matched: mappedJobs.length > 0,
      strategyName: this.name,
      sourceType: 'DIRECT_JSON',
      jobsEndpoint: normalizedUrl.normalizedUrl,
      httpMethod: 'GET',
      companyName,
      officialDomain: domain,
      jobs: mappedJobs,
      expectedJobCount: expectedCount,
      completeness: completeness.completeness,
      paginationSupported: false,
      mappingConfig: mapping
    };
  }
}
