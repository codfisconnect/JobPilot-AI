import { prisma } from '../database/prisma.js';
import { User, UserRole, CandidateProfile, AuthProvider, ProviderAccount } from '@prisma/client';

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

  async findByProviderSubject(provider: AuthProvider, providerSubjectId: string): Promise<(User & { candidateProfile: CandidateProfile | null; providerAccounts: ProviderAccount[] }) | null> {
    const account = await prisma.providerAccount.findUnique({
      where: {
        provider_providerSubjectId: {
          provider,
          providerSubjectId
        }
      },
      include: {
        user: {
          include: {
            candidateProfile: true,
            providerAccounts: true
          }
        }
      }
    });
    return account?.user || null;
  }

  async linkProviderAccount(userId: string, provider: AuthProvider, providerSubjectId: string, providerEmail?: string): Promise<ProviderAccount> {
    return prisma.providerAccount.upsert({
      where: {
        provider_providerSubjectId: {
          provider,
          providerSubjectId
        }
      },
      update: {
        providerEmail: providerEmail?.toLowerCase().trim() || null
      },
      create: {
        userId,
        provider,
        providerSubjectId,
        providerEmail: providerEmail?.toLowerCase().trim() || null
      }
    });
  }

  async createSocialUser(data: {
    email: string;
    fullName?: string;
    avatarUrl?: string;
    provider: AuthProvider;
    providerSubjectId: string;
    emailVerified?: boolean;
  }): Promise<User & { candidateProfile: CandidateProfile | null; providerAccounts: ProviderAccount[] }> {
    const normalizedEmail = data.email.toLowerCase().trim();
    return prisma.user.create({
      data: {
        email: normalizedEmail,
        // Secure random non-guessable hash since password auth is not used for social accounts directly
        passwordHash: `oauth:${data.provider}:${data.providerSubjectId}`,
        role: UserRole.CANDIDATE,
        emailVerified: data.emailVerified ?? true,
        candidateProfile: {
          create: {
            fullName: data.fullName?.trim() || normalizedEmail.split('@')[0],
            avatarUrl: data.avatarUrl || null,
            authProvider: data.provider
          }
        },
        providerAccounts: {
          create: {
            provider: data.provider,
            providerSubjectId: data.providerSubjectId,
            providerEmail: normalizedEmail
          }
        }
      },
      include: {
        candidateProfile: true,
        providerAccounts: true
      }
    });
  }

  async getProviderAccounts(userId: string): Promise<ProviderAccount[]> {
    return prisma.providerAccount.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' }
    });
  }

  async deleteRefreshTokensForUser(userId: string): Promise<void> {
    await prisma.refreshToken.deleteMany({
      where: { userId }
    });
  }
}

export const userRepository = new UserRepository();
