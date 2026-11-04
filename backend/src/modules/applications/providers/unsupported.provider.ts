import { IApplicationProvider, ApplicationExecutionContext, StepExecutionResult, FormInspectionResult, FieldMappingResult, SubmissionVerificationResult, ConfirmationDetails } from './applicationProvider.interface.js';
import { BaseApplicationProvider } from './baseApplication.provider.js';

export class UnsupportedApplicationProvider extends BaseApplicationProvider implements IApplicationProvider {
  public readonly providerName = 'UNSUPPORTED';

  public canHandle(_targetUrl: string, _job?: any): boolean {
    return true; // Catch-all fallback
  }

  public async openApplication(_context: ApplicationExecutionContext): Promise<StepExecutionResult> {
    return {
      success: false,
      message: 'Employer application flow is not automatically supported for this job source.'
    };
  }

  public async inspectForm(_context: ApplicationExecutionContext): Promise<FormInspectionResult> {
    return {
      formFound: false,
      fields: [],
      resumeUploadSupported: false,
      captchaDetected: false,
      loginRequired: false
    };
  }

  public async mapFields(_context: ApplicationExecutionContext): Promise<FieldMappingResult> {
    return { mappedFields: {}, missingRequiredFields: [] };
  }

  public async fillFields(_context: ApplicationExecutionContext): Promise<StepExecutionResult> {
    return { success: false, message: 'Unsupported application portal.' };
  }

  public async answerQuestions(_context: ApplicationExecutionContext): Promise<StepExecutionResult> {
    return { success: false, message: 'Unsupported application portal.' };
  }

  public async uploadResume(_context: ApplicationExecutionContext): Promise<StepExecutionResult> {
    return { success: false, message: 'Unsupported application portal.' };
  }

  public async continueApplication(_context: ApplicationExecutionContext): Promise<StepExecutionResult> {
    return { success: false, message: 'Unsupported application portal.' };
  }

  public async submit(_context: ApplicationExecutionContext): Promise<StepExecutionResult> {
    return { success: false, message: 'Unsupported application portal.' };
  }

  public async verifySubmission(_context: ApplicationExecutionContext): Promise<SubmissionVerificationResult> {
    return {
      verified: false,
      failureReason: 'Unsupported application target cannot be automatically verified.'
    };
  }

  public async getConfirmation(_context: ApplicationExecutionContext): Promise<ConfirmationDetails> {
    throw new Error('Unsupported application target has no confirmation details.');
  }
}
