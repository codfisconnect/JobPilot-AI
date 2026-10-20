import { ApplicationStatus } from '@prisma/client';

export type ApplicationAutomationState =
  | 'QUEUED'
  | 'ANALYZING_JOB'
  | 'CHECKING_ELIGIBILITY'
  | 'SELECTING_RESUME'
  | 'TAILORING_RESUME'
  | 'ATS_CHECKING'
  | 'APPLICATION_READY'
  | 'OPENING_APPLICATION'
  | 'DISCOVERING_FORM'
  | 'FILLING_FORM'
  | 'DOCUMENT_UPLOAD'
  | 'REVIEWING'
  | 'USER_ACTION_REQUIRED'
  | 'READY_TO_SUBMIT'
  | 'SUBMITTING'
  | 'VERIFYING_SUBMISSION'
  | 'APPLIED'
  | 'ALREADY_APPLIED'
  | 'FAILED'
  | 'UNSUPPORTED'
  | 'CANCELLED';

export interface AutomationStepEvent {
  step: string;
  state: ApplicationAutomationState;
  timestamp: string;
  message: string;
  details?: Record<string, any>;
}

export interface ApplicationAutomationTask {
  taskId: string;
  applicationId: string;
  candidateProfileId: string;
  jobId: string;
  applicationUrl: string;
  platform: 'WORKDAY' | 'GREENHOUSE' | 'LEVER' | 'RIPPLEHIRE' | 'GENERIC_ATS';
  currentState: ApplicationAutomationState;
  jobMatchScore: number;
  atsCompatibilityScore: number;
  selectedResumeVersionId?: string;
  selectedResumeVersionName?: string;
  userActionReason?: string;
  userActionType?: 'TERMS_CONSENT' | 'EMAIL_VERIFICATION' | 'CAPTCHA_CHALLENGE' | 'UNKNOWN_QUESTION' | 'EMPLOYER_LOGIN';
  confirmationReference?: string;
  timeline: AutomationStepEvent[];
  createdAt: string;
  updatedAt: string;
}

export interface StartApplicationRequestDTO {
  jobId: string;
  resumeVersionId?: string;
  autoApply?: boolean;
}

export interface StartApplicationResponseDTO {
  success: boolean;
  applicationId: string;
  taskId: string;
  currentState: ApplicationAutomationState;
  job: {
    id: string;
    title: string;
    company: string;
    location?: string;
    platform: string;
    applicationUrl: string;
  };
  jobMatchScore: number;
  atsCompatibilityScore: number;
  selectedResumeVersionId?: string;
  timeline: AutomationStepEvent[];
}
