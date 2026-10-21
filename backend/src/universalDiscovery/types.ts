export type CompletenessStatus = 'COMPLETE' | 'PARTIAL' | 'UNKNOWN' | 'FAILED';

export interface DiscoveredJobRaw {
  externalJobId?: string;
  title: string;
  department?: string;
  location?: string;
  country?: string;
  city?: string;
  stateProvince?: string;
  workMode?: string;
  employmentType?: string;
  experience?: string;
  salary?: string;
  qualification?: string;
  summary?: string;
  description: string;
  responsibilities?: string[];
  requirements?: string[];
  skills?: string[];
  preferredSkills?: string[];
  openingCount?: number;
  applicationUrl?: string;
  url?: string;
  postedAt?: string | Date;
  deadline?: string | Date;
  rawPayload?: any;
}

export interface UniversalDiscoveryResult {
  detectedType: string;
  sourceType: string;
  atsType?: string;
  strategy: string;
  sourceUrl: string;
  jobsEndpoint: string;
  httpMethod: 'GET' | 'POST';
  companyName: string;
  officialDomain: string;
  expectedJobCount: number | null;
  discoveredJobCount: number;
  completeness: CompletenessStatus;
  paginationSupported: boolean;
  paginationConfig?: any;
  mappingConfig: any;
  sampleJobs: DiscoveredJobRaw[];
  allDiscoveredJobs: DiscoveredJobRaw[];
  durationMs: number;
  rawRecords?: number;
  uniqueRecords?: number;
  duplicatesRemoved?: number;
  pagesFetched?: number;
  pagesFailed?: number;
  lastPageReached?: boolean;
  warnings?: string[];
}

export interface UniversalSyncOutcome {
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  expired?: number;
  discovered: number;
  expected: number | null;
  completeness: CompletenessStatus;
}
