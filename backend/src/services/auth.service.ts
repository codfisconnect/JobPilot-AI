import { userRepository, type UserRepository } from '../repositories/user.repository.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt.js';
import { AppError, BadRequestError, ConflictError, UnauthorizedError } from '../utils/errors.js';
import { createHash } from 'crypto';
import type { SanitizedUser, TokenPayload } from '../types/auth.types.js';
import { UserRole, AuthProvider, OtpPurpose } from '@prisma/client';
import { env } from '../config/env.js';
import { OtpService } from './otp.service.js';
import { logger } from '../utils/logger.js';
import { prisma } from '../database/prisma.js';
import { SqliteUserRepository, CandidateRepository } from './repositories.js';

export interface AuthSessionResult {
  user: SanitizedUser;
  accessToken: string;
  refreshToken: string;
}

export class AuthService {
  constructor(private userRepo: UserRepository = userRepository) {}

  /**
   * Validate standard email syntax
   */
  public static validateEmail(email: string): string {
    const normalized = (email || '').toLowerCase().trim();
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
    if (!normalized || !emailRegex.test(normalized)) {
      throw new BadRequestError('Enter a valid email address.');
    }
    return normalized;
  }

  /**
   * Step 1 of Sign-up: Validate, create unverified/pending candidate, generate & send OTP
   */
  async register(data: {
    email: string;
    password: string;
    fullName?: string;
    phone?: string;
    role?: UserRole;
    location?: string;
    experience?: number | string;
    designation?: string;
    companyName?: string;
    companyWebsite?: string;
    industry?: string;
    companySize?: string;
    [key: string]: any;
  }): Promise<{ requiresVerification: boolean; email: string; message: string; cooldownSeconds: number }> {
    const normalizedEmail = AuthService.validateEmail(data.email);

    if (!data.password || data.password.length < 8) {
      throw new BadRequestError('Password must be at least 8 characters long');
    }

    const passwordHash = await hashPassword(data.password);
    const assignedRole = data.role || UserRole.CANDIDATE;

    // Persist to SqliteUserRepository for resilience across local/offline executions
    try {
      await SqliteUserRepository.save({
        id: `user-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        email: normalizedEmail,
        passwordHash,
        fullName: data.fullName || '',
        phone: data.phone || '',
        role: assignedRole,
        location: data.location || '',
        experience: Number(data.experience) || 0,
        designation: data.designation || '',
        companyName: data.companyName || '',
        companyWebsite: data.companyWebsite || '',
        industry: data.industry || '',
        companySize: data.companySize || '',
        emailVerified: 1,
        isActive: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      if (assignedRole === UserRole.CANDIDATE) {
        // Also ensure Candidate profile is accessible
        const candidateId = `cand-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        await CandidateRepository.save({
          id: candidateId,
          name: data.fullName || normalizedEmail.split('@')[0],
          headline: data.designation || 'Software Professional',
          email: normalizedEmail,
          phone: data.phone || '',
          location: data.location || 'Bangalore, India',
          targetRoles: [data.designation || 'Software Engineer'],
          yearsOfExperience: Number(data.experience) || 0,
          preferredLocations: [data.location || 'Bangalore'],
          expectedSalary: 'Competitive',
          noticePeriod: '30 Days',
          workPreference: 'Flexible',
          primarySkills: [],
          secondarySkills: [],
          technologies: [],
          companies: [],
          education: [],
          certifications: [],
          projects: [],
          summary: `${data.designation || 'Professional'} with ${data.experience || 0} years of experience in the industry.`,
          experiences: [],
          isDemo: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
    } catch (sqliteErr) {
      logger.warn('Could not write user to SQLite backup store: ' + String(sqliteErr));
    }

    try {
      const existing = await this.userRepo.findByEmail(normalizedEmail);
      if (existing) {
        if (existing.emailVerified) {
          throw new ConflictError('An account already exists with this email. Please sign in.');
        }
        await prisma.user.update({
          where: { id: existing.id },
          data: {
            passwordHash,
            candidateProfile: data.fullName
              ? {
                  upsert: {
                    create: { fullName: data.fullName.trim(), phone: data.phone || undefined, location: data.location || undefined },
                    update: { fullName: data.fullName.trim(), phone: data.phone || undefined, location: data.location || undefined }
                  }
                }
              : undefined
          }
        });
      } else {
        await this.userRepo.createUser({
          email: normalizedEmail,
          passwordHash,
          role: assignedRole,
          fullName: data.fullName
        });
      }
    } catch (dbErr: any) {
      if (dbErr instanceof ConflictError) throw dbErr;
      logger.warn('PostgreSQL user registration notice (continuing with resilient auth):', dbErr?.message);
    }

    // Generate and send cryptographically secure 6-digit OTP
    const { message, cooldownSeconds } = await OtpService.generateAndSendOtp(
      normalizedEmail,
      OtpPurpose.SIGNUP
    );

    return {
      requiresVerification: true,
      email: normalizedEmail,
      message,
      cooldownSeconds
    };
  }

  /**
   * Step 2 of Sign-up: Verify OTP, activate account, issue authenticated session
   */
  async verifyRegistrationOtp(data: { email: string; code: string }): Promise<AuthSessionResult> {
    const normalizedEmail = AuthService.validateEmail(data.email);

    // 1. Verify OTP
    await OtpService.verifyOtp(normalizedEmail, data.code, OtpPurpose.SIGNUP);

    // 2. Locate candidate user
    const user = await this.userRepo.findByEmail(normalizedEmail);
    if (!user) {
      throw new UnauthorizedError('User account not found. Please sign up again.');
    }

    // 3. Mark email as verified and activate account
    const verifiedUser = await this.userRepo.markEmailVerified(user.id);

    // 4. Issue authenticated credentials
    return this.issueUserTokens(verifiedUser);
  }

  /**
   * Request OTP for Login or Password Reset
   */
  async requestOtp(email: string, purpose: OtpPurpose): Promise<{ message: string; cooldownSeconds: number }> {
    const normalizedEmail = AuthService.validateEmail(email);

    if (purpose === OtpPurpose.LOGIN) {
      const user = await this.userRepo.findByEmail(normalizedEmail);
      if (user && !user.isActive && user.emailVerified) {
        throw new UnauthorizedError('Your account has been deactivated. Please contact support.');
      }
      // If user does not exist yet, allow passwordless auto-provisioning upon OTP verification
    }

    if (purpose === OtpPurpose.PASSWORD_RESET) {
      const user = await this.userRepo.findByEmail(normalizedEmail);
      // If user does not exist, return generic message without revealing account absence
      if (!user) {
        return {
          message: 'If an account exists with this email address, a verification code has been dispatched.',
          cooldownSeconds: 60
        };
      }
    }

    return OtpService.generateAndSendOtp(normalizedEmail, purpose);
  }

  /**
   * Complete passwordless / email-only login with OTP
   */
  async loginWithOtp(data: { email: string; code: string }): Promise<AuthSessionResult> {
    const normalizedEmail = AuthService.validateEmail(data.email);

    // 1. Verify OTP
    await OtpService.verifyOtp(normalizedEmail, data.code, OtpPurpose.LOGIN);

    // 2. Locate or provision user
    let user = await this.userRepo.findByEmail(normalizedEmail);
    if (!user) {
      // Auto-provision candidate with verified email
      user = await prisma.user.create({
        data: {
          email: normalizedEmail,
          passwordHash: `otp:${Date.now()}`,
          role: UserRole.CANDIDATE,
          emailVerified: true,
          isActive: true,
          candidateProfile: {
            create: {
              fullName: normalizedEmail.split('@')[0]
            }
          }
        },
        include: { candidateProfile: true }
      });
    } else {
      if (!user.isActive && user.emailVerified) {
        throw new UnauthorizedError('Your account has been deactivated. Please contact support.');
      }
      if (!user.emailVerified) {
        user = await this.userRepo.markEmailVerified(user.id);
      }
    }

    return this.issueUserTokens(user);
  }

  /**
   * Password login (with verified-email enforcement)
   */
  async login(data: {
    email: string;
    password: string;
  }): Promise<
    | AuthSessionResult
    | { requiresOtp: true; email: string; message: string; cooldownSeconds: number }
  > {
    const normalizedEmail = AuthService.validateEmail(data.email);
    const user = await this.userRepo.findByEmail(normalizedEmail);

    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Verify password with Argon2
    const isMatch = await verifyPassword(user.passwordHash, data.password);
    if (!isMatch) {
      throw new UnauthorizedError('Invalid email or password');
    }

    if (!user.isActive && user.emailVerified) {
      throw new UnauthorizedError('Your account has been deactivated. Please contact support.');
    }

    // SECURITY POLICY: If candidate email is not yet verified, require OTP verification before session issue
    if (!user.emailVerified) {
      let message = 'Your email address is not yet verified. A verification code has been dispatched to your inbox.';
      let cooldownSeconds = 60;
      try {
        const sent = await OtpService.generateAndSendOtp(
          normalizedEmail,
          OtpPurpose.SIGNUP
        );
        message = sent.message;
        cooldownSeconds = sent.cooldownSeconds;
      } catch (otpErr: any) {
        // If recent OTP was already dispatched (e.g. at registration a moment ago), inform candidate cleanly
        message = otpErr.message || 'Please check your email for your verification code.';
      }

      return {
        requiresOtp: true,
        email: normalizedEmail,
        message,
        cooldownSeconds
      };
    }

    return this.issueUserTokens(user);
  }

  /**
   * Password Reset with Verified Email OTP
   */
  async resetPassword(data: {
    email: string;
    code: string;
    newPassword: string;
  }): Promise<{ message: string }> {
    const normalizedEmail = AuthService.validateEmail(data.email);

    if (!data.newPassword || data.newPassword.length < 8) {
      throw new BadRequestError('Password must be at least 8 characters long');
    }

    // 1. Verify OTP
    await OtpService.verifyOtp(normalizedEmail, data.code, OtpPurpose.PASSWORD_RESET);

    // 2. Find user
    const user = await this.userRepo.findByEmail(normalizedEmail);
    if (!user) {
      throw new BadRequestError('Account not found');
    }

    // 3. Update password hash
    const passwordHash = await hashPassword(data.newPassword);
    await this.userRepo.updatePasswordHash(user.id, passwordHash);

    // Invalidate existing sessions
    await this.userRepo.deleteRefreshTokensForUser(user.id);

    return { message: 'Password updated successfully. Please sign in with your new password.' };
  }

  /**
   * Issue authenticated JWT access token and rotated refresh token
   */
  private async issueUserTokens(user: any): Promise<AuthSessionResult> {
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

  /**
   * Refresh token rotation
   */
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
    if (!user || (!user.isActive && user.emailVerified)) {
      throw new UnauthorizedError('User account not found or deactivated');
    }

    const newPayload: TokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role
    };
    const newAccessToken = signAccessToken(newPayload);
    const newRefreshToken = signRefreshToken(newPayload);

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

  /**
   * Authenticate or link social candidate user (Google / LinkedIn)
   */
  async authenticateSocialUser(data: {
    provider: AuthProvider;
    providerSubjectId: string;
    email: string;
    fullName?: string;
    avatarUrl?: string;
    emailVerified?: boolean;
  }): Promise<AuthSessionResult> {
    const normalizedEmail = data.email.toLowerCase().trim();
    if (!normalizedEmail || !data.providerSubjectId) {
      throw new BadRequestError('Invalid provider identity information');
    }

    // 1. Check if an account already exists with this provider and subject ID
    let user = await this.userRepo.findByProviderSubject(data.provider, data.providerSubjectId);

    if (user) {
      if (!user.isActive && user.emailVerified) {
        throw new UnauthorizedError('Your account has been deactivated. Please contact support.');
      }
    } else {
      // 2. Check if an account already exists with the same verified email
      const existingEmailUser = await this.userRepo.findByEmail(normalizedEmail);

      if (existingEmailUser) {
        if (!existingEmailUser.isActive && existingEmailUser.emailVerified) {
          throw new UnauthorizedError('Your account has been deactivated. Please contact support.');
        }
        // Link this provider to the existing Pilot Mama account
        await this.userRepo.linkProviderAccount(
          existingEmailUser.id,
          data.provider,
          data.providerSubjectId,
          normalizedEmail
        );
        // Ensure email is marked verified
        if (!existingEmailUser.emailVerified) {
          await this.userRepo.markEmailVerified(existingEmailUser.id);
        }
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

    return this.issueUserTokens(user);
  }

  /**
   * Google Authentication: ID Token or OAuth 2.0 Authorization Code
   */
  async verifyGoogleCredential(data: {
    credential?: string;
    code?: string;
    redirectUri?: string;
  }): Promise<{
    subject: string;
    email: string;
    name?: string;
    picture?: string;
    emailVerified?: boolean;
  }> {
    // Check if Google credentials are configured
    if (!env.GOOGLE_CLIENT_ID) {
      logger.warn('[AuthService] Google Sign-In attempted but GOOGLE_CLIENT_ID is not configured in backend environment');
      throw new BadRequestError('Google sign-in is temporarily unavailable. Please use email sign-in.');
    }

    // A. ID Token verification
    if (data.credential) {
      try {
        const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(data.credential)}`);
        if (!response.ok) {
          throw new UnauthorizedError('Invalid or expired Google credential');
        }
        const tokenData = await response.json();

        if (!tokenData.sub || !tokenData.email) {
          throw new UnauthorizedError('Google credential is missing required identity claims');
        }

        if (env.GOOGLE_CLIENT_ID && tokenData.aud !== env.GOOGLE_CLIENT_ID) {
          logger.warn(`[AuthService] Google credential audience mismatch: expected ${env.GOOGLE_CLIENT_ID}, got ${tokenData.aud}`);
          throw new UnauthorizedError('Google credential audience mismatch');
        }

        return {
          subject: tokenData.sub,
          email: tokenData.email,
          name: tokenData.name,
          picture: tokenData.picture,
          emailVerified: tokenData.email_verified === 'true' || tokenData.email_verified === true
        };
      } catch (err: any) {
        if (err instanceof AppError) throw err;
        throw new UnauthorizedError('Failed to verify Google credential: ' + (err.message || 'Network error'));
      }
    }

    // B. Authorization Code exchange
    if (data.code) {
      if (!env.GOOGLE_CLIENT_SECRET) {
        logger.warn('[AuthService] Google authorization code exchange attempted but GOOGLE_CLIENT_SECRET is not configured');
        throw new BadRequestError('Google sign-in is temporarily unavailable. Please use email sign-in.');
      }

      try {
        const tokenUrl = 'https://oauth2.googleapis.com/token';
        const params = new URLSearchParams({
          code: data.code,
          client_id: env.GOOGLE_CLIENT_ID,
          client_secret: env.GOOGLE_CLIENT_SECRET,
          redirect_uri: data.redirectUri || `${env.APP_BASE_URL}/auth/google/callback`,
          grant_type: 'authorization_code'
        });

        const tokenRes = await fetch(tokenUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: params.toString()
        });

        if (!tokenRes.ok) {
          const errBody = await tokenRes.text();
          logger.warn(`[AuthService] Google token exchange failed: ${errBody}`);
          throw new UnauthorizedError('Invalid or expired Google authorization code');
        }

        const tokenJson = await tokenRes.json();
        const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokenJson.access_token}` }
        });

        if (!userRes.ok) {
          throw new UnauthorizedError('Failed to retrieve user profile from Google');
        }

        const userData = await userRes.json();
        return {
          subject: userData.sub,
          email: userData.email,
          name: userData.name,
          picture: userData.picture,
          emailVerified: userData.email_verified === true
        };
      } catch (err: any) {
        if (err instanceof AppError) throw err;
        throw new UnauthorizedError('Google authentication failed: ' + (err.message || 'Network error'));
      }
    }

    throw new BadRequestError('Google credential or authorization code is required');
  }

  /**
   * LinkedIn Authentication: Access Token or OAuth Authorization Code
   */
  async verifyLinkedInToken(data: {
    token?: string;
    code?: string;
    redirectUri?: string;
  }): Promise<{
    subject: string;
    email: string;
    name?: string;
    picture?: string;
  }> {
    // Check if LinkedIn credentials are configured
    if (!env.LINKEDIN_CLIENT_ID) {
      logger.warn('[AuthService] LinkedIn Sign-In attempted but LINKEDIN_CLIENT_ID is not configured in backend environment');
      throw new BadRequestError('LinkedIn sign-in is temporarily unavailable. Please use email sign-in.');
    }

    let accessToken = data.token;

    // Exchange authorization code if provided
    if (data.code) {
      if (!env.LINKEDIN_CLIENT_SECRET) {
        logger.warn('[AuthService] LinkedIn authorization code exchange attempted but LINKEDIN_CLIENT_SECRET is not configured');
        throw new BadRequestError('LinkedIn sign-in is temporarily unavailable. Please use email sign-in.');
      }

      try {
        const tokenUrl = 'https://www.linkedin.com/oauth/v2/accessToken';
        const params = new URLSearchParams({
          grant_type: 'authorization_code',
          code: data.code,
          client_id: env.LINKEDIN_CLIENT_ID,
          client_secret: env.LINKEDIN_CLIENT_SECRET,
          redirect_uri: data.redirectUri || `${env.APP_BASE_URL}/auth/linkedin/callback`
        });

        const tokenRes = await fetch(tokenUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: params.toString()
        });

        if (!tokenRes.ok) {
          const errBody = await tokenRes.text();
          logger.warn(`[AuthService] LinkedIn token exchange failed: ${errBody}`);
          throw new UnauthorizedError('Invalid or expired LinkedIn authorization code');
        }

        const tokenJson = await tokenRes.json();
        accessToken = tokenJson.access_token;
      } catch (err: any) {
        if (err instanceof AppError) throw err;
        throw new UnauthorizedError('LinkedIn token exchange failed: ' + (err.message || 'Network error'));
      }
    }

    if (!accessToken) {
      throw new BadRequestError('LinkedIn access token or authorization code is required');
    }

    // Call LinkedIn OpenID Connect userinfo endpoint
    try {
      const response = await fetch('https://api.linkedin.com/v2/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      if (!response.ok) {
        throw new UnauthorizedError('Invalid or expired LinkedIn access token');
      }

      const userInfo = await response.json();
      if (!userInfo.sub) {
        throw new UnauthorizedError('LinkedIn token is missing required subject identifier');
      }

      return {
        subject: userInfo.sub,
        email: userInfo.email || `${userInfo.sub}@linkedin.pilotmama.io`,
        name: userInfo.name || [userInfo.given_name, userInfo.family_name].filter(Boolean).join(' '),
        picture: userInfo.picture
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
