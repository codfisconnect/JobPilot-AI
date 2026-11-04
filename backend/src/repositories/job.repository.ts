import { prisma } from '../database/prisma.js';
import { Job, JobStatus, RemoteType, EmploymentType, Prisma } from '@prisma/client';
import { NormalizedJobData } from '../services/jobNormalization.service.js';
import { logger } from '../utils/logger.js';

export interface JobSuggestionItem {
  label: string;
  value: string;
  category: 'SKILL' | 'TECHNOLOGY' | 'ROLE' | 'LOCATION' | 'COMPANY';
  id?: string;
  metadata?: any;
}

export interface JobFilterParams {
  query?: string;
  q?: string;
  title?: string;
  companyId?: string;
  companyName?: string;
  skill?: string;
  skills?: string[];
  roles?: string[];
  locations?: string[];
  companies?: string[];
  technologies?: string[];
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
  sortBy?: 'latest' | 'oldest' | 'salary' | 'relevance' | 'company' | 'location';
  page?: number;
  pageSize?: number;
  lightweight?: boolean;
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

    // Trigger asynchronous job alert relevance evaluation for genuinely new job
    import('../services/jobAlert.service.js')
      .then(({ JobAlertService }) => JobAlertService.evaluateAndEnqueue(created))
      .catch(err => {
        logger.warn(`[JobRepository] Background job alert evaluation skipped: ${err.message}`);
      });

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
  /**
   * Fast autocomplete suggestions across Skills, Roles, Locations, and Companies
   */
  public static async getSuggestions(query: string, categories?: string[]): Promise<JobSuggestionItem[]> {
    const q = query.trim();
    if (!q || q.length < 2) return [];

    const cats = categories && categories.length > 0 ? categories.map(c => c.toUpperCase()) : ['SKILL', 'TECHNOLOGY', 'ROLE', 'LOCATION', 'COMPANY'];
    const results: JobSuggestionItem[] = [];
    const seenValues = new Set<string>();
    const promises: Promise<void>[] = [];

    // 1. SKILLS & TECHNOLOGIES
    if (cats.includes('SKILL') || cats.includes('TECHNOLOGY')) {
      promises.push(
        prisma.skill.findMany({
          where: { name: { contains: q, mode: 'insensitive' } },
          select: { id: true, name: true, category: true },
          take: 8
        }).then(skills => {
          for (const s of skills) {
            const key = `skill:${s.name.toLowerCase()}`;
            if (!seenValues.has(key)) {
              seenValues.add(key);
              const isTech = s.category === 'TOOL';
              results.push({
                label: s.name,
                value: s.name,
                category: isTech ? 'TECHNOLOGY' : 'SKILL',
                id: s.id
              });
            }
          }
        }).catch(() => {})
      );
    }

    // 2. ROLES / TITLES
    if (cats.includes('ROLE')) {
      promises.push(
        prisma.job.findMany({
          where: {
            title: { contains: q, mode: 'insensitive' },
            status: JobStatus.ACTIVE
          },
          select: { title: true },
          distinct: ['title'],
          take: 6
        }).then(jobs => {
          for (const j of jobs) {
            const key = `role:${j.title.toLowerCase()}`;
            if (!seenValues.has(key)) {
              seenValues.add(key);
              results.push({
                label: j.title,
                value: j.title,
                category: 'ROLE'
              });
            }
          }
        }).catch(() => {})
      );
    }

    // 3. LOCATIONS
    if (cats.includes('LOCATION')) {
      promises.push(
        prisma.job.findMany({
          where: {
            OR: [
              { location: { contains: q, mode: 'insensitive' } },
              { city: { contains: q, mode: 'insensitive' } }
            ],
            status: JobStatus.ACTIVE
          },
          select: { location: true, city: true },
          distinct: ['location'],
          take: 6
        }).then(jobs => {
          for (const j of jobs) {
            const loc = j.location?.trim() || j.city?.trim();
            if (loc) {
              const key = `loc:${loc.toLowerCase()}`;
              if (!seenValues.has(key)) {
                seenValues.add(key);
                results.push({
                  label: loc,
                  value: loc,
                  category: 'LOCATION'
                });
              }
            }
          }
        }).catch(() => {})
      );
    }

    // 4. COMPANIES
    if (cats.includes('COMPANY')) {
      promises.push(
        prisma.company.findMany({
          where: { name: { contains: q, mode: 'insensitive' } },
          select: { id: true, name: true },
          take: 5
        }).then(companies => {
          for (const c of companies) {
            const key = `comp:${c.name.toLowerCase()}`;
            if (!seenValues.has(key)) {
              seenValues.add(key);
              results.push({
                label: c.name,
                value: c.name,
                category: 'COMPANY',
                id: c.id
              });
            }
          }
        }).catch(() => {})
      );
    }

    await Promise.all(promises);
    return results.slice(0, 15);
  }

  public static async searchJobs(params: JobFilterParams) {
    const page = Math.max(1, params.page || 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize || 20));
    const skip = (page - 1) * pageSize;

    const where: Prisma.JobWhereInput = {
      status: params.status || JobStatus.ACTIVE
    };

    const andConditions: Prisma.JobWhereInput[] = [];

    // Structured Skills/Technologies filter (OR within same category)
    const allSkills = [...(params.skills || []), ...(params.technologies || [])].filter(Boolean);
    if (allSkills.length > 0) {
      andConditions.push({
        OR: allSkills.map(sk => ({
          OR: [
            { skills: { some: { skill: { name: { contains: sk.trim(), mode: 'insensitive' } } } } },
            { description: { contains: sk.trim(), mode: 'insensitive' } },
            { title: { contains: sk.trim(), mode: 'insensitive' } }
          ]
        }))
      });
    }

    // Structured Roles filter (OR within same category)
    if (params.roles && params.roles.length > 0) {
      andConditions.push({
        OR: params.roles.map(r => ({
          title: { contains: r.trim(), mode: 'insensitive' }
        }))
      });
    }

    // Structured Locations filter (OR within same category)
    if (params.locations && params.locations.length > 0) {
      andConditions.push({
        OR: params.locations.map(loc => ({
          OR: [
            { location: { contains: loc.trim(), mode: 'insensitive' } },
            { city: { contains: loc.trim(), mode: 'insensitive' } },
            { stateProvince: { contains: loc.trim(), mode: 'insensitive' } },
            { country: { contains: loc.trim(), mode: 'insensitive' } }
          ]
        }))
      });
    }

    // Structured Companies filter (OR within same category)
    if (params.companies && params.companies.length > 0) {
      andConditions.push({
        OR: params.companies.map(c => ({
          company: { name: { contains: c.trim(), mode: 'insensitive' } }
        }))
      });
    }

    // Free text search fallback (OR across fields)
    const freeText = (params.q || params.query)?.trim();
    if (freeText) {
      andConditions.push({
        OR: [
          { title: { contains: freeText, mode: 'insensitive' } },
          { description: { contains: freeText, mode: 'insensitive' } },
          { location: { contains: freeText, mode: 'insensitive' } },
          { company: { name: { contains: freeText, mode: 'insensitive' } } },
          { skills: { some: { skill: { name: { contains: freeText, mode: 'insensitive' } } } } }
        ]
      });
    }

    if (andConditions.length > 0) {
      where.AND = andConditions;
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
    let orderBy: Prisma.JobOrderByWithRelationInput[] = [
      { postedAt: 'desc' },
      { createdAt: 'desc' }
    ];
    if (params.sortBy === 'oldest') {
      orderBy = [
        { postedAt: 'asc' },
        { createdAt: 'asc' }
      ];
    } else if (params.sortBy === 'salary') {
      orderBy = [
        { salaryMax: 'desc' },
        { createdAt: 'desc' }
      ];
    } else if (params.sortBy === 'company') {
      orderBy = [
        { company: { name: 'asc' } },
        { createdAt: 'desc' }
      ];
    } else if (params.sortBy === 'location') {
      orderBy = [
        { location: 'asc' },
        { createdAt: 'desc' }
      ];
    }

    const [total, rawItems] = await Promise.all([
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

    // When lightweight list view is requested (e.g. Dashboard cards), omit multi-kilobyte description text blobs
    const items = params.lightweight
      ? rawItems.map(j => ({
          ...j,
          description: j.description ? (j.description.length > 200 ? `${j.description.slice(0, 197)}...` : j.description) : '',
          responsibilities: [],
          requirements: [],
          preferredQualifications: []
        }))
      : rawItems;

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

  /**
   * Reconciles missing jobs specifically for a company and sourceType.
   * NEVER expires jobs from other companies or sources.
   * Expire only if lastSeenAt is older than thresholdDays.
   */
  public static async reconcileSourceJobs(
    companyId: string,
    sourceType: string,
    seenJobIds: string[],
    thresholdDays = 14
  ): Promise<{ activeCount: number; expiredCount: number }> {
    // 1. Find all ACTIVE jobs belonging to this company and sourceType
    const activeJobs = await prisma.job.findMany({
      where: {
        companyId,
        sourceType: sourceType.toUpperCase(),
        status: JobStatus.ACTIVE
      },
      select: {
        id: true,
        externalJobId: true,
        lastSeenAt: true
      }
    });

    const seenSet = new Set(seenJobIds);
    const cutoffDate = new Date(Date.now() - thresholdDays * 24 * 60 * 60 * 1000);
    let expiredCount = 0;

    for (const job of activeJobs) {
      const isSeen = seenSet.has(job.id);
      if (!isSeen) {
        // Missing from current sync! Update lastCheckedAt
        await prisma.job.update({
          where: { id: job.id },
          data: { lastCheckedAt: new Date() }
        });

        // If lastSeenAt exceeds stale threshold, mark EXPIRED
        if (job.lastSeenAt < cutoffDate) {
          await prisma.job.update({
            where: { id: job.id },
            data: { status: JobStatus.EXPIRED }
          });
          expiredCount++;
        }
      }
    }

    const currentActiveCount = await prisma.job.count({
      where: {
        companyId,
        sourceType: sourceType.toUpperCase(),
        status: JobStatus.ACTIVE
      }
    });

    return { activeCount: currentActiveCount, expiredCount };
  }
}
