import { ApplicationStatus } from '@prisma/client';

export { ApplicationStatus };

export interface CreateApplicationDTO {
  jobId: string;
  resumeVersionId?: string;
  status?: ApplicationStatus;
  externalUrl?: string;
  notesSummary?: string;
  customAnswers?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface UpdateApplicationDTO {
  resumeVersionId?: string | null;
  externalUrl?: string | null;
  notesSummary?: string | null;
  customAnswers?: Record<string, any> | null;
  metadata?: Record<string, any> | null;
}

export interface UpdateStatusDTO {
  status: ApplicationStatus;
  reason?: string;
}

export interface CreateNoteDTO {
  content: string;
}

export interface CreateReminderDTO {
  title: string;
  dueDate: Date;
}

export interface ApplicationFilterQuery {
  status?: ApplicationStatus;
  search?: string;
  page?: number;
  pageSize?: number;
  sortBy?: 'createdAt' | 'appliedAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

export interface ApplicationStatsResponse {
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
  conversionRate: number; // percentage of applied that reached interview or offer
  responseRate: number; // percentage of applied that moved past applied
}
