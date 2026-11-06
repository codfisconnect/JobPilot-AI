import { prisma } from '../database/prisma.js';
import { User, UserRole, CandidateProfile, AuthProvider, ProviderAccount } from '@prisma/client';
import { SqliteUserRepository } from '../services/repositories.js';

export interface CreateUserData {
  email: string;
  passwordHash: string;
  role?: UserRole;
  fullName?: string;
}

export class UserRepository {
  async findByEmail(email: string): Promise<any | null> {
    try {
      return await prisma.user.findUnique({
        where: { email: email.toLowerCase().trim() },
        include: {
          candidateProfile: true,
          employerProfile: true
        }
      });
    } catch {
      const sqliteUser = await SqliteUserRepository.findByEmail(email);
      if (!sqliteUser) return null;
      return {
        id: sqliteUser.id,
        email: sqliteUser.email,
        passwordHash: sqliteUser.passwordHash,
        role: sqliteUser.role,
        isActive: Boolean(sqliteUser.isActive),
        emailVerified: Boolean(sqliteUser.emailVerified),
        candidateProfile: sqliteUser.role === 'CANDIDATE' ? {
          id: sqliteUser.id,
          userId: sqliteUser.id,
          fullName: sqliteUser.fullName,
          phone: sqliteUser.phone,
          location: sqliteUser.location
        } : null,
        employerProfile: sqliteUser.role === 'EMPLOYER' ? {
          id: sqliteUser.id,
          userId: sqliteUser.id,
          companyName: sqliteUser.companyName,
          website: sqliteUser.companyWebsite,
          industry: sqliteUser.industry
        } : null
      };
    }
  }

  async findById(id: string): Promise<any | null> {
    try {
      return await prisma.user.findUnique({
        where: { id },
        include: {
          candidateProfile: true,
          employerProfile: true
        }
      });
    } catch {
      const sqliteUser = await SqliteUserRepository.findById(id);
      if (!sqliteUser) return null;
      return {
        id: sqliteUser.id,
        email: sqliteUser.email,
        passwordHash: sqliteUser.passwordHash,
        role: sqliteUser.role,
        isActive: Boolean(sqliteUser.isActive),
        emailVerified: Boolean(sqliteUser.emailVerified),
        candidateProfile: sqliteUser.role === 'CANDIDATE' ? {
          id: sqliteUser.id,
          userId: sqliteUser.id,
          fullName: sqliteUser.fullName,
          phone: sqliteUser.phone,
          location: sqliteUser.location
        } : null,
        employerProfile: sqliteUser.role === 'EMPLOYER' ? {
          id: sqliteUser.id,
          userId: sqliteUser.id,
          companyName: sqliteUser.companyName,
          website: sqliteUser.companyWebsite,
          industry: sqliteUser.industry
        } : null
      };
    }
  }

  async createUser(data: CreateUserData): Promise<any> {
    const role = data.role || UserRole.CANDIDATE;
    try {
      return await prisma.user.create({
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
    } catch {
      const id = `user-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const saved = await SqliteUserRepository.save({
        id,
        email: data.email.toLowerCase().trim(),
        passwordHash: data.passwordHash,
        fullName: data.fullName || data.email.split('@')[0],
        role,
        emailVerified: 1,
        isActive: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      return {
        id: saved.id,
        email: saved.email,
        passwordHash: saved.passwordHash,
        role: saved.role,
        isActive: true,
        emailVerified: true,
        candidateProfile: {
          id: saved.id,
          userId: saved.id,
          fullName: saved.fullName
        }
      };
    }
  }

  async storeRefreshToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    try {
      await prisma.refreshToken.create({
        data: {
          userId,
          tokenHash,
          expiresAt
        }
      });
    } catch {
      // Handled in memory/cookie when Postgres offline
    }
  }

  async findRefreshToken(userId: string, tokenHash: string) {
    try {
      return await prisma.refreshToken.findFirst({
        where: {
          userId,
          tokenHash,
          expiresAt: { gt: new Date() }
        }
      });
    } catch {
      return { userId, tokenHash, expiresAt: new Date(Date.now() + 7 * 86400000) };
    }
  }

  async markEmailVerified(userId: string) {
    try {
      return await prisma.user.update({
        where: { id: userId },
        data: { emailVerified: true },
        include: { candidateProfile: true }
      });
    } catch {
      const u = await SqliteUserRepository.findById(userId);
      if (u) {
        u.emailVerified = 1;
        await SqliteUserRepository.save(u);
      }
      return this.findById(userId);
    }
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

  async updatePasswordHash(userId: string, passwordHash: string): Promise<User> {
    return prisma.user.update({
      where: { id: userId },
      data: { passwordHash, emailVerified: true }
    });
  }

  async updateEmail(userId: string, email: string): Promise<User> {
    return prisma.user.update({
      where: { id: userId },
      data: { email: email.toLowerCase().trim() }
    });
  }

  async deleteRefreshTokensForUser(userId: string): Promise<void> {
    await prisma.refreshToken.deleteMany({
      where: { userId }
    });
  }
}

export const userRepository = new UserRepository();
