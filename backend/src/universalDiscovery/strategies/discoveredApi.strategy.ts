import { IJobSourceStrategy, StrategyContext, StrategyExecutionResult } from '../strategy.interface.js';
import { safeFetchUrl } from '../../utils/safeFetch.js';
import { FieldMapperService } from '../../services/fieldMapper.service.js';
import { JobRecordScoringService } from '../jobRecordScoring.service.js';
import { CompletenessEstimatorService } from '../completenessEstimator.service.js';
import { DiscoveredJobRaw } from '../types.js';
import { logger } from '../../utils/logger.js';
import { JobSourceDiscoveryService } from '../../services/jobSourceDiscovery.service.js';

export class DiscoveredApiStrategy implements IJobSourceStrategy {
  public readonly name = 'DISCOVERED_API_STRATEGY';
  public readonly priority = 26;

  public canHandle(context: StrategyContext): boolean {
    return Boolean(context.initialHtml);
  }

  public async execute(context: StrategyContext): Promise<StrategyExecutionResult> {
    const { normalizedUrl, initialHtml } = context;
    if (!initialHtml) return { matched: false } as any;

    const candidates = new Set<string>(JobSourceDiscoveryService.extractEndpointCandidatesFromHtml(normalizedUrl.normalizedUrl, initialHtml));

    // Inspect script bundles (e.g. searchresults, careers, jobs, api) for candidate endpoints
    const scriptSrcMatches = initialHtml.match(/<script[^>]*src=["']([^"']+)["'][^>]*>/gi) || [];
    for (const tag of scriptSrcMatches) {
      const srcMatch = tag.match(/src=["']([^"']+)["']/i);
      if (!srcMatch || !srcMatch[1]) continue;
      const src = srcMatch[1];
      const lowerSrc = src.toLowerCase();
      if (lowerSrc.includes('search') || lowerSrc.includes('job') || lowerSrc.includes('career') || lowerSrc.includes('listing')) {
        try {
          const resolvedSrc = new URL(src, normalizedUrl.normalizedUrl).toString();
          const scriptRes = await safeFetchUrl(resolvedSrc, { timeoutMs: 6000 });
          if (scriptRes.status === 200) {
            const bundleEndpoints = JobSourceDiscoveryService.extractEndpointCandidatesFromHtml(normalizedUrl.normalizedUrl, scriptRes.text);
            bundleEndpoints.forEach(bep => candidates.add(bep));
          }
        } catch {}
      }
    }

    const candidateList = Array.from(candidates);
    logger.info(`[DiscoveredApiStrategy] Testing ${candidateList.length} candidate endpoints from HTML & script bundles`);

    const { companyName, domain } = JobSourceDiscoveryService.extractCompanyMetadata(normalizedUrl.normalizedUrl, initialHtml);

    for (const ep of candidateList) {
      // Create endpoint variants: raw and with search/discovery query parameters
      const probeUrls = [ep];
      try {
        const epObj = new URL(ep);
        // Do NOT copy regional filters (e.g. country, city, location) to connector ingestion - discovery MUST be global!
        for (const [k, v] of Object.entries(normalizedUrl.searchParams)) {
          const lowerK = k.toLowerCase();
          if (['country', 'city', 'state', 'location', 'region'].includes(lowerK)) {
            continue; // Skip regional filter so we fetch global inventory
          }
          if (!epObj.searchParams.has(k)) {
            epObj.searchParams.set(k, v);
          }
        }
        if (!epObj.searchParams.has('q')) epObj.searchParams.set('q', '');
        if (!epObj.searchParams.has('searchType')) epObj.searchParams.set('searchType', '/search');
        if (!epObj.searchParams.has('lang')) epObj.searchParams.set('lang', 'en');
        // Request up to 1000 items directly if the endpoint supports it (standard Solr/API rows)
        if (!epObj.searchParams.has('rows')) epObj.searchParams.set('rows', '1000');
        if (!epObj.searchParams.has('start')) epObj.searchParams.set('start', '0');
        if (!epObj.searchParams.has('facetFields')) epObj.searchParams.set('facetFields', 'countryName,city,teams,experienceLevel,remote,typeOfEmployment');
        probeUrls.push(epObj.toString());
      } catch {}

      for (const targetProbeUrl of probeUrls) {
        try {
          const res = await safeFetchUrl(targetProbeUrl, { timeoutMs: 12000 });
          if (res.status === 200 && res.text.trim()) {
            const payload = JSON.parse(res.text);
            const { jobs, rootPath } = FieldMapperService.extractJobsArray(payload);
            const scoreCheck = JobRecordScoringService.scoreCandidateArray(jobs);

            if (scoreCheck.isJobCollection && jobs.length > 0) {
              const expectedCount = CompletenessEstimatorService.extractReportedTotal(payload);
              const mapping = FieldMapperService.inferDeterministicMapping(jobs);
              mapping.rootJobsPath = rootPath;

              const allDiscoveredDocs = [...jobs];

              // Pagination support: If expected total is greater than jobs returned and endpoint supports start/offset, paginate to collect complete inventory
              if (expectedCount && expectedCount > allDiscoveredDocs.length) {
                try {
                  const paginatedUrlObj = new URL(targetProbeUrl);
                  const rowsParam = paginatedUrlObj.searchParams.get('rows');
                  const pageSize = rowsParam ? parseInt(rowsParam, 10) : jobs.length;
                  let currentStart = allDiscoveredDocs.length;
                  let pageCount = 0;
                  const maxPages = 20;

                  while (allDiscoveredDocs.length < expectedCount && pageCount < maxPages) {
                    paginatedUrlObj.searchParams.set('start', String(currentStart));
                    const nextRes = await safeFetchUrl(paginatedUrlObj.toString(), { timeoutMs: 10000 });
                    if (nextRes.status !== 200 || !nextRes.text.trim()) break;
                    const nextPayload = JSON.parse(nextRes.text);
                    const { jobs: nextJobs } = FieldMapperService.extractJobsArray(nextPayload);
                    if (!nextJobs || nextJobs.length === 0) break;
                    allDiscoveredDocs.push(...nextJobs);
                    currentStart += nextJobs.length;
                    pageCount++;
                  }
                } catch (pageErr: any) {
                  logger.warn(`[DiscoveredApiStrategy] Pagination error: ${pageErr.message}`);
                }
              }

              const mappedJobs: DiscoveredJobRaw[] = [];
              for (const item of allDiscoveredDocs) {
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
                    country: mapped.country || item.countryName || item.country || undefined,
                    city: mapped.city || item.city || undefined,
                    description: mapped.description,
                    applicationUrl: mapped.applicationUrl || (item.jobUrl ? item.jobUrl : undefined),
                    postedAt: mapped.postedAt,
                    employmentType: mapped.employmentType,
                    rawPayload: item
                  });
                }
              }

              const completeness = CompletenessEstimatorService.evaluate(mappedJobs.length, expectedCount);

              return {
                matched: true,
                strategyName: this.name,
                sourceType: 'JSON_API',
                jobsEndpoint: targetProbeUrl,
                httpMethod: 'GET',
                companyName,
                officialDomain: domain,
                jobs: mappedJobs,
                expectedJobCount: expectedCount,
                completeness: completeness.completeness,
                paginationSupported: (expectedCount !== null && expectedCount > jobs.length) || true,
                mappingConfig: mapping
              };
            }
          }
        } catch {}
      }
    }

    return { matched: false } as any;
  }
}
