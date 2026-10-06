import { userRepository, type UserRepository } from '../repositories/user.repository.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt.js';
import { BadRequestError, ConflictError, UnauthorizedError } from '../utils/errors.js';
import { createHash } from 'crypto';
import type { SanitizedUser, TokenPayload } from '../types/auth.types.js';
import { UserRole } from '@prisma/client';

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
    return this.sanitizeUser(user);
  }

  private sanitizeUser(user: any): SanitizedUser {
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
            fullName: user.candidateProfile.fullName
          }
        : null
    };
  }
}

export const authService = new AuthService();
