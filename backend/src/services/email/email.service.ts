import { IEmailProvider, EmailOptions, EmailSendResult } from './emailProvider.interface.js';
import { EmailTemplates, MatchedJobAlertItem } from './emailTemplates.js';
import { logger } from '../../utils/logger.js';
import { env } from '../../config/env.js';

export class InMemoryEmailProvider implements IEmailProvider {
  public name = 'IN_MEMORY_DEV_PROVIDER';
  private sentMails: EmailOptions[] = [];

  isConfigured(): boolean {
    return true;
  }

  async sendEmail(options: EmailOptions): Promise<EmailSendResult> {
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    this.sentMails.push(options);

    logger.info(`[EmailService] Captured outgoing email to <${options.to}> with subject "${options.subject}" (MsgID: ${messageId})`);

    return {
      success: true,
      messageId,
      provider: this.name,
      timestamp: new Date().toISOString()
    };
  }

  getSentMails(): EmailOptions[] {
    return [...this.sentMails];
  }

  getLastMail(to?: string): EmailOptions | undefined {
    if (!to) return this.sentMails[this.sentMails.length - 1];
    return this.sentMails.filter(m => m.to.toLowerCase() === to.toLowerCase()).pop();
  }

  clear(): void {
    this.sentMails = [];
  }
}

export class EmailService {
  private static provider: IEmailProvider = new InMemoryEmailProvider();

  public static setProvider(provider: IEmailProvider): void {
    this.provider = provider;
  }

  public static getProvider(): IEmailProvider {
    return this.provider;
  }

  public static getSentEmails(): EmailOptions[] {
    if (this.provider instanceof InMemoryEmailProvider) {
      return this.provider.getSentMails();
    }
    return [];
  }

  public static getLastEmail(to?: string): EmailOptions | undefined {
    if (this.provider instanceof InMemoryEmailProvider) {
      return this.provider.getLastMail(to);
    }
    return undefined;
  }

  public static clearSentEmails(): void {
    if (this.provider instanceof InMemoryEmailProvider) {
      this.provider.clear();
    }
  }

  /**
   * Dispatch an email with retry and backoff
   */
  public static async sendWithRetry(
    options: EmailOptions,
    maxRetries = 2,
    initialBackoffMs = 300
  ): Promise<EmailSendResult> {
    let attempt = 0;
    let lastError = 'Unknown email error';

    while (attempt <= maxRetries) {
      try {
        const result = await this.provider.sendEmail(options);
        if (result.success) {
          return result;
        }
        lastError = result.error || 'Provider returned unsuccessful status';
      } catch (err: any) {
        lastError = err.message || 'Network exception during email dispatch';
      }

      attempt++;
      if (attempt <= maxRetries) {
        const delay = initialBackoffMs * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    logger.error(`[EmailService] Failed to send email to ${options.to} after ${maxRetries + 1} attempts: ${lastError}`);
    return {
      success: false,
      error: lastError,
      provider: this.provider.name,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Send Signup Verification OTP
   */
  public static async sendVerificationEmail(email: string, otp: string): Promise<EmailSendResult> {
    const { html, text } = EmailTemplates.signupOtp(otp);
    return this.sendWithRetry({
      to: email,
      subject: 'Verify your Pilot Mama account - Verification Code',
      html,
      text,
      metadata: { type: 'SIGNUP_OTP' }
    });
  }

  /**
   * Send Login Verification OTP
   */
  public static async sendLoginOtpEmail(email: string, otp: string): Promise<EmailSendResult> {
    const { html, text } = EmailTemplates.loginOtp(otp);
    return this.sendWithRetry({
      to: email,
      subject: 'Your Pilot Mama Login Code',
      html,
      text,
      metadata: { type: 'LOGIN_OTP' }
    });
  }

  /**
   * Send Password Reset OTP
   */
  public static async sendPasswordResetEmail(email: string, otp: string): Promise<EmailSendResult> {
    const { html, text } = EmailTemplates.passwordResetOtp(otp);
    return this.sendWithRetry({
      to: email,
      subject: 'Reset your Pilot Mama password',
      html,
      text,
      metadata: { type: 'PASSWORD_RESET_OTP' }
    });
  }

  /**
   * Send Job Alert Email (single or batched)
   */
  public static async sendJobAlertEmail(
    email: string,
    candidateFirstName: string,
    jobs: MatchedJobAlertItem[],
    unsubscribeToken: string
  ): Promise<EmailSendResult> {
    const appBaseUrl = env.APP_BASE_URL || 'https://job-pilot-ai-pearl.vercel.app';
    const unsubscribeUrl = `${appBaseUrl}/api/v1/alerts/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}`;

    const { subject, html, text } = EmailTemplates.newJobAlert(
      candidateFirstName,
      jobs,
      unsubscribeUrl
    );

    return this.sendWithRetry({
      to: email,
      subject,
      html,
      text,
      metadata: {
        type: 'JOB_ALERT',
        jobCount: jobs.length,
        jobIds: jobs.map(j => j.id)
      }
    });
  }
}
