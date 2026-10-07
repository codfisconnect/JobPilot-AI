export interface EmployerOrganization {
  id: string;
  name: string;
  slug: string;
  domain?: string | null;
  companyId?: string | null;
  verificationStatus: 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED';
  website?: string | null;
  logoUrl?: string | null;
  industry?: string | null;
  description?: string | null;
  headquarters?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EmployerMember {
  id: string;
  organizationId: string;
  userId: string;
  role: 'OWNER' | 'ADMIN' | 'RECRUITER' | 'HIRING_MANAGER';
  title?: string | null;
  joinedAt: string;
}

export interface EmployerDashboardMetrics {
  jobs: {
    total: number;
    active: number;
    draft: number;
    closed: number;
  };
  applicants: {
    total: number;
    new: number;
  };
}

export interface EmployerJob {
  id: string;
  title: string;
  description: string;
  requirements: string[];
  responsibilities: string[];
  preferredQualifications: string[];
  location?: string | null;
  country?: string | null;
  city?: string | null;
  remoteType: 'REMOTE' | 'HYBRID' | 'ON_SITE' | 'UNKNOWN';
  employmentType: 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'TEMPORARY' | 'INTERNSHIP' | 'OTHER';
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryCurrency?: string | null;
  experienceMin?: number | null;
  experienceMax?: number | null;
  status: string;
  organizationJobStatus: 'DRAFT' | 'PUBLISHED' | 'PAUSED' | 'CLOSED';
  applicantCount?: number;
  postedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EmployerApplicant {
  id: string;
  status: string;
  appliedAt: string | null;
  createdAt: string;
  candidateProfile: {
    id: string;
    fullName: string;
    headline?: string | null;
    location?: string | null;
    email?: string | null;
  };
  resumeVersion?: {
    id: string;
    versionName: string;
    summary?: string | null;
    pdfPath?: string | null;
    structuredContent?: any;
  } | null;
  reviews?: Array<{
    id: string;
    stage: 'NEW' | 'SCREENING' | 'INTERVIEW' | 'OFFER' | 'HIRED' | 'REJECTED' | 'ARCHIVED';
    rating?: number | null;
    notes?: string | null;
    createdAt: string;
  }>;
}
