import { prisma } from '../database/prisma.js';
import { Job, JobStatus, RemoteType, EmploymentType, Prisma } from '@prisma/client';
import { NormalizedJobData } from '../services/jobNormalization.service.js';

export interface JobFilterParams {
  query?: string;
  title?: string;
  companyId?: string;
  companyName?: string;
  skill?: string;
  location?: string;
  country?: string;
  city?: string;
  remoteType?: RemoteType;
  employmentType?: EmploymentType;
  experienceMin?: number;
  experienceMax?: number;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  postedAfter?: Date;
  postedBefore?: Date;
  sourceType?: string;
  status?: JobStatus;
  sortBy?: 'latest' | 'salary' | 'relevance';
  page?: number;
  pageSize?: number;
}

export class JobRepositoryV1 {
  /**
   * Find job by content hash (deduplication check)
   */
  public static async findByContentHash(contentHash: string): Promise<Job | null> {
    return prisma.job.findUnique({
      where: { contentHash },
      include: {
        company: true,
        skills: { include: { skill: true } }
      }
    });
  }

  /**
   * Find job by externalJobId and sourceType
   */
  public static async findByExternalId(sourceType: string, externalJobId: string): Promise<Job | null> {
    return prisma.job.findFirst({
      where: {
        sourceType: sourceType.toUpperCase(),
        externalJobId
      },
      include: {
        company: true,
        skills: { include: { skill: true } }
      }
    });
  }

  /**
   * Upsert job:
   * 1. Check if job with (sourceType, externalJobId) exists -> update freshness & attributes
   * 2. Else check if job with same contentHash exists -> update freshness
   * 3. Else insert new Job with associated JobSkill records
   */
  public static async upsertNormalizedJob(
    companyId: string,
    data: NormalizedJobData
  ): Promise<{ job: Job; isNew: boolean }> {
    let existing: Job | null = null;

    if (data.externalJobId) {
      existing = await prisma.job.findFirst({
        where: {
          sourceType: data.sourceType,
          externalJobId: data.externalJobId
        }
      });
    }

    if (!existing) {
      existing = await prisma.job.findUnique({
        where: { contentHash: data.contentHash }
      });
    }

    if (existing) {
      // Update freshness timestamps and sync mutable fields
      const updated = await prisma.job.update({
        where: { id: existing.id },
        data: {
          lastSeenAt: new Date(),
          lastCheckedAt: new Date(),
          status: JobStatus.ACTIVE,
          applicationUrl: data.applicationUrl || existing.applicationUrl,
          sourceUrl: data.sourceUrl || existing.sourceUrl,
          title: data.title,
          description: data.description,
          location: data.location || existing.location,
          country: data.country || existing.country,
          city: data.city || existing.city,
          stateProvince: data.stateProvince || existing.stateProvince,
          remoteType: data.remoteType,
          employmentType: data.employmentType,
          salaryMin: data.salaryMin !== undefined ? data.salaryMin : existing.salaryMin,
          salaryMax: data.salaryMax !== undefined ? data.salaryMax : existing.salaryMax,
          salaryCurrency: data.salaryCurrency || existing.salaryCurrency,
          experienceMin: data.experienceMin !== undefined ? data.experienceMin : existing.experienceMin,
          experienceMax: data.experienceMax !== undefined ? data.experienceMax : existing.experienceMax
        }
      });
      return { job: updated, isNew: false };
    }

    // Create new Job
    const created = await prisma.job.create({
      data: {
        companyId,
        externalJobId: data.externalJobId,
        sourceType: data.sourceType,
        sourceName: data.sourceName,
        sourceUrl: data.sourceUrl,
        applicationUrl: data.applicationUrl,
        title: data.title,
        description: data.description,
        responsibilities: data.responsibilities,
        requirements: data.requirements,
        preferredQualifications: data.preferredQualifications,
        location: data.location,
        country: data.country,
        city: data.city,
        stateProvince: data.stateProvince,
        remoteType: data.remoteType,
        employmentType: data.employmentType,
        salaryMin: data.salaryMin,
        salaryMax: data.salaryMax,
        salaryCurrency: data.salaryCurrency,
        experienceMin: data.experienceMin,
        experienceMax: data.experienceMax,
        education: data.education,
        postedAt: data.postedAt || new Date(),
        firstSeenAt: new Date(),
        lastSeenAt: new Date(),
        lastCheckedAt: new Date(),
        contentHash: data.contentHash,
        status: JobStatus.ACTIVE
      }
    });

    // Link skills
    if (data.skills && data.skills.length > 0) {
      for (const skillItem of data.skills) {
        try {
          const canonicalSkill = await prisma.skill.upsert({
            where: { name: skillItem.name },
            create: { name: skillItem.name, category: 'TECHNICAL' },
            update: {}
          });

          await prisma.jobSkill.upsert({
            where: {
              jobId_skillId: {
                jobId: created.id,
                skillId: canonicalSkill.id
              }
            },
            create: {
              jobId: created.id,
              skillId: canonicalSkill.id,
              skillType: skillItem.type
            },
            update: {
              skillType: skillItem.type
            }
          });
        } catch {
          // Ignore individual skill conflict during concurrent insertion
        }
      }
    }

    return { job: created, isNew: true };
  }

  /**
   * Find job by ID with full details (excluding sensitive internals)
   */
  public static async findById(id: string) {
    return prisma.job.findUnique({
      where: { id },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            officialDomain: true,
            careersUrl: true,
            industry: true,
            country: true,
            description: true,
            logoUrl: true
          }
        },
        skills: {
          include: {
            skill: {
              select: {
                id: true,
                name: true,
                category: true
              }
            }
          }
        }
      }
    });
  }

  /**
   * Search and filter jobs using PostgreSQL indexes and pagination
   */
  public static async searchJobs(params: JobFilterParams) {
    const page = Math.max(1, params.page || 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize || 20));
    const skip = (page - 1) * pageSize;

    const where: Prisma.JobWhereInput = {
      status: params.status || JobStatus.ACTIVE
    };

    if (params.query) {
      const q = params.query.trim();
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { location: { contains: q, mode: 'insensitive' } },
        { company: { name: { contains: q, mode: 'insensitive' } } }
      ];
    }

    if (params.title) {
      where.title = { contains: params.title.trim(), mode: 'insensitive' };
    }

    if (params.companyId) {
      where.companyId = params.companyId;
    }

    if (params.companyName) {
      where.company = { name: { contains: params.companyName.trim(), mode: 'insensitive' } };
    }

    if (params.country) {
      where.country = { contains: params.country.trim(), mode: 'insensitive' };
    }

    if (params.city) {
      where.city = { contains: params.city.trim(), mode: 'insensitive' };
    }

    if (params.location) {
      where.location = { contains: params.location.trim(), mode: 'insensitive' };
    }

    if (params.remoteType) {
      where.remoteType = params.remoteType;
    }

    if (params.employmentType) {
      where.employmentType = params.employmentType;
    }

    if (params.sourceType) {
      where.sourceType = params.sourceType.toUpperCase();
    }

    if (params.salaryCurrency) {
      where.salaryCurrency = params.salaryCurrency.toUpperCase();
    }

    if (params.experienceMin !== undefined) {
      where.experienceMin = { gte: params.experienceMin };
    }

    if (params.experienceMax !== undefined) {
      where.experienceMax = { lte: params.experienceMax };
    }

    if (params.salaryMin !== undefined) {
      where.salaryMin = { gte: params.salaryMin };
    }

    if (params.postedAfter) {
      where.postedAt = { gte: params.postedAfter };
    }

    if (params.skill) {
      where.skills = {
        some: {
          skill: {
            name: { contains: params.skill.trim(), mode: 'insensitive' }
          }
        }
      };
    }

    // Determine sorting
    let orderBy: Prisma.JobOrderByWithRelationInput = { postedAt: 'desc' };
    if (params.sortBy === 'salary') {
      orderBy = { salaryMax: 'desc' };
    }

    const [total, items] = await Promise.all([
      prisma.job.count({ where }),
      prisma.job.findMany({
        where,
        skip,
        take: pageSize,
        orderBy,
        include: {
          company: {
            select: {
              id: true,
              name: true,
              officialDomain: true,
              logoUrl: true,
              industry: true
            }
          },
          skills: {
            include: {
              skill: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          }
        }
      })
    ]);

    return {
      items,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    };
  }

  /**
   * Mark jobs as EXPIRED if not seen within the grace period (e.g. 14 days)
   */
  public static async expireStaleJobs(thresholdDays = 14): Promise<number> {
    const cutoffDate = new Date(Date.now() - thresholdDays * 24 * 60 * 60 * 1000);
    const result = await prisma.job.updateMany({
      where: {
        status: JobStatus.ACTIVE,
        lastSeenAt: { lt: cutoffDate }
      },
      data: {
        status: JobStatus.EXPIRED
      }
    });
    return result.count;
  }
}
