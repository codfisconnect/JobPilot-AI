import type { Request, Response, NextFunction } from 'express';
import { authService } from '../../services/auth.service.js';
import { env } from '../../config/env.js';
import { OtpPurpose } from '@prisma/client';

const REFRESH_COOKIE_NAME = 'pm_refresh_token';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: env.NODE_ENV === 'production' ? ('none' as const) : ('lax' as const),
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/api/v1/auth'
};

export class AuthController {
  /**
   * POST /api/v1/auth/register
   * Candidate initiates signup -> sends 6-digit OTP to verify email ownership
   */
  static async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const outcome = await authService.register(req.body);

      res.status(200).json({
        success: true,
        data: outcome,
        meta: {
          requestId: (req as any).id,
          timestamp: new Date().toISOString()
        }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/auth/verify-otp
   * Verifies 6-digit OTP code for SIGNUP, LOGIN, or PASSWORD_RESET
   */
  static async verifyOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, code, purpose = 'SIGNUP' } = req.body;

      if (purpose === 'SIGNUP') {
        const { user, accessToken, refreshToken } = await authService.verifyRegistrationOtp({ email, code });
        res.cookie(REFRESH_COOKIE_NAME, refreshToken, COOKIE_OPTIONS);
        res.status(200).json({
          success: true,
          data: { user, accessToken, refreshToken }
        });
        return;
      }

      if (purpose === 'LOGIN') {
        const { user, accessToken, refreshToken } = await authService.loginWithOtp({ email, code });
        res.cookie(REFRESH_COOKIE_NAME, refreshToken, COOKIE_OPTIONS);
        res.status(200).json({
          success: true,
          data: { user, accessToken, refreshToken }
        });
        return;
      }

      if (purpose === 'PASSWORD_RESET') {
        const { newPassword } = req.body;
        const outcome = await authService.resetPassword({ email, code, newPassword });
        res.status(200).json({
          success: true,
          data: outcome
        });
        return;
      }

      res.status(400).json({ success: false, message: 'Invalid OTP purpose' });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/auth/request-otp
   * Request OTP for passwordless login, registration verification, or password reset
   */
  static async requestOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, purpose = 'LOGIN' } = req.body;
      const outcome = await authService.requestOtp(email, purpose as OtpPurpose);
      res.status(200).json({
        success: true,
        data: outcome
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/auth/resend-otp
   * Resend OTP with cooldown guard
   */
  static async resendOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, purpose = 'SIGNUP' } = req.body;
      const outcome = await authService.requestOtp(email, purpose as OtpPurpose);
      res.status(200).json({
        success: true,
        data: outcome
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/auth/login
   * Password login (with unverified-email OTP challenge protection)
   */
  static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.login(req.body);

      if ('requiresOtp' in result) {
        res.status(200).json({
          success: true,
          data: result,
          meta: {
            requestId: (req as any).id,
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      const { user, accessToken, refreshToken } = result;
      res.cookie(REFRESH_COOKIE_NAME, refreshToken, COOKIE_OPTIONS);

      res.status(200).json({
        success: true,
        data: {
          user,
          accessToken,
          refreshToken
        },
        meta: {
          requestId: (req as any).id,
          timestamp: new Date().toISOString()
        }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/auth/refresh
   */
  static async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rawRefreshToken = req.cookies?.[REFRESH_COOKIE_NAME] || req.body?.refreshToken;
      const { accessToken, refreshToken, user } = await authService.refreshToken(rawRefreshToken);

      res.cookie(REFRESH_COOKIE_NAME, refreshToken, COOKIE_OPTIONS);

      res.status(200).json({
        success: true,
        data: {
          user,
          accessToken,
          refreshToken
        },
        meta: {
          requestId: (req as any).id,
          timestamp: new Date().toISOString()
        }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/auth/logout
   */
  static async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (req.user?.userId) {
        await authService.logout(req.user.userId);
      }

      res.clearCookie(REFRESH_COOKIE_NAME, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
        path: '/api/v1/auth'
      });

      res.status(200).json({
        success: true,
        data: {
          message: 'Logged out successfully'
        },
        meta: {
          requestId: (req as any).id,
          timestamp: new Date().toISOString()
        }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/auth/me
   */
  static async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await authService.getMe(req.user!.userId);

      res.status(200).json({
        success: true,
        data: {
          user
        },
        meta: {
          requestId: (req as any).id,
          timestamp: new Date().toISOString()
        }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/auth/google
   * Google sign-in with verified identity linking
   */
  static async googleAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const verified = await authService.verifyGoogleCredential(req.body);

      const { user, accessToken, refreshToken } = await authService.authenticateSocialUser({
        provider: 'GOOGLE',
        providerSubjectId: verified.subject,
        email: verified.email,
        fullName: verified.name,
        avatarUrl: verified.picture,
        emailVerified: verified.emailVerified
      });

      res.cookie(REFRESH_COOKIE_NAME, refreshToken, COOKIE_OPTIONS);

      res.status(200).json({
        success: true,
        data: {
          user,
          accessToken,
          refreshToken
        },
        meta: {
          requestId: (req as any).id,
          timestamp: new Date().toISOString()
        }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/auth/linkedin
   * LinkedIn sign-in with verified identity linking
   */
  static async linkedinAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const verified = await authService.verifyLinkedInToken(req.body);

      const { user, accessToken, refreshToken } = await authService.authenticateSocialUser({
        provider: 'LINKEDIN',
        providerSubjectId: verified.subject,
        email: verified.email,
        fullName: verified.name,
        avatarUrl: verified.picture,
        emailVerified: true
      });

      res.cookie(REFRESH_COOKIE_NAME, refreshToken, COOKIE_OPTIONS);

      res.status(200).json({
        success: true,
        data: {
          user,
          accessToken,
          refreshToken
        },
        meta: {
          requestId: (req as any).id,
          timestamp: new Date().toISOString()
        }
      });
    } catch (err) {
      next(err);
    }
  }
}
