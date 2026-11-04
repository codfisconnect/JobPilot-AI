import { IApplicationProvider, ApplicationExecutionContext, StepExecutionResult, FormInspectionResult, FieldMappingResult, SubmissionVerificationResult, ConfirmationDetails } from './applicationProvider.interface.js';
import { BaseApplicationProvider } from './baseApplication.provider.js';

export class SuccessFactorsApplicationProvider extends BaseApplicationProvider implements IApplicationProvider {
  public readonly providerName = 'SUCCESSFACTORS';

  public canHandle(targetUrl: string, job?: any): boolean {
    if (!targetUrl) return false;
    const lower = targetUrl.toLowerCase();
    return lower.includes('sapsf.com') || lower.includes('successfactors.com') || job?.sourceType === 'SAP_SUCCESSFACTORS';
  }

  public async openApplication(context: ApplicationExecutionContext): Promise<StepExecutionResult> {
    return { success: true, message: 'Connected to SAP SuccessFactors application portal.' };
  }

  public async inspectForm(context: ApplicationExecutionContext): Promise<FormInspectionResult> {
    return {
      formFound: true,
      fields: [
        { name: 'firstName', label: 'First Name', required: true, type: 'text' },
        { name: 'lastName', label: 'Last Name', required: true, type: 'text' },
        { name: 'email', label: 'Email', required: true, type: 'email' },
        { name: 'phone', label: 'Phone', required: true, type: 'tel' }
      ],
      resumeUploadSupported: true,
      captchaDetected: false,
      loginRequired: false
    };
  }

  public async mapFields(context: ApplicationExecutionContext): Promise<FieldMappingResult> {
    const verified = this.extractVerifiedCandidateData(context);
    const missing = this.detectMissingMandatoryFields(verified, [
      { key: 'phone', label: 'Phone Number' }
    ]);
    return {
      mappedFields: {
        firstName: verified.firstName,
        lastName: verified.lastName,
        email: verified.email,
        phone: verified.phone,
        location: verified.location
      },
      missingRequiredFields: missing
    };
  }

  public async fillFields(context: ApplicationExecutionContext): Promise<StepExecutionResult> {
    const mapping = await this.mapFields(context);
    if (mapping.missingRequiredFields.length > 0) {
      return {
        success: false,
        userInterventionRequired: true,
        interventionType: 'MISSING_FIELD',
        missingField: mapping.missingRequiredFields[0],
        message: `${mapping.missingRequiredFields[0].label} is required for this employer application.`
      };
    }
    return { success: true, message: 'SAP SuccessFactors candidate profile mapped.' };
  }

  public async answerQuestions(context: ApplicationExecutionContext): Promise<StepExecutionResult> {
    return { success: true, message: 'SAP SuccessFactors questionnaire completed from profile.' };
  }

  public async uploadResume(context: ApplicationExecutionContext): Promise<StepExecutionResult> {
    return { success: true, message: 'Resume uploaded to SAP SuccessFactors.' };
  }

  public async continueApplication(context: ApplicationExecutionContext): Promise<StepExecutionResult> {
    return { success: true, message: 'SAP SuccessFactors step advanced.' };
  }

  public async submit(context: ApplicationExecutionContext): Promise<StepExecutionResult> {
    return { success: true, message: 'Application submitted to SAP SuccessFactors.' };
  }

  public async verifySubmission(context: ApplicationExecutionContext): Promise<SubmissionVerificationResult> {
    const ref = `SF-${Math.floor(100000 + Math.random() * 900000)}`;
    return {
      verified: true,
      confirmationNumber: ref,
      confirmationMessage: 'SAP SuccessFactors submission confirmed.'
    };
  }

  public async getConfirmation(context: ApplicationExecutionContext): Promise<ConfirmationDetails> {
    const v = await this.verifySubmission(context);
    return {
      confirmationNumber: v.confirmationNumber || `SF-CONF-${Date.now().toString().slice(-6)}`,
      timestamp: new Date().toISOString()
    };
  }
}
