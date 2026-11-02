import { ApplicationAttempt, MissingFieldPrompt } from '../orchestrator/orchestrator.types.js';

export interface ApplicationExecutionContext {
  attempt: ApplicationAttempt;
  job: any; // Authoritative canonical job record
  candidate: any; // Full candidate profile with verified experiences, skills, education, preferences
  selectedResume: any; // Selected Resume or ResumeVersion record
  targetUrl: string; // Exact application target URL
  candidateResponses: Record<string, any>; // Answers provided by candidate for missing fields
}

export interface StepExecutionResult {
  success: boolean;
  message: string;
  details?: Record<string, any>;
  nextState?: string;
  userInterventionRequired?: boolean;
  interventionType?: 'CAPTCHA' | 'AUTH' | 'MISSING_FIELD' | 'UNSUPPORTED';
  missingField?: MissingFieldPrompt;
}

export interface FormInspectionResult {
  formFound: boolean;
  fields: Array<{
    name: string;
    label: string;
    required: boolean;
    type?: string;
  }>;
  resumeUploadSupported: boolean;
  captchaDetected: boolean;
  loginRequired: boolean;
}

export interface FieldMappingResult {
  mappedFields: Record<string, any>;
  missingRequiredFields: MissingFieldPrompt[];
}

export interface SubmissionVerificationResult {
  verified: boolean;
  confirmationNumber?: string;
  confirmationMessage?: string;
  failureReason?: string;
}

export interface ConfirmationDetails {
  confirmationNumber: string;
  timestamp: string;
  receiptUrl?: string;
  details?: Record<string, any>;
}

export interface IApplicationProvider {
  readonly providerName: string;
  
  /**
   * Determine if this provider can handle the given target URL and job metadata
   */
  canHandle(targetUrl: string, job?: any): boolean;

  /**
   * Navigate to / establish connection with the employer application portal
   */
  openApplication(context: ApplicationExecutionContext): Promise<StepExecutionResult>;

  /**
   * Inspect the employer application form for fields, resume controls, and security challenges
   */
  inspectForm(context: ApplicationExecutionContext): Promise<FormInspectionResult>;

  /**
   * Map standard verified candidate profile data to employer form fields
   */
  mapFields(context: ApplicationExecutionContext): Promise<FieldMappingResult>;

  /**
   * Autofill candidate details into employer form
   */
  fillFields(context: ApplicationExecutionContext): Promise<StepExecutionResult>;

  /**
   * Answer employer questions using verified candidate data or stored preferences
   */
  answerQuestions(context: ApplicationExecutionContext): Promise<StepExecutionResult>;

  /**
   * Upload selected resume bytes to employer application portal
   */
  uploadResume(context: ApplicationExecutionContext): Promise<StepExecutionResult>;

  /**
   * Advance through application stages
   */
  continueApplication(context: ApplicationExecutionContext): Promise<StepExecutionResult>;

  /**
   * Execute final submission on employer portal
   */
  submit(context: ApplicationExecutionContext): Promise<StepExecutionResult>;

  /**
   * Verify whether the application was genuinely confirmed by the employer
   */
  verifySubmission(context: ApplicationExecutionContext): Promise<SubmissionVerificationResult>;

  /**
   * Retrieve formal confirmation details from the employer response
   */
  getConfirmation(context: ApplicationExecutionContext): Promise<ConfirmationDetails>;
}
