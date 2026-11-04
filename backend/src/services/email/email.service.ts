import { IEmailProvider, EmailOptions, EmailSendResult } from './emailProvider.interface.js';
import { EmailTemplates, MatchedJobAlertItem } from './emailTemplates.js';
import { logger } from '../../utils/logger.js';
import { env } from '../../config/env.js';
import nodemailer, { type Transporter } from 'nodemailer';

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

export class SmtpEmailProvider implements IEmailProvider {
  public name = 'SMTP_BREVO_PROVIDER';
  private transporter: Transporter | null = null;
  private host: string;
  private port: number;
  private user: string;
  private pass: string;
  private fromEmail: string;
  private fromName: string;

  constructor(config: {
    host: string;
    port: number;
    user: string;
    pass: string;
    fromEmail?: string;
    fromName?: string;
  }) {
    this.host = config.host;
    this.port = config.port;
    this.user = config.user;
    this.pass = config.pass;
    this.fromEmail = config.fromEmail || config.user;
    this.fromName = config.fromName || 'Pilot Mama';

    try {
      this.transporter = nodemailer.createTransport({
        host: this.host,
        port: this.port,
        secure: this.port === 465,
        auth: {
          user: this.user,
          pass: this.pass
        },
        tls: {
          rejectUnauthorized: false
        },
        connectionTimeout: 8000,
        greetingTimeout: 5000,
        socketTimeout: 10000
      });
    } catch (e: any) {
      logger.warn(`[EmailService] Failed to initialize SMTP transport: ${e.message}`);
    }
  }

  isConfigured(): boolean {
    return Boolean(this.host && this.user && this.pass);
  }

  async sendEmail(options: EmailOptions): Promise<EmailSendResult> {
    const from = options.from || `"${this.fromName}" <${this.fromEmail}>`;

    // Strategy 1: Attempt standard SMTP dispatch via Nodemailer
    if (this.transporter) {
      try {
        const info = await this.transporter.sendMail({
          from,
          to: options.to,
          subject: options.subject,
          text: options.text,
          html: options.html
        });
        logger.info(`[EmailService] SMTP email delivered to <${options.to}> (MsgID: ${info.messageId})`);
        return {
          success: true,
          messageId: info.messageId,
          provider: 'SMTP_BREVO',
          timestamp: new Date().toISOString()
        };
      } catch (smtpErr: any) {
        logger.warn(`[EmailService] Nodemailer SMTP attempt to <${options.to}> failed (${smtpErr.message}). Testing HTTPS API fallback...`);
      }
    }

    // Strategy 2: If SMTP fails or port 587 is blocked, fallback to Brevo HTTPS REST API
    const apiKey = env.BREVO_API_KEY || (this.pass.startsWith('xkeysib-') ? this.pass : null);
    if (apiKey || this.host.includes('brevo') || this.host.includes('sendinblue')) {
      try {
        const brevoKey = apiKey || this.pass;
        const res = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api-key': brevoKey,
            'accept': 'application/json'
          },
          body: JSON.stringify({
            sender: { name: this.fromName, email: this.fromEmail },
            to: [{ email: options.to }],
            subject: options.subject,
            htmlContent: options.html,
            textContent: options.text
          })
        });

        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          const msgId = (data as any).messageId || `brevo_api_${Date.now()}`;
          logger.info(`[EmailService] Brevo HTTPS REST API delivered email to <${options.to}> (MsgID: ${msgId})`);
          return {
            success: true,
            messageId: msgId,
            provider: 'BREVO_HTTPS_API',
            timestamp: new Date().toISOString()
          };
        } else {
          const errText = await res.text().catch(() => '');
          logger.error(`[EmailService] Brevo HTTPS API returned error ${res.status}: ${errText}`);
        }
      } catch (apiErr: any) {
        logger.error(`[EmailService] Brevo HTTPS API fallback failed: ${apiErr.message}`);
      }
    }

    return {
      success: false,
      error: 'SMTP and Brevo API dispatch attempts failed',
      provider: this.name,
      timestamp: new Date().toISOString()
    };
  }
}

export class EmailService {
  private static provider: IEmailProvider = EmailService.createInitialProvider();

  private static createInitialProvider(): IEmailProvider {
    // If SMTP credentials or Brevo key are provided, use SmtpEmailProvider
    const host = env.SMTP_HOST || process.env.SMTP_HOST;
    const user = env.SMTP_USER || process.env.SMTP_USER;
    const pass = env.SMTP_PASS || process.env.SMTP_PASS;
    const brevoKey = env.BREVO_API_KEY || process.env.BREVO_API_KEY;

    if ((host && user && pass) || brevoKey) {
      return new SmtpEmailProvider({
        host: host || 'smtp-relay.brevo.com',
        port: env.SMTP_PORT || parseInt(process.env.SMTP_PORT || '587', 10),
        user: user || '',
        pass: pass || brevoKey || '',
        fromEmail: env.SMTP_FROM_EMAIL || process.env.SMTP_FROM_EMAIL || user,
        fromName: env.SMTP_FROM_NAME || process.env.SMTP_FROM_NAME || 'Pilot Mama'
      });
    }

    return new InMemoryEmailProvider();
  }

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

