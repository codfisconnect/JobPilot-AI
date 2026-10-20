import { IJobSourceStrategy, StrategyContext, StrategyExecutionResult } from '../strategy.interface.js';
import { safeFetchUrl } from '../../utils/safeFetch.js';
import { CompletenessEstimatorService } from '../completenessEstimator.service.js';
import { DiscoveredJobRaw } from '../types.js';
import { logger } from '../../utils/logger.js';
import * as cheerio from 'cheerio';

export class PhenomAdapter implements IJobSourceStrategy {
  public readonly name = 'PHENOM_ADAPTER';
  public readonly priority = 12; // High priority specialized ATS accelerator

  public canHandle(context: StrategyContext): boolean {
    const { normalizedUrl, initialHtml } = context;
    if (context.fingerprint.atsVendor === 'PHENOM') return true;
    if (normalizedUrl.domain.includes('phenompeople.com')) return true;
    if (initialHtml) {
      const lower = initialHtml.toLowerCase();
      if (
        lower.includes('phenom') ||
        lower.includes('phapp') ||
        lower.includes('eagerloadrefinesearch') ||
        lower.includes('refinesearch')
      ) {
        return true;
      }
    }
    return false;
  }

  public async execute(context: StrategyContext): Promise<StrategyExecutionResult> {
    const { normalizedUrl, initialHtml } = context;
    if (!initialHtml) return { matched: false } as any;

    let companyName = normalizedUrl.domain.split('.')[0];
    if (companyName === 'www') {
      const parts = normalizedUrl.domain.split('.');
      companyName = parts[1] || companyName;
    }
    companyName = companyName.charAt(0).toUpperCase() + companyName.slice(1);

    const $ = cheerio.load(initialHtml);
    const titleText = $('title').text();
    if (titleText && titleText.includes('|')) {
      const parts = titleText.split('|');
      if (parts[parts.length - 1]?.trim()) {
        companyName = parts[parts.length - 1].trim();
      }
    }

    // Determine Phenom search-results endpoint URL
    // Standard Phenom URLs:
    // https://www.virtusa.com/careers/job-search/global/en
    // Search results URL: https://www.virtusa.com/careers/job-search/global/en/search-results
    let searchResultsUrl = normalizedUrl.normalizedUrl;
    if (!searchResultsUrl.includes('/search-results')) {
      const u = new URL(searchResultsUrl);
      u.pathname = u.pathname.replace(/\/+$/, '') + '/search-results';
      u.search = '';
      searchResultsUrl = u.toString();
    }

    // Extract first page from initial HTML if it already contains phApp.ddo.eagerLoadRefineSearch
    let totalHits: number | null = null;
    const allJobs: DiscoveredJobRaw[] = [];
    const seenJobIds = new Set<string>();

    const firstPageDdo = this.extractDdo(initialHtml);
    if (firstPageDdo?.eagerLoadRefineSearch) {
      totalHits = firstPageDdo.eagerLoadRefineSearch.totalHits || null;
      const initialJobs = firstPageDdo.eagerLoadRefineSearch.data?.jobs || [];
      for (const item of initialJobs) {
        const parsed = this.mapPhenomJob(item, normalizedUrl.baseUrl);
        const jobId = parsed?.externalJobId || parsed?.title;
        if (parsed && jobId && !seenJobIds.has(jobId)) {
          seenJobIds.add(jobId);
          allJobs.push(parsed);
        }
      }
    }

    logger.info(`[PhenomAdapter] Initial page yielded ${allJobs.length} jobs, reported total: ${totalHits}`);

    // If initial HTML did not yield totalHits or jobs, fetch the search-results page
    if (totalHits === null || allJobs.length === 0) {
      try {
        const firstRes = await safeFetchUrl(`${searchResultsUrl}?from=0&s=1`, { timeoutMs: 12000 });
        if (firstRes.status === 200) {
          const ddo = this.extractDdo(firstRes.text);
          if (ddo?.eagerLoadRefineSearch) {
            totalHits = ddo.eagerLoadRefineSearch.totalHits || null;
            const jobs = ddo.eagerLoadRefineSearch.data?.jobs || [];
            for (const item of jobs) {
              const parsed = this.mapPhenomJob(item, normalizedUrl.baseUrl);
              const jobId = parsed?.externalJobId || parsed?.title;
              if (parsed && jobId && !seenJobIds.has(jobId)) {
                seenJobIds.add(jobId);
                allJobs.push(parsed);
              }
            }
          }
        }
      } catch (err: any) {
        logger.warn(`[PhenomAdapter] Error fetching first search-results page: ${err.message}`);
      }
    }

    // Pagination: Phenom paginates by `from` offset (10 results per page)
    const pageSize = 10;
    const targetTotal = totalHits || allJobs.length;
    let currentFrom = allJobs.length;
    let pageCount = 0;
    let consecutiveEmptyPages = 0;
    const maxPages = 600; // Cap to prevent infinite loops while supporting full inventory

    while (currentFrom < targetTotal && pageCount < maxPages) {
      pageCount++;
      const pageUrl = `${searchResultsUrl}?from=${currentFrom}&s=1`;
      try {
        const pageRes = await safeFetchUrl(pageUrl, { timeoutMs: 10000 });
        if (pageRes.status !== 200) {
          logger.warn(`[PhenomAdapter] Non-200 status ${pageRes.status} on offset ${currentFrom}`);
          break;
        }

        const ddo = this.extractDdo(pageRes.text);
        const pageJobs = ddo?.eagerLoadRefineSearch?.data?.jobs || [];
        if (pageJobs.length === 0) {
          logger.info(`[PhenomAdapter] Empty page encountered at offset ${currentFrom}`);
          break;
        }

        let newRecords = 0;
        for (const item of pageJobs) {
          const parsed = this.mapPhenomJob(item, normalizedUrl.baseUrl);
          const jobId = parsed?.externalJobId || parsed?.title;
          if (parsed && jobId && !seenJobIds.has(jobId)) {
            seenJobIds.add(jobId);
            allJobs.push(parsed);
            newRecords++;
          }
        }

        if (newRecords === 0) {
          consecutiveEmptyPages++;
          if (consecutiveEmptyPages >= 5) {
            logger.info(`[PhenomAdapter] Reached 5 consecutive duplicate pages at offset ${currentFrom}, stopping pagination`);
            break;
          }
        } else {
          consecutiveEmptyPages = 0;
        }

        currentFrom += pageJobs.length;
      } catch (err: any) {
        logger.warn(`[PhenomAdapter] Error fetching page at offset ${currentFrom}: ${err.message}`);
        break;
      }
    }

    const evaluation = CompletenessEstimatorService.evaluate(allJobs.length, totalHits);

    return {
      matched: allJobs.length > 0,
      strategyName: this.name,
      sourceType: 'ATS_JOB_BOARD',
      atsType: 'PHENOM',
      jobsEndpoint: searchResultsUrl,
      httpMethod: 'GET',
      companyName,
      officialDomain: normalizedUrl.domain,
      jobs: allJobs,
      expectedJobCount: totalHits,
      completeness: evaluation.completeness,
      paginationSupported: true
    };
  }

  private extractDdo(html: string): any | null {
    if (!html) return null;
    const match = html.match(/phApp\.ddo\s*=\s*(\{[\s\S]*?\});/);
    if (!match || !match[1]) return null;
    try {
      return JSON.parse(match[1]);
    } catch {
      return null;
    }
  }

  private mapPhenomJob(item: any, baseUrl: string): DiscoveredJobRaw | null {
    if (!item) return null;
    const id = String(item.jobId || item.jobSeqNo || '');
    const title = item.title || item.jobTitle || item.name;
    if (!title) return null;

    let location = '';
    if (Array.isArray(item.multi_location) && item.multi_location.length > 0) {
      location = item.multi_location.join(', ');
    } else if (item.city || item.country) {
      location = [item.city, item.state, item.country].filter(Boolean).join(', ');
    }

    const description =
      item.ml_job_parser?.descriptionTeaser ||
      item.descriptionTeaser ||
      item.description ||
      item.jobDescription ||
      title;

    // Build application / view link
    let appUrl = item.applyUrl || item.externalApplyUrl || item.url;
    if (!appUrl && item.jobSeqNo) {
      appUrl = `${baseUrl.replace(/\/+$/, '')}/job/${item.jobSeqNo}`;
    }

    return {
      externalJobId: id,
      title,
      location: location || undefined,
      description,
      employmentType: item.type || undefined,
      applicationUrl: appUrl || undefined,
      postedAt: item.postedDate ? new Date(item.postedDate) : undefined,
      rawPayload: item
    };
  }
}
