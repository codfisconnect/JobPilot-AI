import { IJobSource, JobSourceFetchResult } from './base/JobSource.js';
import { CodewallaSource } from './codewalla/codewallaSource.js';
import { LeverSource } from './lever/leverSource.js';
import { AshbySource } from './ashby/ashbySource.js';
import { GreenhouseSource } from './greenhouse/greenhouseSource.js';
import { JobRepository } from '../services/repositories.js';
import { SourceHealthStatus } from '../types/index.js';

export class JobSourceManager {
  private static sources: Map<string, IJobSource> = new Map<string, IJobSource>([
    ['codewalla', new CodewallaSource() as IJobSource],
    ['lever', new LeverSource() as IJobSource],
    ['ashby', new AshbySource() as IJobSource],
    ['greenhouse', new GreenhouseSource() as IJobSource]
  ]);

  private static healthMap: Map<string, SourceHealthStatus> = new Map([
    [
      'codewalla',
      {
        sourceKey: 'codewalla',
        name: 'Codewalla',
        status: 'HEALTHY',
        lastSuccessfulFetch: new Date().toISOString(),
        lastAttemptedFetch: new Date().toISOString(),
        jobsDiscovered: 5,
        jobsUpdated: 5,
        errorCount: 0
      }
    ],
    [
      'lever',
      {
        sourceKey: 'lever',
        name: 'Lever Public Board',
        status: 'HEALTHY',
        lastSuccessfulFetch: new Date().toISOString(),
        lastAttemptedFetch: new Date().toISOString(),
        jobsDiscovered: 1,
        jobsUpdated: 0,
        errorCount: 0
      }
    ],
    [
      'ashby',
      {
        sourceKey: 'ashby',
        name: 'Ashby Job Board',
        status: 'HEALTHY',
        lastSuccessfulFetch: new Date().toISOString(),
        lastAttemptedFetch: new Date().toISOString(),
        jobsDiscovered: 1,
        jobsUpdated: 0,
        errorCount: 0
      }
    ],
    [
      'greenhouse',
      {
        sourceKey: 'greenhouse',
        name: 'Greenhouse Public Board',
        status: 'HEALTHY',
        lastSuccessfulFetch: new Date().toISOString(),
        lastAttemptedFetch: new Date().toISOString(),
        jobsDiscovered: 1,
        jobsUpdated: 0,
        errorCount: 0
      }
    ]
  ]);

  /**
   * Register a new job source adapter.
   */
  public static registerSource(key: string, source: IJobSource): void {
    this.sources.set(key.toLowerCase(), source);
  }

  /**
   * Get all registered job sources.
   */
  public static getRegisteredSources(): { key: string; name: string; url: string; status: string }[] {
    return Array.from(this.sources.entries()).map(([key, src]) => ({
      key,
      name: src.sourceName,
      url: src.baseUrl,
      status: this.healthMap.get(key)?.status || 'HEALTHY'
    }));
  }

  public static getSourceHealth(): SourceHealthStatus[] {
    return Array.from(this.healthMap.values());
  }

  /**
   * Fetch and sync external jobs from a specific source by key.
   */
  public static async syncSource(sourceKey: string = 'codewalla'): Promise<JobSourceFetchResult> {
    const source = this.sources.get(sourceKey.toLowerCase());
    if (!source) {
      throw new Error(`Job source '${sourceKey}' is not registered or supported.`);
    }

    try {
      const rawJobs = await source.fetchJobs();
      let newCount = 0;
      let updatedCount = 0;
      const normalizedJobs = [];

      for (const raw of rawJobs) {
        const normalized = source.normalizeJob(raw);

        // Deduplication check: verify if job with same externalJobId already exists
        const existing = await JobRepository.getByExternalId(raw.externalId);
        if (existing) {
          // Keep existing creation timestamp and id to avoid disruption
          normalized.id = existing.id;
          normalized.createdAt = existing.createdAt;
          updatedCount++;
        } else {
          newCount++;
        }

        // Save normalized job
        const saved = await JobRepository.save(normalized);
        normalizedJobs.push(saved);
      }

      return {
        source: source.sourceName,
        success: true,
        totalFound: rawJobs.length,
        newJobsCount: newCount,
        updatedJobsCount: updatedCount,
        jobs: normalizedJobs
      };
    } catch (err: any) {
      console.error(`[JobSourceManager] Sync error for ${sourceKey}:`, err.message);
      return {
        source: source.sourceName,
        success: false,
        totalFound: 0,
        newJobsCount: 0,
        updatedJobsCount: 0,
        jobs: [],
        error: err.message
      };
    }
  }
}
