import { prisma } from '../database/prisma.js';
import { User, UserRole, CandidateProfile } from '@prisma/client';

export interface CreateUserData {
  email: string;
  passwordHash: string;
  role?: UserRole;
  fullName?: string;
}

export class UserRepository {
  async findByEmail(email: string): Promise<(User & { candidateProfile: CandidateProfile | null }) | null> {
    return prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: {
        candidateProfile: true
      }
    });
  }

  async findById(id: string): Promise<(User & { candidateProfile: CandidateProfile | null }) | null> {
    return prisma.user.findUnique({
      where: { id },
      include: {
        candidateProfile: true
      }
    });
  }

  async createUser(data: CreateUserData): Promise<User & { candidateProfile: CandidateProfile | null }> {
    const role = data.role || UserRole.CANDIDATE;
    return prisma.user.create({
      data: {
        email: data.email.toLowerCase().trim(),
        passwordHash: data.passwordHash,
        role,
        candidateProfile: role === UserRole.CANDIDATE ? {
          create: {
            fullName: data.fullName || data.email.split('@')[0]
          }
        } : undefined
      },
      include: {
        candidateProfile: true
      }
    });
  }

  async storeRefreshToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt
      }
    });
  }

  async findRefreshToken(userId: string, tokenHash: string) {
    return prisma.refreshToken.findFirst({
      where: {
        userId,
        tokenHash,
        expiresAt: { gt: new Date() }
      }
    });
  }

  async deleteRefreshTokensForUser(userId: string): Promise<void> {
    await prisma.refreshToken.deleteMany({
      where: { userId }
    });
  }
}

export const userRepository = new UserRepository();
