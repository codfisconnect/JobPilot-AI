export interface EmailOptions {
  from?: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
  metadata?: Record<string, any>;
}

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  provider?: string;
  timestamp: string;
}

export interface IEmailProvider {
  name: string;
  isConfigured(): boolean;
  sendEmail(options: EmailOptions): Promise<EmailSendResult>;
}

