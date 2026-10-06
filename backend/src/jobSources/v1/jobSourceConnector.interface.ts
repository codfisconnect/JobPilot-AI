export interface IConnectorJobRaw {
  externalJobId: string;
  sourceType: string; // CODEWALLA, GREENHOUSE, LEVER, ASHBY, DIRECT
  sourceName: string;
  sourceUrl: string;
  applicationUrl?: string;
  title: string;
  companyName: string;
  companyDomain?: string;
  careersUrl?: string;
  location?: string;
  country?: string;
  city?: string;
  stateProvince?: string;
  remoteType?: 'REMOTE' | 'HYBRID' | 'ON_SITE' | 'UNKNOWN';
  employmentType?: 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'TEMPORARY' | 'INTERNSHIP' | 'OTHER';
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  experienceMin?: number;
  experienceMax?: number;
  education?: string;
  postedAt?: Date | string;
  descriptionHtml?: string;
  descriptionText: string;
  responsibilities?: string[];
  requirements?: string[];
  preferredQualifications?: string[];
  skills?: string[];
  rawPayload?: Record<string, any>;
}

export interface ConnectorFetchOptions {
  limit?: number;
  page?: number;
  boardIdentifier?: string; // e.g. 'cloudflare' for greenhouse, 'netflix' for lever, 'ashbydemo' for ashby
  timeoutMs?: number;
}

export interface ConnectorCapabilities {
  supportsPagination: boolean;
  supportsRemoteFilter: boolean;
  requiresBoardIdentifier: boolean;
  rateLimitPerMinute: number;
}

export interface IJobSourceConnector {
  readonly sourceType: string;
  readonly sourceName: string;
  readonly defaultBaseUrl: string;
  readonly capabilities: ConnectorCapabilities;

  discover(options?: ConnectorFetchOptions): Promise<IConnectorJobRaw[]>;
  fetchJobs(options?: ConnectorFetchOptions): Promise<IConnectorJobRaw[]>;
  healthCheck(identifier?: string): Promise<{ healthy: boolean; latencyMs: number; error?: string }>;
}
