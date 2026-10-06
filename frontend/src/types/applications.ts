export type ApplicationStatus =
  | 'SAVED'
  | 'READY_TO_APPLY'
  | 'APPLIED'
  | 'ASSESSMENT'
  | 'HR_SCREEN'
  | 'TECHNICAL'
  | 'FINAL_ROUND'
  | 'OFFER'
  | 'REJECTED'
  | 'WITHDRAWN';

export interface ApplicationCompany {
  id: string;
  name: string;
  officialDomain?: string | null;
  careersUrl?: string | null;
  logoUrl?: string | null;
  industry?: string | null;
  country?: string | null;
}

export interface ApplicationJob {
  id: string;
  title: string;
  description: string;
  location?: string | null;
  country?: string | null;
  city?: string | null;
  remoteType?: string | null;
  employmentType?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryCurrency?: string | null;
  applicationUrl?: string | null;
  sourceType?: string | null;
  company: ApplicationCompany;
}

export interface ApplicationResumeVersion {
  id: string;
  versionName: string;
  title?: string | null;
  summary?: string | null;
  atsScore?: number | null;
  pdfPath?: string | null;
  createdAt: string;
}

export interface ApplicationStatusHistoryItem {
  id: string;
  applicationId: string;
  previousStatus?: ApplicationStatus | null;
  newStatus: ApplicationStatus;
  reason?: string | null;
  changedAt: string;
}

export interface ApplicationNoteItem {
  id: string;
  applicationId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationReminderItem {
  id: string;
  applicationId: string;
  title: string;
  dueDate: string;
  isCompleted: boolean;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationItem {
  id: string;
  candidateProfileId: string;
  jobId: string;
  resumeVersionId?: string | null;
  status: ApplicationStatus;
  appliedAt?: string | null;
  externalUrl?: string | null;
  notesSummary?: string | null;
  customAnswers?: Record<string, any> | null;
  metadata?: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
  job: ApplicationJob;
  resumeVersion?: ApplicationResumeVersion | null;
  statusHistory?: ApplicationStatusHistoryItem[];
  notes?: ApplicationNoteItem[];
  reminders?: ApplicationReminderItem[];
  _count?: {
    notes: number;
    reminders: number;
    statusHistory: number;
  };
}

export interface SavedJobItem {
  id: string;
  candidateProfileId: string;
  jobId: string;
  notes?: string | null;
  savedAt: string;
  job: ApplicationJob;
}

export interface ApplicationStats {
  total: number;
  active: number;
  saved: number;
  readyToApply: number;
  applied: number;
  assessment: number;
  hrScreen: number;
  technical: number;
  finalRound: number;
  interviewsTotal: number;
  offers: number;
  rejected: number;
  withdrawn: number;
  conversionRate: number;
  responseRate: number;
}
