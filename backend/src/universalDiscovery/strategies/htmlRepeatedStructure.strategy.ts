import { IJobSourceStrategy, StrategyContext, StrategyExecutionResult } from '../strategy.interface.js';
import { HtmlJobDiscoveryService } from '../../services/htmlJobDiscovery.service.js';
import { CompletenessEstimatorService } from '../completenessEstimator.service.js';
import { DiscoveredJobRaw } from '../types.js';
import { logger } from '../../utils/logger.js';
import { JobSourceDiscoveryService } from '../../services/jobSourceDiscovery.service.js';

export class HtmlRepeatedStructureStrategy implements IJobSourceStrategy {
  public readonly name = 'HTML_REPEATED_STRUCTURE_STRATEGY';
  public readonly priority = 40;

  public canHandle(context: StrategyContext): boolean {
    return Boolean(context.initialHtml);
  }

  public async execute(context: StrategyContext): Promise<StrategyExecutionResult> {
    const { normalizedUrl, initialHtml } = context;
    if (!initialHtml) return { matched: false } as any;

    try {
      const htmlResult = await HtmlJobDiscoveryService.extractJobsFromHtml(normalizedUrl.normalizedUrl, initialHtml);
      if (htmlResult && htmlResult.jobs.length > 0) {
        const { companyName, domain } = JobSourceDiscoveryService.extractCompanyMetadata(normalizedUrl.normalizedUrl, initialHtml);
        
        const rawJobs: DiscoveredJobRaw[] = htmlResult.jobs.map(j => ({
          externalJobId: j.externalJobId,
          title: j.title,
          department: j.department,
          location: j.location,
          workMode: j.workMode,
          employmentType: j.employmentType,
          experience: j.experience,
          salary: j.salary,
          qualification: j.qualification,
          summary: j.summary,
          description: j.description || j.title,
          responsibilities: j.responsibilities,
          requirements: j.requirements,
          skills: j.skills,
          openingCount: j.openingCount,
          applicationUrl: j.applicationUrl || j.detailUrl,
          postedAt: j.postedAt ? new Date(j.postedAt) : undefined,
          rawPayload: j
        }));

        const reportedTotal = CompletenessEstimatorService.extractReportedTotalFromHtml(initialHtml);
        const completeness = CompletenessEstimatorService.evaluate(rawJobs.length, reportedTotal);

        return {
          matched: true,
          strategyName: this.name,
          sourceType: 'HTML',
          jobsEndpoint: normalizedUrl.normalizedUrl,
          httpMethod: 'GET',
          companyName,
          officialDomain: domain,
          jobs: rawJobs,
          expectedJobCount: reportedTotal,
          completeness: completeness.completeness,
          paginationSupported: reportedTotal !== null && reportedTotal > rawJobs.length,
          mappingConfig: {
            titleField: 'title',
            locationField: 'location',
            descriptionField: 'description'
          }
        };
      }
    } catch (err: any) {
      logger.warn(`[HtmlRepeatedStructureStrategy] Error: ${err.message}`);
    }

    return { matched: false } as any;
  }
}
