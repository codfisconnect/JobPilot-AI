import { ConnectorRegistry } from '../jobSources/v1/connectorRegistry.js';
import { IJobSourceConnector, ConnectorFetchOptions } from '../jobSources/v1/jobSourceConnector.interface.js';
import { JobNormalizationService } from './jobNormalization.service.js';
import { CompanyRepository } from '../repositories/company.repository.js';
import { JobRepositoryV1 } from '../repositories/job.repository.js';
import { logger } from '../utils/logger.js';

export interface IngestionMetrics {
  sourceType: string;
  sourceName: string;
  startedAt: string;
  durationMs: number;
  jobsDiscovered: number;
  jobsCreated: number;
  jobsUpdated: number;
  jobsSkipped: number;
  success: boolean;
  error?: string;
}

export class JobIngestionService {
  /**
   * Run ingestion for a specific connector by sourceType.
   * Isolates failures so one failing connector does not crash other jobs or sources.
   */
  public static async ingestSource(
    sourceType: string,
    options?: ConnectorFetchOptions
  ): Promise<IngestionMetrics> {
    const start = Date.now();
    const connector = ConnectorRegistry.get(sourceType);

    if (!connector) {
      return {
        sourceType,
        sourceName: sourceType,
        startedAt: new Date(start).toISOString(),
        durationMs: 0,
        jobsDiscovered: 0,
        jobsCreated: 0,
        jobsUpdated: 0,
        jobsSkipped: 0,
        success: false,
        error: `Unknown connector source type: ${sourceType}`
      };
    }

    const metrics: IngestionMetrics = {
      sourceType: connector.sourceType,
      sourceName: connector.sourceName,
      startedAt: new Date(start).toISOString(),
      durationMs: 0,
      jobsDiscovered: 0,
      jobsCreated: 0,
      jobsUpdated: 0,
      jobsSkipped: 0,
      success: false
    };

    try {
      logger.info(`[JobIngestionService] Starting ingestion for source: ${connector.sourceName}`);
      const rawJobs = await connector.fetchJobs(options);
      metrics.jobsDiscovered = rawJobs.length;

      for (const raw of rawJobs) {
        try {
          // 1. Resolve or create Canonical Company
          const company = await CompanyRepository.resolveOrCreate({
            name: raw.companyName,
            officialDomain: raw.companyDomain,
            careersUrl: raw.careersUrl,
            sourceType: connector.sourceType
          });

          // 2. Register / Update Company Source
          const sourceRecord = await CompanyRepository.registerSource({
            companyId: company.id,
            sourceType: connector.sourceType,
            sourceName: connector.sourceName,
            sourceUrl: raw.careersUrl || raw.sourceUrl,
            externalIdentifier: options?.boardIdentifier || raw.externalJobId
          });

          // 3. Normalize incoming job
          const normalized = JobNormalizationService.normalize(raw);

          // 4. Upsert Job into PostgreSQL
          const { isNew } = await JobRepositoryV1.upsertNormalizedJob(company.id, normalized);
          if (isNew) {
            metrics.jobsCreated++;
          } else {
            metrics.jobsUpdated++;
          }

          // Mark source healthy
          await CompanyRepository.updateSourceHealth(sourceRecord.id, true);
        } catch (itemErr: any) {
          metrics.jobsSkipped++;
          logger.warn(`[JobIngestionService] Skipped job item due to normalization error:`, {
            error: itemErr.message,
            title: raw.title
          });
        }
      }

      metrics.success = true;
      metrics.durationMs = Date.now() - start;
      logger.info(`[JobIngestionService] Completed ingestion for ${connector.sourceName}`, {
        discovered: metrics.jobsDiscovered,
        created: metrics.jobsCreated,
        updated: metrics.jobsUpdated,
        durationMs: metrics.durationMs
      });
      return metrics;
    } catch (err: any) {
      metrics.success = false;
      metrics.durationMs = Date.now() - start;
      metrics.error = err.message;
      logger.error(`[JobIngestionService] Ingestion failed for source ${connector.sourceName}:`, {
        error: err.message
      });
      return metrics;
    }
  }

  /**
   * Run ingestion across all registered connectors with failure isolation.
   */
  public static async ingestAll(options?: ConnectorFetchOptions): Promise<IngestionMetrics[]> {
    const connectors = ConnectorRegistry.getAll();
    const results: IngestionMetrics[] = [];

    for (const connector of connectors) {
      try {
        const result = await this.ingestSource(connector.sourceType, options);
        results.push(result);
      } catch (err: any) {
        // Absolute isolation
        results.push({
          sourceType: connector.sourceType,
          sourceName: connector.sourceName,
          startedAt: new Date().toISOString(),
          durationMs: 0,
          jobsDiscovered: 0,
          jobsCreated: 0,
          jobsUpdated: 0,
          jobsSkipped: 0,
          success: false,
          error: err.message
        });
      }
    }

    return results;
  }
}
