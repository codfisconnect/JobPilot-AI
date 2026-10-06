export interface CanonicalCompany {
  id: string;
  name: string;
  officialDomain?: string;
  careersUrl?: string;
  industry?: string;
  country?: string;
  description?: string;
  logoUrl?: string;
}

export interface CanonicalJobSkill {
  id: string;
  name: string;
  category: string;
  type: 'REQUIRED' | 'PREFERRED';
}

export interface CanonicalJob {
  id: string;
  title: string;
  company: CanonicalCompany;
  description: string;
  responsibilities: string[];
  requirements: string[];
  preferredQualifications: string[];
  location?: string;
  country?: string;
  city?: string;
  stateProvince?: string;
  remoteType: 'REMOTE' | 'HYBRID' | 'ON_SITE' | 'UNKNOWN';
  employmentType: 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'TEMPORARY' | 'INTERNSHIP' | 'OTHER';
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryCurrency?: string;
  experienceMin?: number | null;
  experienceMax?: number | null;
  education?: string;
  postedAt?: string;
  firstSeenAt: string;
  lastSeenAt: string;
  status: 'ACTIVE' | 'EXPIRED' | 'CLOSED' | 'REMOVED';
  sourceType: string;
  sourceName: string;
  sourceUrl: string;
  applicationUrl?: string;
  skills: CanonicalJobSkill[];
}

export interface JobSearchParams {
  query?: string;
  title?: string;
  companyName?: string;
  skill?: string;
  location?: string;
  country?: string;
  city?: string;
  remoteType?: string;
  employmentType?: string;
  experienceMin?: number;
  experienceMax?: number;
  salaryMin?: number;
  salaryMax?: number;
  sourceType?: string;
  sortBy?: 'latest' | 'salary' | 'relevance';
  page?: number;
  pageSize?: number;
}

export interface JobSearchResponse {
  data: CanonicalJob[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}
