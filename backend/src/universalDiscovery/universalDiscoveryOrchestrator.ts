import { safeFetchUrl } from '../utils/safeFetch.js';
import { UrlNormalizationService } from './urlNormalization.service.js';
import { SourceFingerprintService } from './sourceFingerprint.service.js';
import { AdapterRegistry } from './adapterRegistry.js';
import { StrategyContext, StrategyExecutionResult } from './strategy.interface.js';
import { JobDeduplicationService } from './jobDeduplication.service.js';
import { UniversalDiscoveryResult } from './types.js';
import { logger } from '../utils/logger.js';

export class UniversalDiscoveryOrchestrator {
  /**
   * Universal Discovery Pipeline:
   * 1. URL normalization (dissect params, hashes, detect vendor hints)
   * 2. SSRF check + Initial Fetch
   * 3. Fingerprinting (ATS vendors, SPAs, embedded data, iframes)
   * 4. Sequential strategy evaluation in priority order
   * 5. Deduplication & Completeness reconciliation
   * 6. Universal model construction
   */
  public static async discover(rawUrl: string): Promise<UniversalDiscoveryResult> {
    const startTime = Date.now();
    logger.info(`[UniversalDiscoveryOrchestrator] Starting discovery for: ${UrlNormalizationService.sanitizeUrlForLog(rawUrl)}`);

    // 1. URL normalization
    const normalized = UrlNormalizationService.normalize(rawUrl);

    // 2. Fetch initial page safely with SSRF protection
    let initialHtml = '';
    let initialHeaders: Record<string, string> = {};
    let finalUrl = normalized.normalizedUrl;

    try {
      const initialRes = await safeFetchUrl(normalized.normalizedUrl, { timeoutMs: 12000 });
      initialHtml = initialRes.text;
      initialHeaders = initialRes.headers;
      finalUrl = initialRes.finalUrl;
    } catch (fetchErr: any) {
      logger.warn(`[UniversalDiscoveryOrchestrator] Initial fetch error: ${fetchErr.message}`);
    }

    // 3. Source fingerprinting
    const fingerprint = SourceFingerprintService.fingerprint(normalized, initialHtml);
    logger.info(`[UniversalDiscoveryOrchestrator] Fingerprint signals: ${fingerprint.signals.join(', ') || 'None'}`);

    const context: StrategyContext = {
      normalizedUrl: normalized,
      fingerprint,
      initialHtml,
      initialResponseHeaders: initialHeaders
    };

    // 4. Evaluate registered strategies in priority order
    const strategies = AdapterRegistry.getAllStrategies();
    let bestResult: StrategyExecutionResult | null = null;

    for (const strat of strategies) {
      try {
        const canHandle = await strat.canHandle(context);
        if (!canHandle) continue;

        logger.info(`[UniversalDiscoveryOrchestrator] Executing strategy: ${strat.name} (Priority: ${strat.priority})`);
        const result = await strat.execute(context);
        if (result && result.matched) {
          if (result.jobs.length > 0) {
            logger.info(`[UniversalDiscoveryOrchestrator] Strategy ${strat.name} succeeded with ${result.jobs.length} jobs`);
            bestResult = result;
            break; // Stop at first strategy that discovered jobs
          } else if (!bestResult) {
            // Keep as fallback candidate if no other strategy discovers jobs
            bestResult = result;
          }
        }
      } catch (stratErr: any) {
        logger.warn(`[UniversalDiscoveryOrchestrator] Strategy ${strat.name} encountered error: ${stratErr.message}`);
      }
    }

    if (!bestResult) {
      // Diagnostic message based on fingerprint and content presence
      if (fingerprint.atsVendor) {
        throw new Error(`${fingerprint.atsVendor} careers portal detected, but its public job data endpoint could not be resolved.`);
      }
      if (fingerprint.isSinglePageApp) {
        throw new Error('Jobs are rendered dynamically, but public network discovery did not expose a readable job source.');
      }
      if (initialHtml && initialHtml.length > 500) {
        throw new Error('Page content detected, but no reliable job records or application links could be identified.');
      }
      throw new Error('No public job source was discoverable from this page.');
    }

    // 5. Deduplication
    const deduplicatedJobs = JobDeduplicationService.deduplicate(bestResult.jobs, bestResult.companyName);

    const durationMs = Date.now() - startTime;

    const normalizedJobs = deduplicatedJobs.map(j => ({
      ...j,
      url: j.url || j.applicationUrl
    }));

    return {
      detectedType: bestResult.sourceType,
      sourceType: bestResult.sourceType,
      atsType: bestResult.atsType,
      strategy: bestResult.strategyName,
      sourceUrl: normalized.canonicalSourceUrl,
      jobsEndpoint: bestResult.jobsEndpoint,
      httpMethod: bestResult.httpMethod,
      companyName: bestResult.companyName,
      officialDomain: bestResult.officialDomain,
      expectedJobCount: bestResult.expectedJobCount,
      discoveredJobCount: normalizedJobs.length,
      completeness: bestResult.completeness,
      paginationSupported: bestResult.paginationSupported,
      paginationConfig: bestResult.paginationConfig,
      mappingConfig: bestResult.mappingConfig,
      sampleJobs: normalizedJobs.slice(0, 3),
      allDiscoveredJobs: normalizedJobs,
      durationMs,
      rawRecords: bestResult.paginationConfig?.rawRecords || bestResult.jobs.length,
      uniqueRecords: normalizedJobs.length,
      duplicatesRemoved: (bestResult.paginationConfig?.duplicatesRemoved || 0) + (bestResult.jobs.length - normalizedJobs.length),
      pagesFetched: bestResult.paginationConfig?.pagesFetched || 1,
      pagesFailed: bestResult.paginationConfig?.pagesFailed || 0,
      lastPageReached: bestResult.paginationConfig?.lastPageReached ?? (bestResult.expectedJobCount !== null ? normalizedJobs.length >= bestResult.expectedJobCount : false),
      warnings: bestResult.paginationConfig?.warnings || []
    };
  }
}
