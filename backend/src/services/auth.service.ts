import { userRepository, type UserRepository } from '../repositories/user.repository.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt.js';
import { AppError, BadRequestError, ConflictError, UnauthorizedError } from '../utils/errors.js';
import { createHash } from 'crypto';
import type { SanitizedUser, TokenPayload } from '../types/auth.types.js';
import { UserRole, AuthProvider } from '@prisma/client';
import { env } from '../config/env.js';

export class AuthService {
  constructor(private userRepo: UserRepository = userRepository) {}

  async register(data: { email: string; password: string; fullName?: string; role?: UserRole }): Promise<{ user: SanitizedUser; accessToken: string; refreshToken: string }> {
    const normalizedEmail = data.email.toLowerCase().trim();

    const existing = await this.userRepo.findByEmail(normalizedEmail);
    if (existing) {
      throw new ConflictError('A user with this email address already exists');
    }

    const passwordHash = await hashPassword(data.password);
    const user = await this.userRepo.createUser({
      email: normalizedEmail,
      passwordHash,
      role: data.role || UserRole.CANDIDATE,
      fullName: data.fullName
    });

    const payload: TokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role
    };

    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    // Hash refresh token before saving in database
    const tokenHash = createHash('sha256').update(refreshToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await this.userRepo.storeRefreshToken(user.id, tokenHash, expiresAt);

    return {
      user: this.sanitizeUser(user),
      accessToken,
      refreshToken
    };
  }

  async login(data: { email: string; password: string }): Promise<{ user: SanitizedUser; accessToken: string; refreshToken: string }> {
    const normalizedEmail = data.email.toLowerCase().trim();
    const user = await this.userRepo.findByEmail(normalizedEmail);

    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    if (!user.isActive) {
      throw new UnauthorizedError('Your account has been deactivated. Please contact support.');
    }

    const isMatch = await verifyPassword(user.passwordHash, data.password);
    if (!isMatch) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const payload: TokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role
    };

    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    const tokenHash = createHash('sha256').update(refreshToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await this.userRepo.storeRefreshToken(user.id, tokenHash, expiresAt);

    return {
      user: this.sanitizeUser(user),
      accessToken,
      refreshToken
    };
  }

  async refreshToken(rawRefreshToken: string): Promise<{ accessToken: string; refreshToken: string; user: SanitizedUser }> {
    if (!rawRefreshToken) {
      throw new UnauthorizedError('Refresh token required');
    }

    let payload: TokenPayload;
    try {
      payload = verifyRefreshToken(rawRefreshToken);
    } catch {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    const tokenHash = createHash('sha256').update(rawRefreshToken).digest('hex');
    const stored = await this.userRepo.findRefreshToken(payload.userId, tokenHash);
    if (!stored) {
      throw new UnauthorizedError('Revoked or unrecognized refresh token');
    }

    const user = await this.userRepo.findById(payload.userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedError('User account not found or deactivated');
    }

    // Issue rotated tokens
    const newPayload: TokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role
    };
    const newAccessToken = signAccessToken(newPayload);
    const newRefreshToken = signRefreshToken(newPayload);

    // Rotate token in DB
    const newTokenHash = createHash('sha256').update(newRefreshToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await this.userRepo.deleteRefreshTokensForUser(user.id);
    await this.userRepo.storeRefreshToken(user.id, newTokenHash, expiresAt);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      user: this.sanitizeUser(user)
    };
  }

  async logout(userId: string): Promise<void> {
    await this.userRepo.deleteRefreshTokensForUser(userId);
  }

  async getMe(userId: string): Promise<SanitizedUser> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new UnauthorizedError('User profile not found');
    }
    const accounts = await this.userRepo.getProviderAccounts(userId);
    return this.sanitizeUser(user, accounts);
  }

  async authenticateSocialUser(data: {
    provider: AuthProvider;
    providerSubjectId: string;
    email: string;
    fullName?: string;
    avatarUrl?: string;
    emailVerified?: boolean;
  }): Promise<{ user: SanitizedUser; accessToken: string; refreshToken: string }> {
    const normalizedEmail = data.email.toLowerCase().trim();
    if (!normalizedEmail || !data.providerSubjectId) {
      throw new BadRequestError('Invalid provider identity information');
    }

    // 1. Check if an account already exists with this provider and subject ID
    let user = await this.userRepo.findByProviderSubject(data.provider, data.providerSubjectId);

    if (user) {
      if (!user.isActive) {
        throw new UnauthorizedError('Your account has been deactivated. Please contact support.');
      }
    } else {
      // 2. Check if an account already exists with the same email
      const existingEmailUser = await this.userRepo.findByEmail(normalizedEmail);

      if (existingEmailUser) {
        if (!existingEmailUser.isActive) {
          throw new UnauthorizedError('Your account has been deactivated. Please contact support.');
        }
        // Link this provider to the existing Pilot Mama account
        await this.userRepo.linkProviderAccount(
          existingEmailUser.id,
          data.provider,
          data.providerSubjectId,
          normalizedEmail
        );
        user = (await this.userRepo.findById(existingEmailUser.id)) as any;
      } else {
        // 3. Create a brand new user with provider account and initial candidate profile
        user = await this.userRepo.createSocialUser({
          email: normalizedEmail,
          fullName: data.fullName,
          avatarUrl: data.avatarUrl,
          provider: data.provider,
          providerSubjectId: data.providerSubjectId,
          emailVerified: data.emailVerified ?? true
        });
      }
    }

    if (!user) {
      throw new UnauthorizedError('Unable to authenticate with social provider');
    }

    const payload: TokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role
    };

    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    const tokenHash = createHash('sha256').update(refreshToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await this.userRepo.storeRefreshToken(user.id, tokenHash, expiresAt);

    const accounts = await this.userRepo.getProviderAccounts(user.id);

    return {
      user: this.sanitizeUser(user, accounts),
      accessToken,
      refreshToken
    };
  }

  async verifyGoogleCredential(idToken: string): Promise<{
    subject: string;
    email: string;
    name?: string;
    picture?: string;
    emailVerified?: boolean;
  }> {
    if (!idToken || typeof idToken !== 'string') {
      throw new BadRequestError('Google credential token is required');
    }

    // Call Google's official tokeninfo endpoint to verify JWT cryptographically
    try {
      const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
      if (!response.ok) {
        throw new UnauthorizedError('Invalid or expired Google credential');
      }
      const data = await response.json();

      if (!data.sub || !data.email) {
        throw new UnauthorizedError('Google credential is missing required identity claims');
      }

      // Verify audience if GOOGLE_CLIENT_ID is configured
      if (env.GOOGLE_CLIENT_ID && data.aud !== env.GOOGLE_CLIENT_ID) {
        throw new UnauthorizedError('Google credential audience mismatch');
      }

      return {
        subject: data.sub,
        email: data.email,
        name: data.name,
        picture: data.picture,
        emailVerified: data.email_verified === 'true' || data.email_verified === true
      };
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new UnauthorizedError('Failed to verify Google credential: ' + (err.message || 'Network error'));
    }
  }

  async verifyLinkedInToken(accessToken: string): Promise<{
    subject: string;
    email: string;
    name?: string;
    picture?: string;
  }> {
    if (!accessToken || typeof accessToken !== 'string') {
      throw new BadRequestError('LinkedIn access token is required');
    }

    // Call LinkedIn OpenID Connect userinfo endpoint
    try {
      const response = await fetch('https://api.linkedin.com/v2/userinfo', {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });
      if (!response.ok) {
        throw new UnauthorizedError('Invalid or expired LinkedIn access token');
      }
      const data = await response.json();

      if (!data.sub) {
        throw new UnauthorizedError('LinkedIn token is missing required subject identifier');
      }

      return {
        subject: data.sub,
        email: data.email || `${data.sub}@linkedin.pilotmama.io`,
        name: data.name || [data.given_name, data.family_name].filter(Boolean).join(' '),
        picture: data.picture
      };
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new UnauthorizedError('Failed to verify LinkedIn credential: ' + (err.message || 'Network error'));
    }
  }

  private sanitizeUser(user: any, providerAccounts?: any[]): SanitizedUser {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      candidateProfile: user.candidateProfile
        ? {
            id: user.candidateProfile.id,
            fullName: user.candidateProfile.fullName,
            avatarUrl: user.candidateProfile.avatarUrl || null
          }
        : null,
      connectedProviders: providerAccounts
        ? providerAccounts.map(pa => pa.provider)
        : (user.providerAccounts ? user.providerAccounts.map((pa: any) => pa.provider) : [])
    };
  }
}

export const authService = new AuthService();
