import { IJobSourceStrategy, StrategyContext, StrategyExecutionResult } from '../strategy.interface.js';
import { safeFetchUrl } from '../../utils/safeFetch.js';
import { CompletenessEstimatorService } from '../completenessEstimator.service.js';
import { DiscoveredJobRaw } from '../types.js';
import { logger } from '../../utils/logger.js';
import { JobSourceDiscoveryService } from '../../services/jobSourceDiscovery.service.js';
import { safeParseJson } from '../../utils/safeJson.js';

export class OracleRecruitingAdapter implements IJobSourceStrategy {
  public readonly name = 'ORACLE_RECRUITING_ADAPTER';
  public readonly priority = 13; // High priority specialized enterprise ATS adapter

  public canHandle(context: StrategyContext): boolean {
    const { normalizedUrl, initialHtml, fingerprint } = context;
    if (fingerprint.atsVendor === 'ORACLE_RECRUITING') return true;
    if (normalizedUrl.domain.includes('oraclecloud.com')) return true;
    if (initialHtml) {
      const lower = initialHtml.toLowerCase();
      if (
        lower.includes('oraclecloud.com') ||
        lower.includes('candidateexperience') ||
        lower.includes('ora-irc-vanity-domain') ||
        lower.includes('recruitingcejobrequisitions')
      ) {
        return true;
      }
    }
    return false;
  }

  public async execute(context: StrategyContext): Promise<StrategyExecutionResult> {
    const { normalizedUrl, initialHtml } = context;

    // 1. Resolve host and siteNumber
    let host = '';
    let siteNumber = 'CX_1';

    // Check if initialHtml contains a vanity host definition e.g. const host = 'https://fa-etqo-saasfaprod1.fa.ocs.oraclecloud.com';
    if (initialHtml) {
      const hostMatch = initialHtml.match(/host\s*=\s*['"](https?:\/\/[a-zA-Z0-9\.\-_]+)['"]/i) ||
                        initialHtml.match(/https?:\/\/[a-zA-Z0-9\.\-_]*oraclecloud\.com/i);
      if (hostMatch) {
        host = hostMatch[1] || hostMatch[0];
      }

      // Check for siteNumber in hash or URL or HTML: e.g. sites/CX_1 or siteNumber=CX_1
      const siteMatch = (normalizedUrl.rawUrl + ' ' + initialHtml).match(/sites\/([a-zA-Z0-9_\-]+)/i) ||
                        (normalizedUrl.rawUrl + ' ' + initialHtml).match(/siteNumber=([a-zA-Z0-9_\-]+)/i);
      if (siteMatch) {
        siteNumber = siteMatch[1];
      }
    }

    if (!host) {
      if (normalizedUrl.domain.includes('oraclecloud.com')) {
        host = `${normalizedUrl.baseUrl}`;
      } else {
        return { matched: false } as any;
      }
    }

    host = host.replace(/\/+$/, '');

    // 2. Resolve company metadata
    const { companyName, domain } = JobSourceDiscoveryService.extractCompanyMetadata(normalizedUrl.normalizedUrl, initialHtml);

    // 3. Construct Oracle Recruiting REST API URL
    // Standard endpoint: /hcmRestApi/resources/latest/recruitingCEJobRequisitions?onlyData=true&expand=requisitionList&finder=findReqs;siteNumber=CX_1,limit=100,offset=0
    const pageSize = 100;
    let offset = 0;
    let totalJobsCount: number | null = null;
    const allJobs: DiscoveredJobRaw[] = [];
    const seenJobIds = new Set<string>();
    const maxPages = 20;
    let pageCount = 0;

    const baseRestUrl = `${host}/hcmRestApi/resources/latest/recruitingCEJobRequisitions`;

    logger.info(`[OracleRecruitingAdapter] Querying Oracle Recruiting REST API at ${host} for site ${siteNumber}`);

    while (pageCount < maxPages) {
      pageCount++;
      const restEndpoint = `${baseRestUrl}?onlyData=true&expand=requisitionList&finder=findReqs;siteNumber=${siteNumber},limit=${pageSize},offset=${offset}`;

      try {
        const res = await safeFetchUrl(restEndpoint, {
          headers: {
            'Accept': 'application/json',
            'ora-irc-vanity-domain': 'Y'
          },
          timeoutMs: 15000
        });

        if (res.status !== 200) {
          logger.warn(`[OracleRecruitingAdapter] Non-200 status ${res.status} at offset ${offset}`);
          break;
        }

        const jsonResult = safeParseJson(res.text, res.contentType || res.headers?.['content-type']);
        if (!jsonResult.success || !jsonResult.data) {
          logger.warn(`[OracleRecruitingAdapter] Non-JSON payload received at offset ${offset}`);
          break;
        }

        const data = jsonResult.data;
        const searchItem = data.items && data.items[0];
        if (!searchItem) break;

        if (totalJobsCount === null && typeof searchItem.TotalJobsCount === 'number') {
          totalJobsCount = searchItem.TotalJobsCount;
        }

        const reqList = searchItem.requisitionList || [];
        if (!Array.isArray(reqList) || reqList.length === 0) {
          break;
        }

        let newRecords = 0;
        for (const req of reqList) {
          const id = String(req.Id || req.RequisitionId || '');
          const title = req.Title || req.jobTitle;
          if (!title || (id && seenJobIds.has(id))) continue;
          if (id) seenJobIds.add(id);

          // Job detail & application URLs
          // Browser vanity path: https://jobs.hexaware.com/#en/sites/CX_1/job/681451
          // Or direct Oracle Cloud path: https://host/hcmUI/CandidateExperience/en/sites/CX_1/job/681451
          const jobUrl = `${normalizedUrl.baseUrl}/#en/sites/${siteNumber}/job/${id}`;

          const loc = [req.PrimaryLocation, req.PrimaryLocationCountry].filter(Boolean).join(', ') || undefined;

          allJobs.push({
            externalJobId: id || undefined,
            title,
            location: loc,
            country: req.PrimaryLocationCountry || undefined,
            workMode: req.WorkplaceType || undefined,
            employmentType: req.JobType || req.JobSchedule || undefined,
            description: req.ShortDescriptionStr || req.ExternalResponsibilitiesStr || title,
            applicationUrl: jobUrl,
            url: jobUrl,
            postedAt: req.PostedDate ? new Date(req.PostedDate) : undefined,
            rawPayload: req
          });
          newRecords++;
        }

        if (newRecords === 0) break;

        offset += reqList.length;
        if (totalJobsCount !== null && allJobs.length >= totalJobsCount) {
          break;
        }
      } catch (err: any) {
        logger.warn(`[OracleRecruitingAdapter] Error at offset ${offset}: ${err.message}`);
        break;
      }
    }

    if (allJobs.length === 0) {
      return { matched: false } as any;
    }

    const completeness = CompletenessEstimatorService.evaluate(allJobs.length, totalJobsCount);

    return {
      matched: true,
      strategyName: this.name,
      sourceType: 'ORACLE_RECRUITING',
      atsType: 'ORACLE_RECRUITING',
      jobsEndpoint: `${baseRestUrl}?finder=findReqs;siteNumber=${siteNumber}`,
      httpMethod: 'GET',
      companyName,
      officialDomain: domain,
      jobs: allJobs,
      expectedJobCount: totalJobsCount,
      completeness: completeness.completeness,
      paginationSupported: true,
      paginationConfig: {
        strategy: 'OFFSET',
        pageSize,
        offsetField: 'offset'
      },
      mappingConfig: {
        titleField: 'Title',
        locationField: 'PrimaryLocation',
        externalJobIdField: 'Id'
      }
    };
  }
}
