import { JobDescription } from '../../types/index.js';

export interface ExternalJobRaw {
  externalId: string;
  source: string;
  sourceUrl: string;
  applicationUrl?: string;
  applicationMethod?: 'External Website' | 'Email' | 'LinkedIn' | 'Other';
  title: string;
  company: string;
  location?: string;
  experience?: string;
  employmentType?: string;
  workMode?: string;
  publishedDate?: string;
  descriptionHtml?: string;
  descriptionText: string;
  responsibilities: string[];
  qualifications: string[];
  rawText: string;
}

export interface JobSourceFetchResult {
  source: string;
  success: boolean;
  totalFound: number;
  newJobsCount: number;
  updatedJobsCount: number;
  jobs: JobDescription[];
  error?: string;
}

export interface IJobSource {
  readonly sourceName: string;
  readonly baseUrl: string;

  /**
   * Fetch and parse live jobs from the external source.
   */
  fetchJobs(): Promise<ExternalJobRaw[]>;

  /**
   * Normalize raw external job data into canonical JobDescription format.
   */
  normalizeJob(raw: ExternalJobRaw): JobDescription;
}
