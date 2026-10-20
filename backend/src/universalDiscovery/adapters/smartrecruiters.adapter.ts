import { IJobSourceStrategy, StrategyContext, StrategyExecutionResult } from '../strategy.interface.js';
import { safeFetchUrl } from '../../utils/safeFetch.js';
import { CompletenessEstimatorService } from '../completenessEstimator.service.js';
import { DiscoveredJobRaw } from '../types.js';
import { logger } from '../../utils/logger.js';
import { safeParseJson } from '../../utils/safeJson.js';

export class SmartRecruitersAdapter implements IJobSourceStrategy {
  public readonly name = 'SMARTRECRUITERS_ADAPTER';
  public readonly priority = 15;

  public canHandle(context: StrategyContext): boolean {
    if (context.fingerprint.atsVendor === 'SMARTRECRUITERS') return true;
    if (context.normalizedUrl.domain.includes('smartrecruiters.com')) return true;
    if (context.initialHtml && context.initialHtml.includes('smartrecruiters.com')) return true;
    return false;
  }

  public async execute(context: StrategyContext): Promise<StrategyExecutionResult> {
    const { normalizedUrl } = context;
    let companyIdentifier = '';

    const match = normalizedUrl.normalizedUrl.match(/smartrecruiters\.com\/([^/?#]+)/i);
    if (match && match[1]) {
      companyIdentifier = match[1];
    } else {
      companyIdentifier = normalizedUrl.domain.split('.')[0];
    }

    const endpoint = `https://api.smartrecruiters.com/v1/companies/${companyIdentifier}/postings`;
    logger.info(`[SmartRecruitersAdapter] Querying SmartRecruiters API at ${endpoint}`);

    const allJobs: DiscoveredJobRaw[] = [];
    let expectedCount: number | null = null;
    let companyName = companyIdentifier.charAt(0).toUpperCase() + companyIdentifier.slice(1);

    try {
      const res = await safeFetchUrl(endpoint, { timeoutMs: 10000 });
      if (res.status === 200 && res.text) {
        const jsonResult = safeParseJson(res.text, res.contentType || res.headers?.['content-type']);
        if (!jsonResult.success || !jsonResult.data) {
          logger.warn(`[SmartRecruitersAdapter] Non-JSON response received`);
          return { matched: false } as any;
        }
        const payload = jsonResult.data;
        expectedCount = payload.totalFound !== undefined ? payload.totalFound : (payload.content ? payload.content.length : null);
        const rawJobs = payload.content || [];

        for (const item of rawJobs) {
          const loc = item.location ? `${item.location.city || ''}, ${item.location.country || ''}`.trim().replace(/^,\s*|,\s*$/g, '') : undefined;
          allJobs.push({
            externalJobId: String(item.id || ''),
            title: item.name || 'Job Opening',
            location: loc || undefined,
            department: item.department?.label || undefined,
            employmentType: item.typeOfEmployment?.label || 'FULL_TIME',
            description: item.jobAd?.sections?.jobDescription?.text || undefined,
            applicationUrl: `https://jobs.smartrecruiters.com/${companyIdentifier}/${item.id}`,
            postedAt: item.releasedDate ? new Date(item.releasedDate) : undefined,
            rawPayload: item
          });
        }
      }
    } catch (err: any) {
      logger.warn(`[SmartRecruitersAdapter] Failed to fetch company ${companyIdentifier}: ${err.message}`);
    }

    const completeness = CompletenessEstimatorService.evaluate(allJobs.length, expectedCount);

    return {
      matched: allJobs.length > 0,
      strategyName: this.name,
      sourceType: 'SMARTRECRUITERS',
      atsType: 'SMARTRECRUITERS',
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
        titleField: 'name',
        locationField: 'location.city',
        applicationUrlField: 'ref'
      }
    };
  }
}
