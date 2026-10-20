import { prisma } from '../database/prisma.js';
import { logger } from '../utils/logger.js';
import { validateSafeUrl } from '../utils/safeFetch.js';
import { UrlNormalizationService } from '../universalDiscovery/urlNormalization.service.js';
import { JobSourceDiscoveryService } from './jobSourceDiscovery.service.js';
import { BulkImportStatus, BulkSourceItemStatus } from '@prisma/client';

export interface BulkValidationItem {
  rawUrl: string;
  normalizedUrl?: string;
  sourceIdentityUrl?: string;
  domain?: string;
  companyHint?: string;
  isValid: boolean;
  validationError?: string;
  isDuplicateInBatch: boolean;
  isAlreadyConnected: boolean;
  existingSourceId?: string;
  existingSourceName?: string;
}

export interface BulkValidationPreviewResult {
  totalInput: number;
  validCount: number;
  invalidCount: number;
  duplicateCount: number;
  alreadyConnectedCount: number;
  newSourcesCount: number;
  items: BulkValidationItem[];
}

export interface StartBulkImportInput {
  urls: string[];
  companyHints?: Record<string, string>;
  createdBy?: string;
  maxConcurrency?: number;
}

export class BulkJobSourceService {
  public static readonly DEFAULT_MAX_CONCURRENCY = 4;
  public static readonly MAX_URLS_PER_BATCH = 100;

  /**
   * Separates SOURCE_IDENTITY_URL (for deduplication / matching against existing configurations)
   * from DISCOVERY_NAVIGATION_URL (preserves SPA hash navigation e.g. #en/sites/CX_1/jobs and functional query parameters).
   */
  public static resolveUrlIdentities(rawUrl: string): {
    normalizedUrl: string;
    sourceIdentityUrl: string;
    domain: string;
    isValid: boolean;
    error?: string;
  } {
    const raw = (rawUrl || '').trim();
    if (!raw) {
      return { normalizedUrl: '', sourceIdentityUrl: '', domain: '', isValid: false, error: 'Empty URL provided.' };
    }

    try {
      if (!raw.startsWith('http://') && !raw.startsWith('https://')) {
        return {
          normalizedUrl: raw,
          sourceIdentityUrl: raw.toLowerCase(),
          domain: '',
          isValid: false,
          error: 'URL must start with http:// or https://'
        };
      }

      const normalized = UrlNormalizationService.normalize(raw);
      const urlObj = new URL(normalized.normalizedUrl);

      // Must have valid hostname with at least one dot unless localhost
      if (!urlObj.hostname || (!urlObj.hostname.includes('.') && urlObj.hostname !== 'localhost')) {
        return {
          normalizedUrl: raw,
          sourceIdentityUrl: raw.toLowerCase(),
          domain: '',
          isValid: false,
          error: 'Invalid hostname format'
        };
      }

      // SOURCE_IDENTITY_URL: origin + pathname normalized without trailing slashes, ignoring tracking query params
      // but keeping essential tenant identifier (like ?company=mavericsys in SuccessFactors)
      const identityObj = new URL(urlObj.origin + urlObj.pathname);
      if (identityObj.pathname.length > 1 && identityObj.pathname.endsWith('/')) {
        identityObj.pathname = identityObj.pathname.slice(0, -1);
      }

      // Preserve tenant-identifying query params in source identity if present
      const companyParam = urlObj.searchParams.get('company') || urlObj.searchParams.get('career_company');
      if (companyParam) {
        identityObj.searchParams.set('company', companyParam);
      }
      const siteParam = urlObj.searchParams.get('siteNumber') || urlObj.searchParams.get('site');
      if (siteParam) {
        identityObj.searchParams.set('siteNumber', siteParam);
      }

      const sourceIdentityUrl = identityObj.toString().toLowerCase();

      return {
        normalizedUrl: normalized.normalizedUrl,
        sourceIdentityUrl,
        domain: normalized.domain,
        isValid: true
      };
    } catch (err: any) {
      return {
        normalizedUrl: raw,
        sourceIdentityUrl: raw.toLowerCase(),
        domain: '',
        isValid: false,
        error: err.message || 'Invalid URL'
      };
    }
  }

  /**
   * Pre-validates a batch of URLs against formatting, SSRF rules, intra-batch duplicates, and existing database sources.
   */
  public static async validateBatchPreview(
    rawUrls: string[],
    companyHints?: Record<string, string>
  ): Promise<BulkValidationPreviewResult> {
    const cleanedList = (rawUrls || [])
      .map(u => (typeof u === 'string' ? u.trim() : ''))
      .filter(u => u.length > 0);

    const items: BulkValidationItem[] = [];
    const seenIdentities = new Set<string>();

    // Load existing active source configurations to match against
    const existingConfigs = await prisma.jobSourceConfiguration.findMany({
      select: {
        id: true,
        sourceUrl: true,
        jobsEndpoint: true,
        company: { select: { name: true } }
      }
    });

    const existingMap = new Map<string, { id: string; name: string }>();
    for (const conf of existingConfigs) {
      try {
        const iden = this.resolveUrlIdentities(conf.sourceUrl).sourceIdentityUrl;
        existingMap.set(iden, { id: conf.id, name: conf.company?.name || 'Connected Source' });
        if (conf.jobsEndpoint) {
          const endpointIden = this.resolveUrlIdentities(conf.jobsEndpoint).sourceIdentityUrl;
          existingMap.set(endpointIden, { id: conf.id, name: conf.company?.name || 'Connected Source' });
        }
      } catch {}
    }

    let validCount = 0;
    let invalidCount = 0;
    let duplicateCount = 0;
    let alreadyConnectedCount = 0;
    let newSourcesCount = 0;

    for (const raw of cleanedList) {
      const hint = companyHints ? companyHints[raw] : undefined;
      const { normalizedUrl, sourceIdentityUrl, domain, isValid, error } = this.resolveUrlIdentities(raw);

      if (!isValid) {
        items.push({
          rawUrl: raw,
          companyHint: hint,
          isValid: false,
          validationError: error || 'Malformed URL format',
          isDuplicateInBatch: false,
          isAlreadyConnected: false
        });
        invalidCount++;
        continue;
      }

      // SSRF check
      const ssrfCheck = await validateSafeUrl(normalizedUrl);
      if (!ssrfCheck.safe) {
        items.push({
          rawUrl: raw,
          normalizedUrl,
          sourceIdentityUrl,
          domain,
          companyHint: hint,
          isValid: false,
          validationError: ssrfCheck.error || 'Blocked by SSRF security policy',
          isDuplicateInBatch: false,
          isAlreadyConnected: false
        });
        invalidCount++;
        continue;
      }

      // Intra-batch duplicate check
      if (seenIdentities.has(sourceIdentityUrl)) {
        items.push({
          rawUrl: raw,
          normalizedUrl,
          sourceIdentityUrl,
          domain,
          companyHint: hint,
          isValid: true,
          isDuplicateInBatch: true,
          isAlreadyConnected: false
        });
        duplicateCount++;
        continue;
      }

      seenIdentities.add(sourceIdentityUrl);

      // Existing connected source check
      const existing = existingMap.get(sourceIdentityUrl);
      if (existing) {
        items.push({
          rawUrl: raw,
          normalizedUrl,
          sourceIdentityUrl,
          domain,
          companyHint: hint,
          isValid: true,
          isDuplicateInBatch: false,
          isAlreadyConnected: true,
          existingSourceId: existing.id,
          existingSourceName: existing.name
        });
        alreadyConnectedCount++;
        continue;
      }

      // Valid new source
      items.push({
        rawUrl: raw,
        normalizedUrl,
        sourceIdentityUrl,
        domain,
        companyHint: hint,
        isValid: true,
        isDuplicateInBatch: false,
        isAlreadyConnected: false
      });
      validCount++;
      newSourcesCount++;
    }

    return {
      totalInput: cleanedList.length,
      validCount,
      invalidCount,
      duplicateCount,
      alreadyConnectedCount,
      newSourcesCount,
      items
    };
  }

  /**
   * Initializes a BulkSourceImport record and associated BulkSourceItem records,
   * then launches background asynchronous bounded processing.
   */
  public static async createAndStartBulkImport(input: StartBulkImportInput): Promise<{
    bulkJobId: string;
    total: number;
    accepted: number;
    rejected: number;
    duplicates: number;
    alreadyConnected: number;
  }> {
    const preview = await this.validateBatchPreview(input.urls, input.companyHints);

    // Limit check
    if (preview.totalInput > this.MAX_URLS_PER_BATCH) {
      throw new Error(`Maximum ${this.MAX_URLS_PER_BATCH} sources per batch allowed.`);
    }

    // Create BulkSourceImport
    const bulkImport = await prisma.bulkSourceImport.create({
      data: {
        createdBy: input.createdBy || null,
        status: BulkImportStatus.QUEUED,
        totalSources: preview.totalInput,
        queuedSources: preview.validCount,
        runningSources: 0,
        completedSources: 0,
        partialSources: 0,
        failedSources: preview.invalidCount,
        alreadyConnectedSources: preview.alreadyConnectedCount,
        skippedSources: preview.duplicateCount
      }
    });

    // Populate BulkSourceItem rows
    for (const item of preview.items) {
      let initialStatus: BulkSourceItemStatus = BulkSourceItemStatus.QUEUED;
      let errorCode: string | null = null;
      let errorMessage: string | null = null;

      if (!item.isValid) {
        initialStatus = BulkSourceItemStatus.FAILED;
        errorCode = 'INVALID_URL';
        errorMessage = item.validationError || 'Invalid or unsafe URL.';
      } else if (item.isDuplicateInBatch) {
        initialStatus = BulkSourceItemStatus.SKIPPED;
        errorCode = 'DUPLICATE_SOURCE';
        errorMessage = 'Duplicate source in bulk input batch.';
      } else if (item.isAlreadyConnected) {
        initialStatus = BulkSourceItemStatus.ALREADY_CONNECTED;
        errorCode = 'ALREADY_CONNECTED';
        errorMessage = `Already connected as ${item.existingSourceName || 'an existing source'}.`;
      }

      await prisma.bulkSourceItem.create({
        data: {
          bulkJobId: bulkImport.id,
          sourceUrl: item.rawUrl,
          normalizedUrl: item.normalizedUrl || null,
          companyHint: item.companyHint || null,
          status: initialStatus,
          sourceConfigurationId: item.existingSourceId || null,
          errorCode,
          errorMessage,
          completedAt: initialStatus !== BulkSourceItemStatus.QUEUED ? new Date() : null
        }
      });
    }

    // Launch background worker without awaiting it
    const concurrency = Math.max(1, Math.min(input.maxConcurrency || this.DEFAULT_MAX_CONCURRENCY, 8));
    setImmediate(() => {
      this.processBulkImportWorker(bulkImport.id, concurrency).catch(err => {
        logger.error(`[BulkJobSourceService] Uncaught error in bulk worker for ${bulkImport.id}: ${err.message}`);
      });
    });

    return {
      bulkJobId: bulkImport.id,
      total: preview.totalInput,
      accepted: preview.validCount,
      rejected: preview.invalidCount,
      duplicates: preview.duplicateCount,
      alreadyConnected: preview.alreadyConnectedCount
    };
  }

  /**
   * Bounded concurrency worker processing queued BulkSourceItems.
   * Ensures failure isolation: one failing source never crashes or halts other sources.
   */
  public static async processBulkImportWorker(bulkJobId: string, maxConcurrency: number): Promise<void> {
    logger.info(`[BulkJobSourceService] Starting bulk import worker for job: ${bulkJobId} with concurrency: ${maxConcurrency}`);

    await prisma.bulkSourceImport.update({
      where: { id: bulkJobId },
      data: { status: BulkImportStatus.RUNNING }
    });

    const queuedItems = await prisma.bulkSourceItem.findMany({
      where: {
        bulkJobId,
        status: BulkSourceItemStatus.QUEUED
      },
      orderBy: { createdAt: 'asc' }
    });

    if (queuedItems.length === 0) {
      await this.recalculateAndUpdateAggregate(bulkJobId);
      return;
    }

    let currentIndex = 0;
    const executeNext = async (): Promise<void> => {
      while (currentIndex < queuedItems.length) {
        // Check for job cancellation
        const currentJob = await prisma.bulkSourceImport.findUnique({
          where: { id: bulkJobId },
          select: { status: true }
        });

        if (currentJob?.status === BulkImportStatus.CANCELLED) {
          logger.info(`[BulkJobSourceService] Bulk job ${bulkJobId} was cancelled by admin.`);
          return;
        }

        const item = queuedItems[currentIndex++];
        if (!item) break;

        await this.processSingleSourceItem(item.id);
        await this.recalculateAndUpdateAggregate(bulkJobId);
      }
    };

    const workerPromises: Promise<void>[] = [];
    const poolSize = Math.min(maxConcurrency, queuedItems.length);
    for (let i = 0; i < poolSize; i++) {
      workerPromises.push(executeNext());
    }

    await Promise.allSettled(workerPromises);
    await this.recalculateAndUpdateAggregate(bulkJobId);
    logger.info(`[BulkJobSourceService] Finished bulk import worker for job: ${bulkJobId}`);
  }

  /**
   * Processes a single source item through universal discovery and onboarding.
   */
  public static async processSingleSourceItem(itemId: string): Promise<void> {
    const startTime = new Date();
    // Atomic claiming: ensure we only claim if status is QUEUED
    const updateResult = await prisma.bulkSourceItem.updateMany({
      where: {
        id: itemId,
        status: BulkSourceItemStatus.QUEUED
      },
      data: {
        status: BulkSourceItemStatus.DISCOVERING,
        startedAt: startTime,
        errorMessage: null,
        errorCode: null
      }
    });

    if (updateResult.count === 0) {
      // Already claimed or cancelled
      return;
    }

    const item = await prisma.bulkSourceItem.findUnique({
      where: { id: itemId }
    });

    if (!item) return;

    try {
      // Execute standard universal discovery & onboarding
      const targetUrl = item.normalizedUrl || item.sourceUrl;
      const result = await JobSourceDiscoveryService.discoverAndOnboard(targetUrl);

      if (!result.success) {
        await prisma.bulkSourceItem.update({
          where: { id: itemId },
          data: {
            status: BulkSourceItemStatus.FAILED,
            errorCode: 'DISCOVERY_FAILED',
            errorMessage: result.error || 'Unable to discover a public job source from this URL.',
            completedAt: new Date()
          }
        });
        return;
      }

      // Determine completeness
      const isPartial =
        result.discovery.completeness === 'PARTIAL' ||
        (result.discovery.expectedJobCount != null && result.discovery.jobCount < result.discovery.expectedJobCount);

      const resolvedCompleteness = isPartial
        ? 'PARTIAL'
        : result.discovery.completeness || (result.discovery.expectedJobCount != null ? 'COMPLETE' : 'UNKNOWN');

      const finalStatus = isPartial ? BulkSourceItemStatus.PARTIAL : BulkSourceItemStatus.COMPLETED;

      await prisma.bulkSourceItem.update({
        where: { id: itemId },
        data: {
          status: finalStatus,
          companyName: result.companyName,
          sourceConfigurationId: result.sourceConfigurationId,
          discoveryStrategy: result.discovery.strategy || result.discovery.detectedType,
          sourceType: result.discovery.sourceType || result.discovery.detectedType,
          jobsDiscovered: result.discovery.jobCount,
          jobsCreated: result.sync.created,
          jobsUpdated: result.sync.updated,
          jobsExpired: result.sync.expired || 0,
          sourceTotal: result.discovery.expectedJobCount ?? null,
          pagesFetched: (result.discovery as any).pagesFetched || 1,
          completeness: resolvedCompleteness,
          healthStatus: isPartial ? 'DEGRADED' : 'HEALTHY',
          completedAt: new Date()
        }
      });
    } catch (err: any) {
      logger.error(`[BulkJobSourceService] Source item ${itemId} failed: ${err.message}`);
      await prisma.bulkSourceItem.update({
        where: { id: itemId },
        data: {
          status: BulkSourceItemStatus.FAILED,
          errorCode: 'UNHANDLED_EXCEPTION',
          errorMessage: err.message ? String(err.message) : 'An unexpected error occurred during discovery.',
          completedAt: new Date()
        }
      });
    }
  }

  /**
   * Recalculates aggregate counts and statuses on BulkSourceImport.
   */
  public static async recalculateAndUpdateAggregate(bulkJobId: string): Promise<void> {
    const items = await prisma.bulkSourceItem.findMany({
      where: { bulkJobId }
    });

    let queuedCount = 0;
    let runningCount = 0;
    let completedCount = 0;
    let partialCount = 0;
    let failedCount = 0;
    let alreadyConnectedCount = 0;
    let skippedCount = 0;
    let totalJobsDiscovered = 0;
    let totalJobsCreated = 0;
    let totalJobsUpdated = 0;

    for (const item of items) {
      if (item.status === BulkSourceItemStatus.QUEUED) queuedCount++;
      else if (
        item.status === BulkSourceItemStatus.VALIDATING ||
        item.status === BulkSourceItemStatus.DISCOVERING ||
        item.status === BulkSourceItemStatus.PAGINATING ||
        item.status === BulkSourceItemStatus.NORMALIZING ||
        item.status === BulkSourceItemStatus.PERSISTING
      ) {
        runningCount++;
      } else if (item.status === BulkSourceItemStatus.COMPLETED) {
        completedCount++;
      } else if (item.status === BulkSourceItemStatus.PARTIAL) {
        partialCount++;
      } else if (item.status === BulkSourceItemStatus.FAILED) {
        failedCount++;
      } else if (item.status === BulkSourceItemStatus.ALREADY_CONNECTED) {
        alreadyConnectedCount++;
      } else if (item.status === BulkSourceItemStatus.SKIPPED || item.status === BulkSourceItemStatus.CANCELLED) {
        skippedCount++;
      }

      totalJobsDiscovered += item.jobsDiscovered || 0;
      totalJobsCreated += item.jobsCreated || 0;
      totalJobsUpdated += item.jobsUpdated || 0;
    }

    const isAllFinished = queuedCount === 0 && runningCount === 0;
    let overallStatus: BulkImportStatus = BulkImportStatus.RUNNING;

    if (isAllFinished) {
      if (failedCount === items.length && items.length > 0) {
        overallStatus = BulkImportStatus.FAILED;
      } else if (partialCount > 0 || failedCount > 0) {
        overallStatus = BulkImportStatus.PARTIAL;
      } else {
        overallStatus = BulkImportStatus.COMPLETED;
      }
    }

    await prisma.bulkSourceImport.update({
      where: { id: bulkJobId },
      data: {
        status: overallStatus,
        queuedSources: queuedCount,
        runningSources: runningCount,
        completedSources: completedCount,
        partialSources: partialCount,
        failedSources: failedCount,
        alreadyConnectedSources: alreadyConnectedCount,
        skippedSources: skippedCount,
        totalJobsDiscovered,
        totalJobsCreated,
        totalJobsUpdated,
        completedAt: isAllFinished ? new Date() : null
      }
    });
  }

  /**
   * Retries an individual source item without re-running the entire batch.
   */
  public static async retrySourceItem(itemId: string): Promise<void> {
    const item = await prisma.bulkSourceItem.findUnique({
      where: { id: itemId }
    });

    if (!item) {
      throw new Error(`Bulk source item ${itemId} not found.`);
    }

    await prisma.bulkSourceItem.update({
      where: { id: itemId },
      data: {
        status: BulkSourceItemStatus.QUEUED,
        errorMessage: null,
        errorCode: null
      }
    });

    setImmediate(async () => {
      await this.processSingleSourceItem(itemId);
      await this.recalculateAndUpdateAggregate(item.bulkJobId);
    });
  }

  /**
   * Cancels all pending / queued items for a bulk job.
   */
  public static async cancelBulkImport(bulkJobId: string): Promise<void> {
    await prisma.bulkSourceItem.updateMany({
      where: {
        bulkJobId,
        status: BulkSourceItemStatus.QUEUED
      },
      data: {
        status: BulkSourceItemStatus.CANCELLED,
        errorMessage: 'Cancelled by administrator.',
        completedAt: new Date()
      }
    });

    await prisma.bulkSourceImport.update({
      where: { id: bulkJobId },
      data: {
        status: BulkImportStatus.CANCELLED,
        completedAt: new Date()
      }
    });

    await this.recalculateAndUpdateAggregate(bulkJobId);
  }
}
