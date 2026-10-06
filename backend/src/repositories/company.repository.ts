import { prisma } from '../database/prisma.js';
import { Company, CompanySource, SourceHealth } from '@prisma/client';

export interface CreateCompanyInput {
  name: string;
  officialDomain?: string;
  careersUrl?: string;
  industry?: string;
  country?: string;
  description?: string;
  logoUrl?: string;
  atsProvider?: string;
  atsIdentifier?: string;
  sourceType?: string;
}

export interface RegisterSourceInput {
  companyId: string;
  sourceType: string;
  sourceName: string;
  sourceUrl: string;
  externalIdentifier?: string;
}

export class CompanyRepository {
  /**
   * Find company by official domain (canonical resolution)
   */
  public static async findByDomain(domain: string): Promise<Company | null> {
    if (!domain) return null;
    return prisma.company.findUnique({
      where: { officialDomain: domain.toLowerCase() }
    });
  }

  /**
   * Find company by name (case insensitive)
   */
  public static async findByName(name: string): Promise<Company | null> {
    if (!name) return null;
    return prisma.company.findFirst({
      where: {
        name: {
          equals: name.trim(),
          mode: 'insensitive'
        }
      }
    });
  }

  /**
   * Resolve company: match by domain first, then exact canonical name, or create if non-existent
   */
  public static async resolveOrCreate(input: CreateCompanyInput): Promise<Company> {
    if (input.officialDomain) {
      const byDomain = await this.findByDomain(input.officialDomain);
      if (byDomain) return byDomain;
    }

    const byName = await this.findByName(input.name);
    if (byName) {
      // If the found company has an official domain, and input has a DIFFERENT official domain,
      // they are distinct companies (e.g. Acme Corp UK vs Acme Corp US). Do NOT merge!
      if (byName.officialDomain && input.officialDomain && byName.officialDomain.toLowerCase() !== input.officialDomain.toLowerCase()) {
        // Fall through to create distinct record
      } else {
        // If found by name and neither contradicts the domain, attach domain if previously missing
        if (input.officialDomain && !byName.officialDomain) {
          return prisma.company.update({
            where: { id: byName.id },
            data: { officialDomain: input.officialDomain.toLowerCase() }
          });
        }
        return byName;
      }
    }

    return prisma.company.create({
      data: {
        name: input.name.trim(),
        officialDomain: input.officialDomain?.toLowerCase(),
        careersUrl: input.careersUrl,
        industry: input.industry,
        country: input.country,
        description: input.description,
        logoUrl: input.logoUrl,
        atsProvider: input.atsProvider,
        atsIdentifier: input.atsIdentifier,
        sourceType: input.sourceType || 'EXTERNAL',
        lastVerifiedAt: new Date()
      }
    });
  }

  /**
   * Find or register a source for a company
   */
  public static async registerSource(input: RegisterSourceInput): Promise<CompanySource> {
    const existing = await prisma.companySource.findFirst({
      where: {
        companyId: input.companyId,
        sourceType: input.sourceType.toUpperCase(),
        externalIdentifier: input.externalIdentifier || null
      }
    });

    if (existing) {
      return prisma.companySource.update({
        where: { id: existing.id },
        data: {
          sourceUrl: input.sourceUrl,
          sourceName: input.sourceName,
          lastCheckedAt: new Date()
        }
      });
    }

    return prisma.companySource.create({
      data: {
        companyId: input.companyId,
        sourceType: input.sourceType.toUpperCase(),
        sourceName: input.sourceName,
        sourceUrl: input.sourceUrl,
        externalIdentifier: input.externalIdentifier || null,
        healthStatus: SourceHealth.HEALTHY,
        lastCheckedAt: new Date()
      }
    });
  }

  /**
   * Update source sync outcome (health tracking)
   */
  public static async updateSourceHealth(
    sourceId: string,
    success: boolean,
    error?: string
  ): Promise<CompanySource> {
    const source = await prisma.companySource.findUnique({ where: { id: sourceId } });
    if (!source) throw new Error(`Company source not found: ${sourceId}`);

    if (success) {
      return prisma.companySource.update({
        where: { id: sourceId },
        data: {
          lastCheckedAt: new Date(),
          lastSuccessfulSyncAt: new Date(),
          failureCount: 0,
          healthStatus: SourceHealth.HEALTHY
        }
      });
    } else {
      const newFailureCount = source.failureCount + 1;
      let healthStatus: SourceHealth = SourceHealth.DEGRADED;
      if (newFailureCount >= 3) {
        healthStatus = SourceHealth.FAILING;
      }

      return prisma.companySource.update({
        where: { id: sourceId },
        data: {
          lastCheckedAt: new Date(),
          lastFailureAt: new Date(),
          failureCount: newFailureCount,
          healthStatus
        }
      });
    }
  }

  public static async getCompanyWithSources(id: string) {
    return prisma.company.findUnique({
      where: { id },
      include: {
        sources: true,
        _count: {
          select: { jobs: true }
        }
      }
    });
  }

  public static async getAllCompanies(limit = 100) {
    return prisma.company.findMany({
      take: limit,
      include: {
        sources: true,
        _count: {
          select: { jobs: true }
        }
      },
      orderBy: { name: 'asc' }
    });
  }
}
