import { IJobSourceStrategy, StrategyContext, StrategyExecutionResult } from '../strategy.interface.js';
import { safeFetchUrl } from '../../utils/safeFetch.js';
import { CompletenessEstimatorService } from '../completenessEstimator.service.js';
import { DiscoveredJobRaw } from '../types.js';
import { logger } from '../../utils/logger.js';
import { safeParseJson } from '../../utils/safeJson.js';

export class InfosysAdapter implements IJobSourceStrategy {
  public readonly name = 'INFOSYS_ADAPTER';
  public readonly priority = 13; // High priority accelerator

  public canHandle(context: StrategyContext): boolean {
    const { normalizedUrl, initialHtml } = context;
    if (normalizedUrl.domain.includes('infosys.com')) return true;
    if (initialHtml) {
      const lower = initialHtml.toLowerCase();
      if (
        lower.includes('career.infosys.com') ||
        lower.includes('intapgateway') ||
        lower.includes('intapjbsrch')
      ) {
        return true;
      }
    }
    return false;
  }

  public async execute(context: StrategyContext): Promise<StrategyExecutionResult> {
    const { normalizedUrl } = context;
    const companyName = 'Infosys';
    const domain = 'infosys.com';

    // Official Infosys Candidate Search Gateway Endpoint
    const endpoint = 'https://intapgateway.infosysapps.com/careersci/search/intapjbsrch/getCareerSearchJobs?sourceId=1,21&searchText=ALL';
    logger.info(`[InfosysAdapter] Querying Infosys careers gateway at: ${endpoint}`);

    const allJobs: DiscoveredJobRaw[] = [];
    let expectedCount: number | null = null;

    try {
      const res = await safeFetchUrl(endpoint, {
        method: 'GET',
        headers: {
          'Accept': 'application/json, text/plain, */*',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        },
        timeoutMs: 15000
      });

      if (res.status === 200 && res.text.trim()) {
        const jsonResult = safeParseJson(res.text, res.contentType || res.headers?.['content-type']);
        if (!jsonResult.success || !jsonResult.data) {
          logger.warn(`[InfosysAdapter] Non-JSON payload received`);
          return { matched: false } as any;
        }
        const rawJobs = jsonResult.data;
        if (Array.isArray(rawJobs)) {
          expectedCount = rawJobs.length;
          logger.info(`[InfosysAdapter] Ingesting ${rawJobs.length} global positions from Infosys gateway`);

          for (const item of rawJobs) {
            const refCode = String(item.referenceCode || item.postingId || item.requisitionId || '');
            const title = item.postingTitle || item.roleDesignation || 'Career Opportunity';
            const location = item.location || item.country || undefined;
            const description = item.postingDescription || item.technicalRequirement || item.rolesResponsibilities || title;
            const appUrl = `https://career.infosys.com/jobdesc?jobReferenceCode=${refCode}&sourceId=${item.sourceId || '1,21'}`;

            allJobs.push({
              externalJobId: refCode,
              title,
              location,
              country: item.country || undefined,
              city: item.location || undefined,
              department: item.unit || item.functionalArea || undefined,
              experience: item.minExperienceLevel ? `${item.minExperienceLevel} - ${item.maxExperienceLevel || ''} Years` : undefined,
              description,
              applicationUrl: appUrl,
              postedAt: item.createdOn ? new Date(item.createdOn) : undefined,
              rawPayload: item
            });
          }
        }
      }
    } catch (err: any) {
      logger.warn(`[InfosysAdapter] Failed to query Infosys endpoint: ${err.message}`);
    }

    const evaluation = CompletenessEstimatorService.evaluate(allJobs.length, expectedCount);

    return {
      matched: allJobs.length > 0,
      strategyName: this.name,
      sourceType: 'ATS_JOB_BOARD',
      atsType: 'INFOSYS_GATEWAY',
      jobsEndpoint: endpoint,
      httpMethod: 'GET',
      companyName,
      officialDomain: domain,
      jobs: allJobs,
      expectedJobCount: expectedCount,
      completeness: evaluation.completeness,
      paginationSupported: true
    };
  }
}
