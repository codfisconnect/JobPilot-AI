export type OrchestratorState =
  | 'READY'
  | 'PREPARING'
  | 'JOB_ANALYZED'
  | 'RESUME_SELECTED'
  | 'FORM_DISCOVERED'
  | 'FORM_FILLED'
  | 'RESUME_UPLOADED'
  | 'READY_TO_SUBMIT'
  | 'SUBMITTING'
  | 'SUBMITTED'
  | 'WAITING_FOR_CANDIDATE'
  | 'BLOCKED_BY_CAPTCHA'
  | 'BLOCKED_BY_AUTH'
  | 'UNSUPPORTED'
  | 'FAILED'
  | 'CANCELLED';

export interface MissingFieldPrompt {
  fieldKey: string;
  label: string;
  description?: string;
  required: boolean;
  fieldType?: 'text' | 'number' | 'boolean' | 'select';
  options?: string[];
}

export interface StatusUpdateItem {
  id: string;
  step: string;
  label: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  timestamp: string;
}

export interface SubmissionResultDetails {
  confirmationNumber: string;
  submittedAt: string;
  employerUrl: string;
  provider: string;
  role: string;
  company: string;
  resumeUsed: string;
  applicationId?: string;
}

export interface ApplicationAttempt {
  attemptId: string;
  candidateProfileId: string;
  userId: string;
  jobId: string;
  resumeChoice: 'master' | 'tailored';
  selectedResumeId?: string;
  selectedResumeTitle?: string;
  state: OrchestratorState;
  statusUpdates: StatusUpdateItem[];
  missingField?: MissingFieldPrompt;
  candidateResponses: Record<string, any>;
  submissionResult?: SubmissionResultDetails;
  error?: {
    message: string;
    code?: string;
    factualReason: string;
  };
  jobMatchScore: number;
  atsCompatibilityScore: number;
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
}

export interface StartOrchestrationDTO {
  jobId: string;
  resumeChoice?: 'master' | 'tailored';
  resumeId?: string;
  idempotencyKey?: string;
}

export interface MissingFieldResponseDTO {
  fieldKey: string;
  value: any;
}
