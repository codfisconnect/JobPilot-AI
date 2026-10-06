import type { Request, Response, NextFunction } from 'express';
import { authService } from '../../services/auth.service.js';
import { env } from '../../config/env.js';

const REFRESH_COOKIE_NAME = 'pm_refresh_token';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: env.NODE_ENV === 'production' ? ('strict' as const) : ('lax' as const),
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/api/v1/auth'
};

export class AuthController {
  static async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { user, accessToken, refreshToken } = await authService.register(req.body);

      res.cookie(REFRESH_COOKIE_NAME, refreshToken, COOKIE_OPTIONS);

      res.status(201).json({
        success: true,
        data: {
          user,
          accessToken
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

  static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { user, accessToken, refreshToken } = await authService.login(req.body);

      res.cookie(REFRESH_COOKIE_NAME, refreshToken, COOKIE_OPTIONS);

      res.status(200).json({
        success: true,
        data: {
          user,
          accessToken
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

  static async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rawRefreshToken = req.cookies?.[REFRESH_COOKIE_NAME] || req.body?.refreshToken;
      const { accessToken, refreshToken, user } = await authService.refreshToken(rawRefreshToken);

      res.cookie(REFRESH_COOKIE_NAME, refreshToken, COOKIE_OPTIONS);

      res.status(200).json({
        success: true,
        data: {
          user,
          accessToken
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

  static async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (req.user?.userId) {
        await authService.logout(req.user.userId);
      }

      res.clearCookie(REFRESH_COOKIE_NAME, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: env.NODE_ENV === 'production' ? 'strict' : 'lax',
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
}
