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

export interface DiscoveryResult {
  detectedType: 'DIRECT_JSON' | 'JSON_API' | 'HTML' | 'EMBEDDED_DATA' | 'JSON_LD' | 'DYNAMIC_API' | 'SPECIALIZED_ATS';
  sourceUrl: string;
  jobsEndpoint: string;
  companyName: string;
  officialDomain: string;
  jobCount: number;
  mappingConfig: DiscoveredFieldMapping;
  sampleJobs: any[];
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

    let companyName = domain.split('.')[0];
    companyName = companyName.charAt(0).toUpperCase() + companyName.slice(1);

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
        if (titleText && (!companyName || companyName === domain.split('.')[0])) {
          companyName = this.cleanCompanyCandidate(titleText, companyName);
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
    for (const part of parts) {
      const lower = part.toLowerCase();
      // Skip parts that are solely generic terms
      if (
        lower === 'careers' || lower === 'jobs' || lower === 'openings' ||
        lower === 'positions' || lower === 'join us' || lower.includes('jobs & culture') ||
        lower.includes('culture & jobs') || lower.includes('home')
      ) {
        continue;
      }
      if (part.length >= 2 && part.length <= 40) {
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

    // Look for string literals containing /jobs or /careers or /api
    const literalRegex = /['"`](\/(?:api\/)?(?:jobs|careers|openings|positions)(?:\.[a-z]+)?)['"`]/gi;
    while ((match = literalRegex.exec(html)) !== null) {
      const candidatePath = match[1].trim();
      try {
        const resolved = new URL(candidatePath, baseUrl.origin).toString();
        candidates.add(resolved);
      } catch {}
    }

    return Array.from(candidates);
  }

  /**
   * Main discovery entrypoint: executes Strategies A through D.
   */
  public static async discoverSource(rawUrl: string): Promise<DiscoveryResult> {
    logger.info(`[JobSourceDiscoveryService] Starting discovery for: ${rawUrl}`);

    // Step 1: Fetch initial page safely with SSRF protection
    const initialResponse = await safeFetchUrl(rawUrl);
    const contentType = (initialResponse.contentType || '').toLowerCase();
    const responseText = initialResponse.text.trim();

    // Strategy A: Direct JSON response
    if (contentType.includes('application/json') || (responseText.startsWith('{') && responseText.endsWith('}')) || (responseText.startsWith('[') && responseText.endsWith(']'))) {
      try {
        const jsonPayload = JSON.parse(responseText);
        const { jobs, rootPath } = FieldMapperService.extractJobsArray(jsonPayload);
        if (jobs.length > 0) {
          const { companyName, domain } = this.extractCompanyMetadata(initialResponse.finalUrl, undefined, jsonPayload);
          let mapping = FieldMapperService.inferDeterministicMapping(jobs);
          mapping.rootJobsPath = rootPath;

          // If key fields are missing, try AI mapping fallback
          if (!mapping.titleField) {
            const aiMapping = await AiFieldMapperService.inferMappingWithAi(jobs[0]);
            mapping = { ...aiMapping, ...mapping };
          }

          return {
            detectedType: 'DIRECT_JSON',
            sourceUrl: rawUrl,
            jobsEndpoint: initialResponse.finalUrl,
            companyName,
            officialDomain: domain,
            jobCount: jobs.length,
            mappingConfig: mapping,
            sampleJobs: jobs.slice(0, 3)
          };
        }
      } catch (err: any) {
        logger.warn(`[JobSourceDiscoveryService] Strategy A JSON parse failed: ${err.message}`);
      }
    }

    // Response is HTML
    const html = responseText;
    const { companyName, domain } = this.extractCompanyMetadata(initialResponse.finalUrl, html);

    // Strategy D: Embedded Data / JSON-LD in HTML
    try {
      const $ = cheerio.load(html);
      const jsonLdJobs: any[] = [];
      $('script[type="application/ld+json"]').each((_, el) => {
        try {
          const parsed = JSON.parse($(el).html() || '{}');
          if (parsed['@type'] === 'JobPosting') {
            jsonLdJobs.push(parsed);
          } else if (Array.isArray(parsed['@graph'])) {
            parsed['@graph'].forEach((item: any) => {
              if (item['@type'] === 'JobPosting') jsonLdJobs.push(item);
            });
          }
        } catch {}
      });

      if (jsonLdJobs.length > 0) {
        let mapping = FieldMapperService.inferDeterministicMapping(jsonLdJobs);
        return {
          detectedType: 'JSON_LD',
          sourceUrl: rawUrl,
          jobsEndpoint: initialResponse.finalUrl,
          companyName,
          officialDomain: domain,
          jobCount: jsonLdJobs.length,
          mappingConfig: mapping,
          sampleJobs: jsonLdJobs.slice(0, 3)
        };
      }
    } catch {}

    // Strategy B: HTML referencing JSON API (discovered endpoints)
    const discoveredEndpoints = this.extractEndpointCandidatesFromHtml(initialResponse.finalUrl, html);
    logger.info(`[JobSourceDiscoveryService] Discovered ${discoveredEndpoints.length} candidate endpoints from HTML`);

    for (const endpoint of discoveredEndpoints) {
      try {
        const epRes = await safeFetchUrl(endpoint, { timeoutMs: 7000 });
        if (epRes.status === 200) {
          const jsonPayload = JSON.parse(epRes.text);
          const { jobs, rootPath } = FieldMapperService.extractJobsArray(jsonPayload);
          if (jobs.length > 0) {
            let mapping = FieldMapperService.inferDeterministicMapping(jobs);
            mapping.rootJobsPath = rootPath;

            if (!mapping.titleField) {
              const aiMapping = await AiFieldMapperService.inferMappingWithAi(jobs[0]);
              mapping = { ...aiMapping, ...mapping };
            }

            return {
              detectedType: 'JSON_API',
              sourceUrl: rawUrl,
              jobsEndpoint: endpoint,
              companyName,
              officialDomain: domain,
              jobCount: jobs.length,
              mappingConfig: mapping,
              sampleJobs: jobs.slice(0, 3)
            };
          }
        }
      } catch (e: any) {
        // Continue trying other candidates
      }
    }

    // Strategy C: Common JSON Endpoints (controlled probing)
    const baseOrigin = new URL(initialResponse.finalUrl).origin;
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

    for (const probePath of probePaths) {
      const probeUrl = `${baseOrigin}${probePath}`;
      try {
        const probeRes = await safeFetchUrl(probeUrl, { timeoutMs: 5000 });
        if (probeRes.status === 200) {
          const jsonPayload = JSON.parse(probeRes.text);
          const { jobs, rootPath } = FieldMapperService.extractJobsArray(jsonPayload);
          if (jobs.length > 0) {
            let mapping = FieldMapperService.inferDeterministicMapping(jobs);
            mapping.rootJobsPath = rootPath;

            if (!mapping.titleField) {
              const aiMapping = await AiFieldMapperService.inferMappingWithAi(jobs[0]);
              mapping = { ...aiMapping, ...mapping };
            }

            return {
              detectedType: 'JSON_API',
              sourceUrl: rawUrl,
              jobsEndpoint: probeUrl,
              companyName,
              officialDomain: domain,
              jobCount: jobs.length,
              mappingConfig: mapping,
              sampleJobs: jobs.slice(0, 3)
            };
          }
        }
      } catch (probeErr) {
        // continue probing
      }
    }

    // Strategy D2: Embedded Application State (Next.js RSC, __NEXT_DATA__, JSON state in script tags)
    try {
      const embeddedResult = EmbeddedDataDiscoveryService.extractEmbeddedJobsFromHtml(html);
      if (embeddedResult && embeddedResult.jobs.length > 0) {
        logger.info(`[JobSourceDiscoveryService] Discovered ${embeddedResult.jobs.length} jobs via Embedded Data (${embeddedResult.sourceType})`);
        let mapping = FieldMapperService.inferDeterministicMapping(embeddedResult.jobs);
        if (embeddedResult.rootPath) {
          mapping.rootJobsPath = embeddedResult.rootPath;
        }

        if (!mapping.titleField) {
          const aiMapping = await AiFieldMapperService.inferMappingWithAi(embeddedResult.jobs[0]);
          mapping = { ...aiMapping, ...mapping };
        }

        return {
          detectedType: 'EMBEDDED_DATA',
          sourceUrl: rawUrl,
          jobsEndpoint: initialResponse.finalUrl,
          companyName,
          officialDomain: domain,
          jobCount: embeddedResult.jobs.length,
          mappingConfig: mapping,
          sampleJobs: embeddedResult.jobs.slice(0, 3)
        };
      }
    } catch (embErr: any) {
      logger.warn(`[JobSourceDiscoveryService] Embedded data discovery failed: ${embErr.message}`);
    }

    // Strategy E: HTML repeated structure & detail pages discovery
    try {
      logger.info(`[JobSourceDiscoveryService] Probing for HTML job structures on: ${initialResponse.finalUrl}`);
      const htmlResult = await HtmlJobDiscoveryService.extractJobsFromHtml(initialResponse.finalUrl, html);
      if (htmlResult && htmlResult.jobs.length > 0) {
        logger.info(`[JobSourceDiscoveryService] Strategy E extracted ${htmlResult.jobs.length} jobs using strategy: ${htmlResult.strategy}`);
        
        let mapping = FieldMapperService.inferDeterministicMapping(htmlResult.jobs);
        if (!mapping.titleField) {
          mapping.titleField = 'title';
        }
        if (!mapping.descriptionField) {
          mapping.descriptionField = 'description';
        }

        return {
          detectedType: 'HTML',
          sourceUrl: rawUrl,
          jobsEndpoint: initialResponse.finalUrl,
          companyName,
          officialDomain: domain,
          jobCount: htmlResult.jobs.length,
          mappingConfig: mapping,
          sampleJobs: htmlResult.jobs.slice(0, 3)
        };
      }
    } catch (htmlErr: any) {
      logger.warn(`[JobSourceDiscoveryService] Strategy E HTML extraction failed: ${htmlErr.message}`);
    }

    throw new Error(`Could not find a structured jobs feed on page: ${rawUrl}`);
  }

  /**
   * Syncs jobs using an existing JobSourceConfiguration record or direct discovery result.
   */
  public static async syncDiscoveredSource(
    configId: string,
    discovery: DiscoveryResult
  ): Promise<SyncOutcome> {
    const outcome: SyncOutcome = { created: 0, updated: 0, skipped: 0, failed: 0 };

    // 1. Fetch live jobs payload
    const res = await safeFetchUrl(discovery.jobsEndpoint);
    if (res.status !== 200) {
      throw new Error(`Endpoint returned status ${res.status}`);
    }

    let rawRecords: any[] = [];
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
      const payload = JSON.parse(res.text);
      const { jobs } = FieldMapperService.extractJobsArray(payload);
      rawRecords = jobs;
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
        const mapped = FieldMapperService.mapRecord(rawItem, discovery.mappingConfig, defaults);
        if (!mapped || !mapped.title) {
          outcome.skipped++;
          continue;
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
    const { expiredCount } = await JobRepositoryV1.reconcileSourceJobs(
      company.id,
      discovery.detectedType,
      seenJobIds,
      14
    );
    outcome.expired = expiredCount;

    // 6. Update health and stats on CompanySource & JobSourceConfiguration
    await CompanyRepository.updateSourceHealth(companySource.id, true);

    await prisma.jobSourceConfiguration.update({
      where: { id: configId },
      data: {
        companyId: company.id,
        companySourceId: companySource.id,
        healthStatus: SourceHealth.HEALTHY,
        lastSyncAt: new Date(),
        lastSuccessfulSyncAt: new Date(),
        lastSyncError: null,
        jobsFound: rawRecords.length,
        jobsCreated: outcome.created,
        jobsUpdated: outcome.updated,
        jobsExpired: outcome.expired || 0,
        syncInProgress: false,
        syncLockToken: null
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

      // 3. Persist JobSourceConfiguration
      const config = await prisma.jobSourceConfiguration.create({
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
            detectedType: discovery.detectedType
          },
          lastDiscoveryAt: new Date(),
          healthStatus: SourceHealth.HEALTHY
        }
      });

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
      const discovery: DiscoveryResult = {
        detectedType: config.sourceType as any,
        sourceUrl: config.sourceUrl,
        jobsEndpoint: config.jobsEndpoint || config.sourceUrl,
        companyName: config.company.name,
        officialDomain: config.company.officialDomain || '',
        jobCount: config.jobsFound,
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
