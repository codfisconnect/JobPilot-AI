import { IJobSourceConnector, IConnectorJobRaw, ConnectorFetchOptions, ConnectorCapabilities } from './jobSourceConnector.interface.js';
import { AshbySource } from '../ashby/ashbySource.js';
import { logger } from '../../utils/logger.js';

export class AshbyConnector implements IJobSourceConnector {
  public readonly sourceType = 'ASHBY';
  public readonly sourceName = 'Ashby';
  public readonly defaultBaseUrl = 'https://api.ashbyhq.com/posting-api/job-board';
  public readonly capabilities: ConnectorCapabilities = {
    supportsPagination: false,
    supportsRemoteFilter: false,
    requiresBoardIdentifier: true,
    rateLimitPerMinute: 60
  };

  private prototypeSource: AshbySource;

  constructor() {
    this.prototypeSource = new AshbySource();
  }

  public async discover(options?: ConnectorFetchOptions): Promise<IConnectorJobRaw[]> {
    return this.fetchJobs(options);
  }

  public async fetchJobs(options?: ConnectorFetchOptions): Promise<IConnectorJobRaw[]> {
    const org = options?.boardIdentifier || 'ashbydemo';
    logger.info(`[AshbyConnector] Fetching jobs for org: ${org}`);

    const rawJobs = await this.prototypeSource.fetchJobs(org);

    const results: IConnectorJobRaw[] = rawJobs.map(raw => ({
      externalJobId: raw.externalId,
      sourceType: this.sourceType,
      sourceName: this.sourceName,
      sourceUrl: raw.sourceUrl,
      applicationUrl: raw.applicationUrl || raw.sourceUrl,
      title: raw.title,
      companyName: raw.company || org,
      companyDomain: `${org}.com`,
      careersUrl: `https://jobs.ashbyhq.com/${org}`,
      location: raw.location,
      remoteType: raw.workMode?.toUpperCase().includes('REMOTE')
        ? 'REMOTE'
        : raw.workMode?.toUpperCase().includes('HYBRID')
        ? 'HYBRID'
        : 'ON_SITE',
      employmentType: 'FULL_TIME',
      experienceMin: raw.experience?.includes('3') ? 3 : undefined,
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

  public async healthCheck(identifier = 'ashbydemo'): Promise<{ healthy: boolean; latencyMs: number; error?: string }> {
    const start = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(`${this.defaultBaseUrl}/${identifier}`, {
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
