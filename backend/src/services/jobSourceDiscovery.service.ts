import * as cheerio from 'cheerio';
import { safeFetchUrl } from '../utils/safeFetch.js';
import { FieldMapperService, DiscoveredFieldMapping } from './fieldMapper.service.js';
import { AiFieldMapperService } from './aiFieldMapper.service.js';
import { CompanyRepository } from '../repositories/company.repository.js';
import { JobRepositoryV1 } from '../repositories/job.repository.js';
import { JobNormalizationService } from './jobNormalization.service.js';
import { prisma } from '../database/prisma.js';
import { logger } from '../utils/logger.js';
import { SourceHealth } from '@prisma/client';
import { HtmlJobDiscoveryService } from './htmlJobDiscovery.service.js';
import { EmbeddedDataDiscoveryService } from './embeddedDataDiscovery.service.js';

import { UniversalDiscoveryOrchestrator } from '../universalDiscovery/universalDiscoveryOrchestrator.js';
import { CompletenessStatus } from '../universalDiscovery/types.js';
import { CompletenessEstimatorService } from '../universalDiscovery/completenessEstimator.service.js';
import { GenericBrowserDiscoveryService } from '../universalDiscovery/services/genericBrowserDiscovery.service.js';
import { safeParseJson } from '../utils/safeJson.js';

export interface DiscoveryResult {
  detectedType: 'DIRECT_JSON' | 'JSON_API' | 'HTML' | 'EMBEDDED_DATA' | 'JSON_LD' | 'DYNAMIC_API' | 'SPECIALIZED_ATS' | string;
  sourceType?: string;
  atsType?: string;
  strategy?: string;
  sourceUrl: string;
  jobsEndpoint: string;
  companyName: string;
  officialDomain: string;
  jobCount: number;
  expectedJobCount?: number | null;
  completeness?: CompletenessStatus;
  paginationSupported?: boolean;
  paginationConfig?: any;
  mappingConfig: DiscoveredFieldMapping;
  sampleJobs: any[];
  allDiscoveredJobs?: any[];
  rawRecords?: number;
  uniqueRecords?: number;
  duplicatesRemoved?: number;
  pagesFetched?: number;
  pagesFailed?: number;
  lastPageReached?: boolean;
  warnings?: string[];
}

export interface SyncOutcome {
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  expired?: number;
}

export interface FullOnboardResult {
  success: boolean;
  sourceConfigurationId: string;
  companyId: string;
  companyName: string;
  discovery: DiscoveryResult;
  sync: SyncOutcome;
  error?: string;
}

export class JobSourceDiscoveryService {
  /**
   * Resolves company name and official domain from URL and HTML metadata.
   */
  public static extractCompanyMetadata(
    pageUrl: string,
    html?: string,
    jsonPayload?: any
  ): { companyName: string; domain: string } {
    const parsed = new URL(pageUrl);
    let domain = parsed.hostname.toLowerCase();
    if (domain.startsWith('www.')) {
      domain = domain.slice(4);
    }

    const hostParts = domain.split('.');
    let baseBrand = hostParts[0];
    if (['careers', 'jobs', 'career', 'job', 'work'].includes(baseBrand.toLowerCase()) && hostParts.length > 2) {
      baseBrand = hostParts[1];
    }
    let companyName = baseBrand.charAt(0).toUpperCase() + baseBrand.slice(1);

    if (html) {
      try {
        const $ = cheerio.load(html);

        // 1. JSON-LD Organization or JobPosting
        $('script[type="application/ld+json"]').each((_, el) => {
          try {
            const parsedLd = JSON.parse($(el).html() || '{}');
            if (parsedLd['@type'] === 'Organization' && parsedLd.name) {
              companyName = parsedLd.name;
            } else if (parsedLd.hiringOrganization && parsedLd.hiringOrganization.name) {
              companyName = parsedLd.hiringOrganization.name;
            }
          } catch {}
        });

        // 2. OpenGraph site name or title
        const ogSiteName = $('meta[property="og:site_name"]').attr('content');
        if (ogSiteName && ogSiteName.trim().length > 1) {
          companyName = ogSiteName.trim();
        } else {
          const ogTitle = $('meta[property="og:title"]').attr('content');
          if (ogTitle) {
            companyName = this.cleanCompanyCandidate(ogTitle, companyName);
          }
        }

        // 3. Document <title>
        const titleText = $('title').text().trim();
        if (titleText) {
          const cleanedFromTitle = this.cleanCompanyCandidate(titleText, companyName);
          if (cleanedFromTitle && cleanedFromTitle !== titleText) {
            companyName = cleanedFromTitle;
          } else if (!ogSiteName && (!companyName || companyName === domain.split('.')[0])) {
            companyName = cleanedFromTitle || companyName;
          }
        }
      } catch (err: any) {
        logger.warn(`[JobSourceDiscoveryService] HTML metadata extraction error: ${err.message}`);
      }
    }

    // Specific domain enhancements
    if (domain === 'codfis.com' && !companyName.toLowerCase().includes('technologies')) {
      companyName = 'Codfis Technologies';
    }

    return { companyName, domain };
  }

  /**
   * Cleans raw title or OG strings to extract a reliable company name.
   */
  private static cleanCompanyCandidate(raw: string, fallback: string): string {
    if (!raw) return fallback;
    let clean = raw.trim();

    // Check for "Careers at [Company]" or "Jobs at [Company]"
    const atMatch = clean.match(/(?:careers|jobs|working|openings)\s+at\s+([^|\-—:]+)/i);
    if (atMatch && atMatch[1]?.trim()) {
      return atMatch[1].trim();
    }

    // Split on delimiters
    const parts = clean.split(/[|\-—:]/).map(p => p.trim()).filter(Boolean);
    const genericSlogans = [
      'careers', 'jobs', 'openings', 'positions', 'join us',
      'do the work that matters', 'make an impact', 'explore opportunities',
      'work with us', 'future of work', 'grow with us', 'home',
      'career opportunities', 'job search', 'search jobs'
    ];

    for (const part of parts) {
      const lower = part.toLowerCase().trim();
      // Skip parts that match generic slogans or terms
      if (
        genericSlogans.some(s => lower === s || lower.startsWith(s + ' ') || lower.endsWith(' ' + s)) ||
        lower.includes('jobs & culture') || lower.includes('culture & jobs')
      ) {
        continue;
      }
      if (part.length >= 2 && part.length <= 40) {
        // If part contains underscores or hyphens with no spaces (e.g. "raintech_software" or "acme-solutions")
        // clean into Title Case words: "Raintech Software"
        if ((part.includes('_') || part.includes('-')) && !part.includes(' ')) {
          return part
            .split(/[-_]/)
            .filter(Boolean)
            .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
            .join(' ');
        }
        return part;
      }
    }

    return fallback;
  }

  /**
   * Discovers and parses endpoints from HTML scripts, fetch calls, or links.
   */
  public static extractEndpointCandidatesFromHtml(pageUrl: string, html: string): string[] {
    const candidates: Set<string> = new Set();
    const baseUrl = new URL(pageUrl);

    // Regex for fetch, axios, XMLHttpRequest, or quoted API endpoints
    const apiRegex = /(?:fetch|axios(?:\.get)?|url|endpoint)\s*\(\s*['"`]([^'"`]+)['"`]/gi;
    let match: RegExpExecArray | null;
    while ((match = apiRegex.exec(html)) !== null) {
      const candidatePath = match[1].trim();
      if (candidatePath && !candidatePath.startsWith('data:') && !candidatePath.endsWith('.js') && !candidatePath.endsWith('.css')) {
        try {
          const resolved = new URL(candidatePath, baseUrl.origin).toString();
          candidates.add(resolved);
        } catch {}
      }
    }

    // Look for string literals containing /jobs or /careers or /api or /bin
    const literalRegex = /['"`](\/(?:api|bin\/[a-z0-9\-_]+)?\/(?:jobs|careers|openings|positions|careers[a-zA-Z0-9_\-]+)(?:\.[a-z]+)?)['"`]/gi;
    while ((match = literalRegex.exec(html)) !== null) {
      const candidatePath = match[1].trim();
      try {
        const resolved = new URL(candidatePath, baseUrl.origin).toString();
        candidates.add(resolved);
      } catch {}
    }

    // Look for searchApiEndpoint / apiUrl in HTML/props
    const propApiRegex = /(?:searchApiEndpoint|apiEndpoint|apiUrl|endpoint)["']?\s*:\s*["']([^"']+)["']/gi;
    while ((match = propApiRegex.exec(html)) !== null) {
      const candidatePath = match[1].trim();
      try {
        const resolved = new URL(candidatePath, baseUrl.origin).toString();
        candidates.add(resolved);
      } catch {}
    }

    return Array.from(candidates);
  }

  /**
   * Main discovery entrypoint: executes Universal Discovery Engine V2.
   */
  public static async discoverSource(rawUrl: string): Promise<DiscoveryResult> {
    logger.info(`[JobSourceDiscoveryService] Starting universal discovery for: ${rawUrl}`);

    const universal = await UniversalDiscoveryOrchestrator.discover(rawUrl);

    return {
      detectedType: universal.detectedType as any,
      sourceType: universal.sourceType,
      atsType: universal.atsType,
      strategy: universal.strategy,
      sourceUrl: universal.sourceUrl,
      jobsEndpoint: universal.jobsEndpoint,
      companyName: universal.companyName,
      officialDomain: universal.officialDomain,
      jobCount: universal.discoveredJobCount,
      expectedJobCount: universal.expectedJobCount,
      completeness: universal.completeness,
      paginationSupported: universal.paginationSupported,
      paginationConfig: universal.paginationConfig,
      mappingConfig: universal.mappingConfig,
      sampleJobs: universal.sampleJobs,
      allDiscoveredJobs: universal.allDiscoveredJobs,
      rawRecords: universal.rawRecords,
      uniqueRecords: universal.uniqueRecords,
      duplicatesRemoved: universal.duplicatesRemoved,
      pagesFetched: universal.pagesFetched,
      pagesFailed: universal.pagesFailed,
      lastPageReached: universal.lastPageReached,
      warnings: universal.warnings
    };
  }

  /**
   * Syncs jobs using an existing JobSourceConfiguration record or direct discovery result.
   */
  public static async syncDiscoveredSource(
    configId: string,
    discovery: DiscoveryResult
  ): Promise<SyncOutcome> {
    const outcome: SyncOutcome = { created: 0, updated: 0, skipped: 0, failed: 0 };

    let rawRecords: any[] = [];
    if (discovery.allDiscoveredJobs && discovery.allDiscoveredJobs.length > 0) {
      // Use jobs discovered through universal orchestrator / adapters (e.g. RippleHire, Workday, etc.)
      rawRecords = discovery.allDiscoveredJobs;
    } else if (discovery.detectedType === 'SPECIALIZED_ATS' || discovery.sourceType === 'SPECIALIZED_ATS') {
      try {
        const universalRes = await UniversalDiscoveryOrchestrator.discover(discovery.sourceUrl);
        if (universalRes && universalRes.allDiscoveredJobs && universalRes.allDiscoveredJobs.length > 0) {
          rawRecords = universalRes.allDiscoveredJobs;
          discovery.expectedJobCount = universalRes.expectedJobCount;
          discovery.completeness = universalRes.completeness;
        }
      } catch (atsErr: any) {
        logger.warn(`[JobSourceDiscoveryService] Universal orchestrator for SPECIALIZED_ATS warning: ${atsErr.message}`);
      }
    } else {
      // 1. Fetch live jobs payload with pagination support
      let endpointToFetch = discovery.jobsEndpoint;
      try {
        const u = new URL(endpointToFetch);
        const rowsParam = u.searchParams.get('rows');
        if (rowsParam && parseInt(rowsParam, 10) === 50) {
          u.searchParams.set('rows', '1000');
          endpointToFetch = u.toString();
        }
      } catch {}

      if (discovery.detectedType === 'BROWSER_RENDERED') {
        const browserRes = await GenericBrowserDiscoveryService.discoverRenderedJobs(
          discovery.sourceUrl || discovery.jobsEndpoint,
          discovery.companyName,
          { timeoutMs: 30000, maxPages: 10 }
        );
        rawRecords = browserRes.jobs;
        discovery.expectedJobCount = browserRes.sourceTotal;
        discovery.completeness = browserRes.completeness;
      } else {
        const res = await safeFetchUrl(endpointToFetch, { timeoutMs: 15000 });
        if (res.status !== 200) {
          throw new Error(`Endpoint returned status ${res.status}`);
        }

        if (discovery.detectedType === 'EMBEDDED_DATA') {
          const embeddedResult = EmbeddedDataDiscoveryService.extractEmbeddedJobsFromHtml(res.text);
          if (embeddedResult && embeddedResult.jobs.length > 0) {
            rawRecords = embeddedResult.jobs;
          }
        } else if (discovery.detectedType === 'HTML') {
          const htmlResult = await HtmlJobDiscoveryService.extractJobsFromHtml(discovery.jobsEndpoint, res.text);
          if (htmlResult && htmlResult.jobs.length > 0) {
            rawRecords = htmlResult.jobs;
          }
        } else if (discovery.detectedType === 'JSON_LD') {
          const $ = cheerio.load(res.text);
          $('script[type="application/ld+json"]').each((_, el) => {
            try {
              const parsed = JSON.parse($(el).html() || '{}');
              if (parsed['@type'] === 'JobPosting') rawRecords.push(parsed);
              else if (Array.isArray(parsed['@graph'])) {
                parsed['@graph'].forEach((item: any) => {
                  if (item['@type'] === 'JobPosting') rawRecords.push(item);
                });
              }
            } catch {}
          });
        } else {
          const jsonResult = safeParseJson(res.text, res.contentType || res.headers?.['content-type']);
          if (jsonResult.success && jsonResult.data) {
            const payload = jsonResult.data;
            const { jobs } = FieldMapperService.extractJobsArray(payload);
            rawRecords = [...jobs];

            // Universal pagination: Check if source reports more total jobs than returned in page 1
            const reportedTotal = CompletenessEstimatorService.extractReportedTotal(payload);
            if (reportedTotal !== null && reportedTotal !== undefined) {
              discovery.expectedJobCount = reportedTotal;
            }

            if (reportedTotal && reportedTotal > rawRecords.length) {
              try {
                const paginatedUrlObj = new URL(discovery.jobsEndpoint);
                const rowsParam = paginatedUrlObj.searchParams.get('rows');
                const pageSize = rowsParam ? parseInt(rowsParam, 10) : (jobs.length || 20);
                let currentOffset = rawRecords.length;
                let pageCount = 0;
                const maxPages = 50;

                while (rawRecords.length < reportedTotal && pageCount < maxPages) {
                  if (paginatedUrlObj.searchParams.has('start')) {
                    paginatedUrlObj.searchParams.set('start', String(currentOffset));
                  } else if (paginatedUrlObj.searchParams.has('offset')) {
                    paginatedUrlObj.searchParams.set('offset', String(currentOffset));
                  } else if (paginatedUrlObj.searchParams.has('page')) {
                    const currentPage = Math.floor(currentOffset / pageSize) + 1;
                    paginatedUrlObj.searchParams.set('page', String(currentPage));
                  } else {
                    paginatedUrlObj.searchParams.set('start', String(currentOffset));
                  }

                  const nextRes = await safeFetchUrl(paginatedUrlObj.toString(), { timeoutMs: 12000 });
                  if (nextRes.status !== 200 || !nextRes.text.trim()) break;
                  const nextJsonResult = safeParseJson(nextRes.text, nextRes.contentType || nextRes.headers?.['content-type']);
                  if (!nextJsonResult.success || !nextJsonResult.data) break;
                  const { jobs: nextJobs } = FieldMapperService.extractJobsArray(nextJsonResult.data);
                  if (!nextJobs || nextJobs.length === 0) break;
                  rawRecords.push(...nextJobs);
                  currentOffset += nextJobs.length;
                  pageCount++;
                }
              } catch (pageErr: any) {
                logger.warn(`[JobSourceDiscoveryService] Pagination loop encountered warning: ${pageErr.message}`);
              }
            }
          } else if (jsonResult.isHtml) {
            logger.info(`[JobSourceDiscoveryService] Endpoint returned HTML instead of expected JSON. Attempting HTML and embedded state extraction.`);
            const htmlResult = await HtmlJobDiscoveryService.extractJobsFromHtml(discovery.jobsEndpoint, res.text);
            if (htmlResult && htmlResult.jobs.length > 0) {
              rawRecords = htmlResult.jobs;
            } else {
              const embeddedResult = EmbeddedDataDiscoveryService.extractEmbeddedJobsFromHtml(res.text);
              if (embeddedResult && embeddedResult.jobs.length > 0) {
                rawRecords = embeddedResult.jobs;
              }
            }
          } else {
            logger.warn(`[JobSourceDiscoveryService] Failed to parse endpoint response safely: ${jsonResult.error}`);
          }
        }
      }
    }

    if (rawRecords.length === 0) {
      logger.warn(`[JobSourceDiscoveryService] No job records extracted for ${discovery.companyName} at ${discovery.jobsEndpoint}`);
    }

    // 2. Resolve Canonical Company
    const company = await CompanyRepository.resolveOrCreate({
      name: discovery.companyName,
      officialDomain: discovery.officialDomain,
      careersUrl: discovery.sourceUrl,
      sourceType: discovery.detectedType
    });

    // 3. Register Canonical CompanySource
    const companySource = await CompanyRepository.registerSource({
      companyId: company.id,
      sourceType: discovery.detectedType,
      sourceName: discovery.companyName,
      sourceUrl: discovery.sourceUrl,
      externalIdentifier: discovery.jobsEndpoint
    });

    // 4. Ingest and persist jobs via canonical V1 architecture
    const defaults = {
      companyName: company.name,
      companyDomain: company.officialDomain || discovery.officialDomain,
      careersUrl: discovery.sourceUrl,
      sourceType: discovery.detectedType,
      sourceName: discovery.companyName
    };

    const seenJobIds: string[] = [];

    for (const rawItem of rawRecords) {
      try {
        const itemToMap = rawItem.rawPayload || rawItem;
        let mapped = FieldMapperService.mapRecord(itemToMap, discovery.mappingConfig, defaults);
        if (!mapped || !mapped.title) {
          // If mapRecord on rawPayload didn't match (e.g. DiscoveredJobRaw fields), use DiscoveredJobRaw fields directly
          if (rawItem.title) {
            mapped = {
              externalJobId: rawItem.externalJobId,
              title: rawItem.title,
              department: rawItem.department,
              location: rawItem.location,
              country: rawItem.country,
              city: rawItem.city,
              stateProvince: rawItem.stateProvince,
              remoteType: rawItem.workMode,
              employmentType: rawItem.employmentType,
              experience: rawItem.experience,
              salary: rawItem.salary,
              descriptionHtml: rawItem.description,
              descriptionText: rawItem.description,
              responsibilities: rawItem.responsibilities,
              requirements: rawItem.requirements,
              skills: rawItem.skills,
              preferredQualifications: rawItem.preferredSkills,
              sourceUrl: rawItem.url || rawItem.applicationUrl || defaults.careersUrl,
              applicationUrl: rawItem.applicationUrl || rawItem.url || defaults.careersUrl,
              postedAt: rawItem.postedAt,
              companyName: defaults.companyName,
              sourceType: defaults.sourceType,
              sourceName: defaults.sourceName
            };
          } else {
            outcome.skipped++;
            continue;
          }
        }

        if (mapped && mapped.title) {
          if (!mapped.country && (rawItem.country || rawItem.countryName || (rawItem.rawPayload && (rawItem.rawPayload.countryName || rawItem.rawPayload.country)))) {
            mapped.country = rawItem.country || rawItem.countryName || rawItem.rawPayload.countryName || rawItem.rawPayload.country;
          }
          if (!mapped.city && (rawItem.city || (rawItem.rawPayload && rawItem.rawPayload.city))) {
            mapped.city = rawItem.city || rawItem.rawPayload.city;
          }
          if (!mapped.location && (rawItem.location || rawItem.displayLocation || (rawItem.rawPayload && (rawItem.rawPayload.displayLocation || rawItem.rawPayload.location)))) {
            mapped.location = rawItem.location || rawItem.displayLocation || rawItem.rawPayload.displayLocation || rawItem.rawPayload.location;
          }
          // Exact application URL preservation: adapter-produced applicationUrl/jobUrl MUST take precedence over generic careersUrl
          const exactTargetUrl = rawItem.applicationUrl || rawItem.jobUrl || (rawItem.rawPayload && (rawItem.rawPayload.jobUrl || rawItem.rawPayload.applicationUrl));
          if (exactTargetUrl && (!mapped.applicationUrl || mapped.applicationUrl === defaults.careersUrl)) {
            mapped.applicationUrl = exactTargetUrl;
          }
          const exactSourceUrl = rawItem.sourceUrl || rawItem.url || exactTargetUrl;
          if (exactSourceUrl && (!mapped.sourceUrl || mapped.sourceUrl === defaults.careersUrl)) {
            mapped.sourceUrl = exactSourceUrl;
          }
          const richRawDesc = rawItem.description ||
            (rawItem.rawPayload && (rawItem.rawPayload.jobDesc || rawItem.rawPayload.jobDescription || rawItem.rawPayload.jobDescriptionHtml || rawItem.rawPayload.descriptionPlain || rawItem.rawPayload.content || rawItem.rawPayload.descriptionText || rawItem.rawPayload.details));
          if (richRawDesc && (!mapped.descriptionText || mapped.descriptionText === mapped.title || mapped.descriptionText.length < richRawDesc.length)) {
            mapped.descriptionText = richRawDesc;
          }
          if (rawItem.responsibilities && Array.isArray(rawItem.responsibilities) && rawItem.responsibilities.length > 0 && (!mapped.responsibilities || mapped.responsibilities.length === 0)) {
            mapped.responsibilities = rawItem.responsibilities;
          }
          if (rawItem.requirements && Array.isArray(rawItem.requirements) && rawItem.requirements.length > 0 && (!mapped.requirements || mapped.requirements.length === 0)) {
            mapped.requirements = rawItem.requirements;
          }
          if (rawItem.skills && Array.isArray(rawItem.skills) && rawItem.skills.length > 0 && (!mapped.skills || mapped.skills.length === 0)) {
            mapped.skills = rawItem.skills;
          }

          // If descriptionText is still equal to title, attempt to build from responsibilities/requirements
          if ((!mapped.descriptionText || mapped.descriptionText.trim().toLowerCase() === mapped.title.trim().toLowerCase()) &&
              ((mapped.responsibilities && mapped.responsibilities.length > 0) || (mapped.requirements && mapped.requirements.length > 0))) {
            const parts: string[] = [];
            if (mapped.responsibilities && mapped.responsibilities.length > 0) {
              parts.push(`Key Responsibilities:\n${mapped.responsibilities.map((r: string) => `• ${r}`).join('\n')}`);
            }
            if (mapped.requirements && mapped.requirements.length > 0) {
              parts.push(`Qualifications & Requirements:\n${mapped.requirements.map((req: string) => `• ${req}`).join('\n')}`);
            }
            mapped.descriptionText = parts.join('\n\n');
          }
        }

        const normalized = JobNormalizationService.normalize(mapped);
        const { job, isNew } = await JobRepositoryV1.upsertNormalizedJob(company.id, normalized);
        seenJobIds.push(job.id);

        if (isNew) {
          outcome.created++;
        } else {
          outcome.updated++;
        }
      } catch (itemErr: any) {
        outcome.skipped++;
        logger.warn(`[JobSourceDiscoveryService] Skipped job record: ${itemErr.message}`);
      }
    }

    // 5. Source-Specific Job Reconciliation (Mark missing jobs checked, expire if past 14-day threshold)
    // CRITICAL: If discovery is PARTIAL or seenJobIds is empty, never expire missing jobs as removed!
    if (discovery.completeness !== 'PARTIAL' && seenJobIds.length > 0) {
      const { expiredCount } = await JobRepositoryV1.reconcileSourceJobs(
        company.id,
        discovery.detectedType,
        seenJobIds,
        14
      );
      outcome.expired = expiredCount;
    } else {
      outcome.expired = 0;
      logger.info(`[JobSourceDiscoveryService] Discovery is ${discovery.completeness || 'EMPTY'} (${seenJobIds.length} seen); skipping job expiration reconciliation to protect existing inventory.`);
    }

    // 6. Update health and stats on CompanySource & JobSourceConfiguration
    await CompanyRepository.updateSourceHealth(companySource.id, true);

    const isPartial = discovery.completeness === 'PARTIAL' || (discovery.expectedJobCount && rawRecords.length < discovery.expectedJobCount);
    const resolvedCompleteness = isPartial ? 'PARTIAL' : (discovery.completeness || (discovery.expectedJobCount && rawRecords.length >= discovery.expectedJobCount ? 'COMPLETE' : 'UNKNOWN'));

    await prisma.jobSourceConfiguration.update({
      where: { id: configId },
      data: {
        companyId: company.id,
        companySourceId: companySource.id,
        healthStatus: isPartial ? SourceHealth.DEGRADED : SourceHealth.HEALTHY,
        lastSyncAt: new Date(),
        lastSuccessfulSyncAt: new Date(),
        lastSyncError: null,
        jobsFound: rawRecords.length,
        jobsCreated: outcome.created,
        jobsUpdated: outcome.updated,
        jobsExpired: outcome.expired || 0,
        syncInProgress: false,
        syncLockToken: null,
        discoveryMetadata: {
          lastSyncAt: new Date().toISOString(),
          jobCount: rawRecords.length,
          expectedJobCount: discovery.expectedJobCount ?? null,
          completeness: resolvedCompleteness,
          detectedType: discovery.detectedType,
          atsType: discovery.atsType ?? null,
          strategy: discovery.strategy ?? null,
          paginationSupported: discovery.paginationSupported ?? true,
          paginationConfig: discovery.paginationConfig ?? null
        }
      }
    });

    return outcome;
  }

  /**
   * Full admin onboarding pipeline:
   * URL -> Validate & Safe Fetch -> Discover -> Infer Schema -> Persist Configuration -> First Sync.
   */
  public static async discoverAndOnboard(url: string): Promise<FullOnboardResult> {
    try {
      // 1. Run discovery pipeline
      const discovery = await this.discoverSource(url);

      // 2. Resolve Canonical Company
      const company = await CompanyRepository.resolveOrCreate({
        name: discovery.companyName,
        officialDomain: discovery.officialDomain,
        careersUrl: discovery.sourceUrl,
        sourceType: discovery.detectedType
      });

      // 3. Persist or Update JobSourceConfiguration
      let config = await prisma.jobSourceConfiguration.findFirst({
        where: {
          companyId: company.id,
          OR: [
            { sourceUrl: discovery.sourceUrl },
            { jobsEndpoint: discovery.jobsEndpoint }
          ]
        }
      });

      if (config) {
        config = await prisma.jobSourceConfiguration.update({
          where: { id: config.id },
          data: {
            sourceUrl: discovery.sourceUrl,
            jobsEndpoint: discovery.jobsEndpoint,
            sourceType: discovery.detectedType,
            mappingConfig: discovery.mappingConfig as any,
            discoveryMetadata: {
              discoveredAt: new Date().toISOString(),
              jobCount: discovery.jobCount,
              expectedJobCount: discovery.expectedJobCount ?? null,
              completeness: discovery.completeness ?? 'UNKNOWN',
              detectedType: discovery.detectedType,
              atsType: discovery.atsType ?? null,
              strategy: discovery.strategy ?? null,
              paginationSupported: discovery.paginationSupported ?? false,
              paginationConfig: discovery.paginationConfig ?? null
            },
            lastDiscoveryAt: new Date(),
            healthStatus: discovery.completeness === 'PARTIAL' ? SourceHealth.DEGRADED : SourceHealth.HEALTHY
          }
        });
      } else {
        config = await prisma.jobSourceConfiguration.create({
          data: {
            companyId: company.id,
            sourceUrl: discovery.sourceUrl,
            jobsEndpoint: discovery.jobsEndpoint,
            sourceType: discovery.detectedType,
            parserType: 'AUTO',
            httpMethod: 'GET',
            mappingConfig: discovery.mappingConfig as any,
            discoveryMetadata: {
              discoveredAt: new Date().toISOString(),
              jobCount: discovery.jobCount,
              expectedJobCount: discovery.expectedJobCount ?? null,
              completeness: discovery.completeness ?? 'UNKNOWN',
              detectedType: discovery.detectedType,
              atsType: discovery.atsType ?? null,
              strategy: discovery.strategy ?? null,
              paginationSupported: discovery.paginationSupported ?? false,
              paginationConfig: discovery.paginationConfig ?? null
            },
            lastDiscoveryAt: new Date(),
            healthStatus: discovery.completeness === 'PARTIAL' ? SourceHealth.DEGRADED : SourceHealth.HEALTHY
          }
        });
      }

      // 4. Run immediate first sync
      const syncOutcome = await this.syncDiscoveredSource(config.id, discovery);

      return {
        success: true,
        sourceConfigurationId: config.id,
        companyId: company.id,
        companyName: company.name,
        discovery,
        sync: syncOutcome
      };
    } catch (err: any) {
      logger.error(`[JobSourceDiscoveryService] Onboarding failed: ${err.message}`);
      return {
        success: false,
        sourceConfigurationId: '',
        companyId: '',
        companyName: '',
        discovery: {
          detectedType: 'HTML',
          sourceUrl: url,
          jobsEndpoint: '',
          companyName: '',
          officialDomain: '',
          jobCount: 0,
          mappingConfig: {},
          sampleJobs: []
        },
        sync: { created: 0, updated: 0, skipped: 0, failed: 1 },
        error: err.message
      };
    }
  }

  /**
   * Resync an existing configured job source by ID.
   */
  public static async resyncConfiguration(configId: string): Promise<{ success: boolean; sync: SyncOutcome; error?: string }> {
    const config = await prisma.jobSourceConfiguration.findUnique({
      where: { id: configId },
      include: { company: true }
    });

    if (!config) {
      throw new Error(`JobSourceConfiguration with id ${configId} not found.`);
    }

    try {
      let endpoint = config.jobsEndpoint || config.sourceUrl;
      try {
        const u = new URL(endpoint);
        if (u.searchParams.get('rows') === '50') {
          u.searchParams.set('rows', '1000');
          endpoint = u.toString();
        }
      } catch {}

      const meta = (config.discoveryMetadata as any) || {};

      const discovery: DiscoveryResult = {
        detectedType: config.sourceType as any,
        sourceUrl: config.sourceUrl,
        jobsEndpoint: endpoint,
        companyName: config.company.name,
        officialDomain: config.company.officialDomain || '',
        jobCount: config.jobsFound,
        expectedJobCount: meta.expectedJobCount ?? null,
        completeness: meta.completeness ?? 'UNKNOWN',
        paginationSupported: meta.paginationSupported ?? true,
        mappingConfig: (config.mappingConfig as any) || {},
        sampleJobs: []
      };

      const sync = await this.syncDiscoveredSource(config.id, discovery);
      return { success: true, sync };
    } catch (err: any) {
      await prisma.jobSourceConfiguration.update({
        where: { id: configId },
        data: {
          lastSyncAt: new Date(),
          lastSyncError: err.message,
          healthStatus: SourceHealth.FAILING
        }
      });

      if (config.companySourceId) {
        await CompanyRepository.updateSourceHealth(config.companySourceId, false, err.message);
      }

      return {
        success: false,
        sync: { created: 0, updated: 0, skipped: 0, failed: 1 },
        error: err.message
      };
    }
  }
}
