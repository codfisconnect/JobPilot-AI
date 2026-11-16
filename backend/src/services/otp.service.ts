import { env } from '../config/env.js';
import crypto from 'crypto';
import { prisma } from '../database/prisma.js';
import { EmailService } from './email/email.service.js';
import { BadRequestError, UnauthorizedError, TooManyRequestsError, AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { OtpPurpose } from '@prisma/client';

export class OtpService {
  private static EXPIRATION_MINUTES = 10;
  private static MAX_ATTEMPTS = 5;
  private static RESEND_COOLDOWN_SECONDS = 60;
  private static inMemoryOtps = new Map<string, { hash: string; plain: string; expiresAt: Date; attempts: number }>();

  /**
   * Cryptographically secure 6-digit OTP generation
   */
  public static generateSecureCode(): string {
    const min = 100000;
    const max = 999999;
    return crypto.randomInt(min, max + 1).toString();
  }

  /**
   * Hash OTP using SHA-256 for secure database storage
   */
  public static hashOtp(otp: string): string {
    return crypto.createHash('sha256').update(otp.trim()).digest('hex');
  }

  /**
   * Issue a new OTP for an email and purpose, invalidating any previous active OTPs
   */
  public static async generateAndSendOtp(
    email: string,
    purpose: OtpPurpose,
    metadata?: Record<string, any>
  ): Promise<{ message: string; cooldownSeconds: number }> {
    const normalizedEmail = email.toLowerCase().trim();
    const plainCode = this.generateSecureCode();
    const otpHash = this.hashOtp(plainCode);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.EXPIRATION_MINUTES * 60 * 1000);
    const resendAfter = new Date(now.getTime() + this.RESEND_COOLDOWN_SECONDS * 1000);

    // In development only, save to memory cache for offline resilience. In production, never retain plaintext OTP in memory.
    const isProduction = env.NODE_ENV === 'production';
    if (!isProduction) {
      const memKey = `${normalizedEmail}:${purpose}`;
      this.inMemoryOtps.set(memKey, {
        hash: otpHash,
        plain: plainCode,
        expiresAt,
        attempts: 0
      });
    }

    try {
      // Check resend cooldown on the most recent OTP for this email & purpose
      const recentOtp = await prisma.emailOtp.findFirst({
        where: {
          email: normalizedEmail,
          purpose,
          verified: false
        },
        orderBy: { createdAt: 'desc' }
      });

      if (recentOtp && recentOtp.resendAfter > now) {
        const waitSeconds = Math.ceil((recentOtp.resendAfter.getTime() - now.getTime()) / 1000);
        throw new TooManyRequestsError(`Please wait ${waitSeconds} seconds before requesting a new code.`, {
          remainingSeconds: waitSeconds,
          cooldownSeconds: waitSeconds
        });
      }

      // Invalidate previous OTPs for this email and purpose
      await prisma.emailOtp.deleteMany({
        where: {
          email: normalizedEmail,
          purpose
        }
      });

      await prisma.emailOtp.create({
        data: {
          email: normalizedEmail,
          otpHash,
          purpose,
          expiresAt,
          resendAfter,
          attempts: 0,
          maxAttempts: this.MAX_ATTEMPTS,
          verified: false,
          metadata: { ...(metadata || {}) }
        }
      });
    } catch (dbErr: any) {
      if (dbErr instanceof TooManyRequestsError) throw dbErr;
      if (isProduction) {
        logger.error(`[OtpService] Database error storing OTP hash for <${normalizedEmail}>: ${dbErr?.message}`);
        throw new AppError("Database service is temporarily unavailable. Please try again shortly.", 503, 'DATABASE_UNAVAILABLE');
      }
      logger.info(`[OtpService] Stored fallback OTP in memory for <${normalizedEmail}>`);
    }

    // Never log plaintext OTP code in production
    if (isProduction) {
      logger.info(`[OtpService] Verification OTP generated and queued for <${normalizedEmail}> (Purpose: ${purpose})`);
    } else {
      logger.info(`[OtpService] Verification OTP generated for <${normalizedEmail}> [Code: ${plainCode}] (Purpose: ${purpose})`);
    }

    // Dispatch corresponding email template if configured
    try {
      let emailResult;
      if (purpose === 'SIGNUP') {
        emailResult = await EmailService.sendVerificationEmail(normalizedEmail, plainCode);
      } else if (purpose === 'LOGIN') {
        emailResult = await EmailService.sendLoginOtpEmail(normalizedEmail, plainCode);
      } else if (purpose === 'PASSWORD_RESET') {
        emailResult = await EmailService.sendPasswordResetEmail(normalizedEmail, plainCode);
      } else {
        emailResult = await EmailService.sendVerificationEmail(normalizedEmail, plainCode);
      }

      if (isProduction && emailResult && !emailResult.success) {
        logger.error(`[OtpService] Production email delivery failed for <${normalizedEmail}>: ${emailResult.error}`);
        throw new AppError("We couldn't deliver the verification code to your email. Please try again or contact support.", 500, 'EMAIL_SEND_FAILED');
      }
    } catch (sendErr: any) {
      if (sendErr instanceof AppError) throw sendErr;
      if (isProduction) {
        logger.error(`[OtpService] Failed to dispatch OTP email in production for <${normalizedEmail}>: ${sendErr?.message}`);
        throw new AppError("We couldn't deliver the verification code to your email. Please try again.", 500, 'EMAIL_SEND_FAILED');
      }
      logger.info(`[OtpService] Note: SMTP not configured. Development OTP code for ${normalizedEmail} is: ${plainCode}`);
    }

    return {
      message: 'Verification code sent to your email.',
      cooldownSeconds: this.RESEND_COOLDOWN_SECONDS
    };
  }

  /**
   * Verify an entered OTP code
   */
  public static async verifyOtp(
    email: string,
    code: string,
    purpose: OtpPurpose
  ): Promise<{ verified: boolean; metadata?: any }> {
    const normalizedEmail = email.toLowerCase().trim();
    const cleanCode = (code || '').trim();

    if (!cleanCode || cleanCode.length !== 6 || !/^\d{6}$/.test(cleanCode)) {
      throw new BadRequestError('Enter a valid 6-digit verification code.');
    }

    const incomingHash = this.hashOtp(cleanCode);
    const memKey = `${normalizedEmail}:${purpose}`;
    const memRecord = this.inMemoryOtps.get(memKey);

    let record = null;
    try {
      record = await prisma.emailOtp.findFirst({
        where: {
          email: normalizedEmail,
          purpose,
          verified: false
        },
        orderBy: { createdAt: 'desc' }
      });
    } catch {
      // Postgres unreachable
    }

    if (!record) {
      if (env.NODE_ENV !== 'production' && memRecord && memRecord.expiresAt > new Date()) {
        if (memRecord.hash === incomingHash || memRecord.plain === cleanCode) {
          this.inMemoryOtps.delete(memKey);
          return { verified: true };
        }
      }
      throw new UnauthorizedError('That code has expired or was already used. Please request a new code.');
    }

    const now = new Date();
    if (record.expiresAt < now) {
      // Invalidate expired record
      await prisma.emailOtp.delete({ where: { id: record.id } });
      throw new UnauthorizedError('That code has expired. Request a new code.');
    }

    if (record.attempts >= record.maxAttempts) {
      await prisma.emailOtp.delete({ where: { id: record.id } });
      throw new UnauthorizedError('Too many attempts. Please request a new code.');
    }

    const isMatch = crypto.timingSafeEqual(
      Buffer.from(record.otpHash, 'utf8'),
      Buffer.from(incomingHash, 'utf8')
    );

    if (!isMatch) {
      const updatedAttempts = record.attempts + 1;
      if (updatedAttempts >= record.maxAttempts) {
        await prisma.emailOtp.delete({ where: { id: record.id } });
        throw new UnauthorizedError('Too many attempts. Please request a new code.');
      } else {
        await prisma.emailOtp.update({
          where: { id: record.id },
          data: { attempts: updatedAttempts }
        });
        const remaining = record.maxAttempts - updatedAttempts;
        throw new UnauthorizedError(`Incorrect code. Please try again. (${remaining} attempts remaining)`);
      }
    }

    // Mark as verified & consume immediately
    await prisma.emailOtp.update({
      where: { id: record.id },
      data: { verified: true }
    });

    // Delete verified OTP so it cannot be reused
    await prisma.emailOtp.delete({ where: { id: record.id } });

    logger.info(`[OtpService] Successfully verified OTP for <${normalizedEmail}> (Purpose: ${purpose})`);

    return {
      verified: true,
      metadata: record.metadata
    };
  }
}
