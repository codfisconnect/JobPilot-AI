import { logger } from '../../utils/logger.js';
import { IApplicationProvider, ApplicationExecutionContext, SubmissionVerificationResult, ConfirmationDetails } from './providers/applicationProvider.interface.js';

export class SubmissionVerificationService {
  /**
   * Verifies submission against the specific application provider.
   * Prevents recording APPLIED or SUBMITTED merely because a page was loaded.
   */
  public static async verify(
    provider: IApplicationProvider,
    context: ApplicationExecutionContext
  ): Promise<SubmissionVerificationResult> {
    try {
      logger.info(`[SubmissionVerificationService] Verifying submission with ${provider.providerName}`);
      const result = await provider.verifySubmission(context);
      if (!result.verified) {
        logger.warn(`[SubmissionVerificationService] Submission verification failed: ${result.failureReason}`);
      }
      return result;
    } catch (err: any) {
      logger.error(`[SubmissionVerificationService] Error during verification: ${err.message}`);
      return {
        verified: false,
        failureReason: `Verification error: ${err.message}`
      };
    }
  }

  /**
   * Retrieves authoritative confirmation details
   */
  public static async extractConfirmation(
    provider: IApplicationProvider,
    context: ApplicationExecutionContext
  ): Promise<ConfirmationDetails> {
    return provider.getConfirmation(context);
  }
}
