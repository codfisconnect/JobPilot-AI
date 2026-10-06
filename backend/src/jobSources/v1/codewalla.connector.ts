import { IJobSourceConnector, IConnectorJobRaw, ConnectorFetchOptions, ConnectorCapabilities } from './jobSourceConnector.interface.js';
import { CodewallaSource } from '../codewalla/codewallaSource.js';
import { logger } from '../../utils/logger.js';

export class CodewallaConnector implements IJobSourceConnector {
  public readonly sourceType = 'CODEWALLA';
  public readonly sourceName = 'Codewalla';
  public readonly defaultBaseUrl = 'https://www.codewalla.com/jobs';
  public readonly capabilities: ConnectorCapabilities = {
    supportsPagination: false,
    supportsRemoteFilter: false,
    requiresBoardIdentifier: false,
    rateLimitPerMinute: 30
  };

  private prototypeSource: CodewallaSource;

  constructor() {
    this.prototypeSource = new CodewallaSource();
  }

  public async discover(options?: ConnectorFetchOptions): Promise<IConnectorJobRaw[]> {
    return this.fetchJobs(options);
  }

  public async fetchJobs(options?: ConnectorFetchOptions): Promise<IConnectorJobRaw[]> {
    logger.info('[CodewallaConnector] Fetching jobs via Codewalla discovery connector');
    const rawJobs = await this.prototypeSource.fetchJobs();

    const results: IConnectorJobRaw[] = rawJobs.map(raw => {
      // Map external raw into IConnectorJobRaw
      return {
        externalJobId: raw.externalId,
        sourceType: this.sourceType,
        sourceName: this.sourceName,
        sourceUrl: raw.sourceUrl,
        applicationUrl: raw.applicationUrl || raw.sourceUrl,
        title: raw.title,
        companyName: raw.company || 'Codewalla',
        companyDomain: 'codewalla.com',
        careersUrl: this.defaultBaseUrl,
        location: raw.location,
        remoteType: raw.workMode?.toUpperCase().includes('REMOTE')
          ? 'REMOTE'
          : raw.workMode?.toUpperCase().includes('HYBRID')
          ? 'HYBRID'
          : 'ON_SITE',
        employmentType: 'FULL_TIME',
        experienceMin: raw.experience?.includes('4') ? 4 : raw.experience?.includes('3') ? 3 : undefined,
        experienceMax: raw.experience?.includes('7') ? 7 : raw.experience?.includes('6') ? 6 : undefined,
        education: undefined,
        postedAt: raw.publishedDate ? new Date(raw.publishedDate) : undefined,
        descriptionHtml: raw.descriptionHtml,
        descriptionText: raw.descriptionText || raw.rawText,
        responsibilities: raw.responsibilities || [],
        requirements: raw.qualifications || [],
        preferredQualifications: [],
        skills: raw.qualifications || []
      };
    });

    if (options?.limit && options.limit > 0) {
      return results.slice(0, options.limit);
    }
    return results;
  }

  public async healthCheck(): Promise<{ healthy: boolean; latencyMs: number; error?: string }> {
    const start = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(this.defaultBaseUrl, {
        method: 'HEAD',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) PilotMama/1.0'
        }
      });
      clearTimeout(timeout);
      const latencyMs = Date.now() - start;
      return { healthy: res.ok || res.status === 403 || res.status === 405, latencyMs };
    } catch (err: any) {
      return { healthy: false, latencyMs: Date.now() - start, error: err.message };
    }
  }
}
