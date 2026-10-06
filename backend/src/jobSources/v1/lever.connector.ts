import { IJobSourceConnector, IConnectorJobRaw, ConnectorFetchOptions, ConnectorCapabilities } from './jobSourceConnector.interface.js';
import { LeverSource } from '../lever/leverSource.js';
import { logger } from '../../utils/logger.js';

export class LeverConnector implements IJobSourceConnector {
  public readonly sourceType = 'LEVER';
  public readonly sourceName = 'Lever';
  public readonly defaultBaseUrl = 'https://api.lever.co/v0/postings';
  public readonly capabilities: ConnectorCapabilities = {
    supportsPagination: false,
    supportsRemoteFilter: false,
    requiresBoardIdentifier: true,
    rateLimitPerMinute: 60
  };

  private prototypeSource: LeverSource;

  constructor() {
    this.prototypeSource = new LeverSource();
  }

  public async discover(options?: ConnectorFetchOptions): Promise<IConnectorJobRaw[]> {
    return this.fetchJobs(options);
  }

  public async fetchJobs(options?: ConnectorFetchOptions): Promise<IConnectorJobRaw[]> {
    const companySlug = options?.boardIdentifier || 'netflix';
    logger.info(`[LeverConnector] Fetching jobs for company slug: ${companySlug}`);

    const rawJobs = await this.prototypeSource.fetchJobs(companySlug);

    const results: IConnectorJobRaw[] = rawJobs.map(raw => ({
      externalJobId: raw.externalId,
      sourceType: this.sourceType,
      sourceName: this.sourceName,
      sourceUrl: raw.sourceUrl,
      applicationUrl: raw.applicationUrl || raw.sourceUrl,
      title: raw.title,
      companyName: raw.company || companySlug,
      companyDomain: `${companySlug}.com`,
      careersUrl: `https://jobs.lever.co/${companySlug}`,
      location: raw.location,
      remoteType: raw.workMode?.toUpperCase().includes('REMOTE')
        ? 'REMOTE'
        : raw.workMode?.toUpperCase().includes('HYBRID')
        ? 'HYBRID'
        : 'ON_SITE',
      employmentType: 'FULL_TIME',
      experienceMin: raw.experience?.includes('4') ? 4 : undefined,
      descriptionHtml: raw.descriptionHtml,
      descriptionText: raw.descriptionText || raw.rawText,
      responsibilities: raw.responsibilities || [],
      requirements: raw.qualifications || [],
      preferredQualifications: [],
      skills: raw.qualifications || []
    }));

    if (options?.limit && options.limit > 0) {
      return results.slice(0, options.limit);
    }
    return results;
  }

  public async healthCheck(identifier = 'netflix'): Promise<{ healthy: boolean; latencyMs: number; error?: string }> {
    const start = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(`${this.defaultBaseUrl}/${identifier}?mode=json`, {
        signal: controller.signal
      });
      clearTimeout(timeout);
      const latencyMs = Date.now() - start;
      return { healthy: res.ok, latencyMs };
    } catch (err: any) {
      return { healthy: false, latencyMs: Date.now() - start, error: err.message };
    }
  }
}
