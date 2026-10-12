import { IJobSourceStrategy, StrategyContext, StrategyExecutionResult } from '../strategy.interface.js';
import { safeFetchUrl } from '../../utils/safeFetch.js';
import { FieldMapperService } from '../../services/fieldMapper.service.js';
import { JobRecordScoringService } from '../jobRecordScoring.service.js';
import { CompletenessEstimatorService } from '../completenessEstimator.service.js';
import { DiscoveredJobRaw } from '../types.js';
import { JobSourceDiscoveryService } from '../../services/jobSourceDiscovery.service.js';

export class CommonRestEndpointsStrategy implements IJobSourceStrategy {
  public readonly name = 'COMMON_REST_ENDPOINTS_STRATEGY';
  public readonly priority = 28;

  public canHandle(context: StrategyContext): boolean {
    return Boolean(context.normalizedUrl.baseUrl);
  }

  public async execute(context: StrategyContext): Promise<StrategyExecutionResult> {
    const { normalizedUrl, initialHtml } = context;
    const baseOrigin = new URL(normalizedUrl.normalizedUrl).origin;
    const probePaths = [
      '/api/jobs',
      '/api/jobs.json',
      '/jobs.json',
      '/api/careers',
      '/api/openings',
      '/api/v1/jobs',
      '/careers.json',
      '/openings.json'
    ];

    const { companyName, domain } = JobSourceDiscoveryService.extractCompanyMetadata(normalizedUrl.normalizedUrl, initialHtml);

    for (const p of probePaths) {
      const probeUrl = `${baseOrigin}${p}`;
      try {
        const res = await safeFetchUrl(probeUrl, { timeoutMs: 4000 });
        if (res.status === 200) {
          const payload = JSON.parse(res.text);
          const { jobs, rootPath } = FieldMapperService.extractJobsArray(payload);
          const scoreCheck = JobRecordScoringService.scoreCandidateArray(jobs);

          if (scoreCheck.isJobCollection && jobs.length > 0) {
            const expectedCount = CompletenessEstimatorService.extractReportedTotal(payload);
            const mapping = FieldMapperService.inferDeterministicMapping(jobs);
            mapping.rootJobsPath = rootPath;

            const mappedJobs: DiscoveredJobRaw[] = [];
            for (const item of jobs) {
              const mapped = FieldMapperService.mapRecord(item, mapping, {
                companyName,
                companyDomain: domain,
                careersUrl: normalizedUrl.normalizedUrl,
                sourceType: 'JSON_API',
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
              matched: true,
              strategyName: this.name,
              sourceType: 'JSON_API',
              jobsEndpoint: probeUrl,
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
      } catch {}
    }

    return { matched: false } as any;
  }
}
