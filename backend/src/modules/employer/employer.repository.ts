import { prisma } from '../../database/prisma.js';
import {
  EmployerRole,
  EmployerJobStatus,
  EmployerApplicationStage,
  JobStatus
} from '@prisma/client';
import crypto from 'crypto';

export class EmployerRepository {
  /**
   * Find membership of a user in any organization
   */
  async findMemberByUserId(userId: string) {
    return prisma.employerMember.findFirst({
      where: { userId },
      include: { organization: true }
    });
  }

  /**
   * Find organization by ID
   */
  async findOrganizationById(organizationId: string) {
    return prisma.employerOrganization.findUnique({
      where: { id: organizationId },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, email: true }
            }
          }
        }
      }
    });
  }

  /**
   * Create employer organization and assign user as OWNER
   */
  async createOrganization(
    userId: string,
    data: {
      name: string;
      slug: string;
      domain?: string;
      website?: string;
      industry?: string;
      description?: string;
      headquarters?: string;
      logoUrl?: string;
    }
  ) {
    const db = prisma;
    return db.$transaction(async (tx) => {
      // Create or find matching company record to attach
      let company = null;
      if (data.domain) {
        company = await tx.company.findUnique({ where: { officialDomain: data.domain } });
      }
      if (!company) {
        company = await tx.company.create({
          data: {
            name: data.name,
            officialDomain: data.domain || null,
            careersUrl: data.website || null,
            industry: data.industry || null,
            description: data.description || null,
            logoUrl: data.logoUrl || null,
            sourceType: 'DIRECT'
          }
        });
      }

      const organization = await tx.employerOrganization.create({
        data: {
          name: data.name,
          slug: data.slug,
          domain: data.domain || null,
          website: data.website || null,
          industry: data.industry || null,
          description: data.description || null,
          headquarters: data.headquarters || null,
          logoUrl: data.logoUrl || null,
          companyId: company.id
        }
      });

      const member = await tx.employerMember.create({
        data: {
          organizationId: organization.id,
          userId,
          role: EmployerRole.OWNER,
          title: 'Organization Owner'
        }
      });

      // Update User role to EMPLOYER if not already
      await tx.user.update({
        where: { id: userId },
        data: { role: 'EMPLOYER' }
      });

      return { organization, member };
    });
  }

  /**
   * Get organization dashboard summary stats
   */
  async getDashboardMetrics(organizationId: string) {
    const db = prisma;
    const [totalJobs, activeJobs, draftJobs, closedJobs] = await Promise.all([
      db.job.count({ where: { organizationId } }),
      db.job.count({ where: { organizationId, organizationJobStatus: EmployerJobStatus.PUBLISHED } }),
      db.job.count({ where: { organizationId, organizationJobStatus: EmployerJobStatus.DRAFT } }),
      db.job.count({ where: { organizationId, organizationJobStatus: EmployerJobStatus.CLOSED } })
    ]);

    // Aggregate applicants for all jobs belonging to this org
    const orgJobs = await db.job.findMany({
      where: { organizationId },
      select: { id: true }
    });
    const jobIds = orgJobs.map((j) => j.id);

    const totalApplicants = await db.application.count({
      where: { jobId: { in: jobIds } }
    });

    const newApplicants = await db.employerApplicationReview.count({
      where: {
        application: { jobId: { in: jobIds } },
        stage: EmployerApplicationStage.NEW
      }
    });

    return {
      jobs: {
        total: totalJobs,
        active: activeJobs,
        draft: draftJobs,
        closed: closedJobs
      },
      applicants: {
        total: totalApplicants,
        new: newApplicants
      }
    };
  }

  /**
   * List jobs for employer organization
   */
  async listOrganizationJobs(organizationId: string) {
    const db = prisma;
    const jobs = await db.job.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { applications: true }
        }
      }
    });

    return jobs.map((job) => ({
      ...job,
      applicantCount: job._count.applications
    }));
  }

  /**
   * Find specific job owned by organization
   */
  async findOrganizationJob(organizationId: string, jobId: string) {
    const db = prisma;
    return db.job.findFirst({
      where: {
        id: jobId,
        organizationId
      },
      include: {
        skills: {
          include: { skill: true }
        },
        _count: {
          select: { applications: true }
        }
      }
    });
  }

  /**
   * Create employer job
   */
  async createEmployerJob(
    organizationId: string,
    companyId: string,
    data: any
  ) {
    const db = prisma;
    const contentHash = crypto
      .createHash('sha256')
      .update(`${organizationId}-${data.title}-${Date.now()}`)
      .digest('hex');

    return db.job.create({
      data: {
        companyId,
        organizationId,
        organizationJobStatus: EmployerJobStatus.DRAFT,
        sourceType: 'DIRECT',
        sourceName: 'Employer Direct Post',
        sourceUrl: '',
        title: data.title,
        description: data.description,
        requirements: data.requirements || [],
        responsibilities: data.responsibilities || [],
        preferredQualifications: data.preferredQualifications || [],
        location: data.location || null,
        country: data.country || null,
        city: data.city || null,
        remoteType: data.remoteType,
        employmentType: data.employmentType,
        salaryMin: data.salaryMin || null,
        salaryMax: data.salaryMax || null,
        salaryCurrency: data.salaryCurrency || 'USD',
        experienceMin: data.experienceMin || null,
        experienceMax: data.experienceMax || null,
        contentHash,
        status: JobStatus.ACTIVE
      }
    });
  }

  /**
   * Update organization job
   */
  async updateEmployerJob(organizationId: string, jobId: string, data: any) {
    const db = prisma;
    return db.job.update({
      where: { id: jobId },
      data: {
        title: data.title,
        description: data.description,
        requirements: data.requirements,
        responsibilities: data.responsibilities,
        preferredQualifications: data.preferredQualifications,
        location: data.location,
        country: data.country,
        city: data.city,
        remoteType: data.remoteType,
        employmentType: data.employmentType,
        salaryMin: data.salaryMin,
        salaryMax: data.salaryMax,
        salaryCurrency: data.salaryCurrency,
        experienceMin: data.experienceMin,
        experienceMax: data.experienceMax
      }
    });
  }

  /**
   * Update employer job publication lifecycle status
   */
  async updateJobLifecycleStatus(
    organizationId: string,
    jobId: string,
    status: EmployerJobStatus
  ) {
    const db = prisma;
    return db.job.update({
      where: { id: jobId },
      data: {
        organizationJobStatus: status,
        status: status === EmployerJobStatus.PUBLISHED ? JobStatus.ACTIVE : JobStatus.CLOSED,
        postedAt: status === EmployerJobStatus.PUBLISHED ? new Date() : undefined
      }
    });
  }

  /**
   * List applicants for a specific organization job
   */
  async listJobApplications(organizationId: string, jobId: string) {
    const db = prisma;
    return db.application.findMany({
      where: {
        jobId,
        job: { organizationId }
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        appliedAt: true,
        createdAt: true,
        candidateProfile: {
          select: {
            id: true,
            fullName: true,
            headline: true,
            location: true,
            email: true
          }
        },
        resumeVersion: {
          select: {
            id: true,
            versionName: true,
            summary: true,
            pdfPath: true,
            structuredContent: true
          }
        },
        reviews: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });
  }

  /**
   * Get single application detail for employer
   */
  async findApplicationDetail(organizationId: string, applicationId: string) {
    const db = prisma;
    return db.application.findFirst({
      where: {
        id: applicationId,
        job: { organizationId }
      },
      select: {
        id: true,
        status: true,
        appliedAt: true,
        notesSummary: true,
        createdAt: true,
        job: {
          select: {
            id: true,
            title: true,
            location: true,
            organizationId: true
          }
        },
        candidateProfile: {
          select: {
            id: true,
            fullName: true,
            headline: true,
            email: true,
            phone: true,
            location: true,
            summary: true
          }
        },
        resumeVersion: {
          select: {
            id: true,
            versionName: true,
            summary: true,
            structuredContent: true,
            pdfPath: true,
            atsScore: true
          }
        },
        reviews: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });
  }

  /**
   * Update organization careers URL and link company
   */
  async updateCareersUrl(organizationId: string, careersUrl: string) {
    const db = prisma;
    const org = await db.employerOrganization.findUnique({
      where: { id: organizationId }
    });
    if (!org) return null;

    if (org.companyId) {
      await db.company.update({
        where: { id: org.companyId },
        data: { careersUrl }
      });
    }

    return db.employerOrganization.update({
      where: { id: organizationId },
      data: { website: careersUrl }
    });
  }

  /**
   * Search candidates (verified employers with consent-based profiles)
   */
  async searchCandidates(params: {
    query?: string;
    skills?: string;
    location?: string;
    page: number;
    limit: number;
  }) {
    const db = prisma;
    const skip = (params.page - 1) * params.limit;
    const where: any = {};

    if (params.location) {
      where.location = { contains: params.location, mode: 'insensitive' };
    }

    if (params.query) {
      where.OR = [
        { fullName: { contains: params.query, mode: 'insensitive' } },
        { headline: { contains: params.query, mode: 'insensitive' } },
        { summary: { contains: params.query, mode: 'insensitive' } }
      ];
    }

    if (params.skills) {
      const skillTerms = params.skills.split(',').map(s => s.trim()).filter(Boolean);
      if (skillTerms.length > 0) {
        where.skills = {
          some: {
            skill: {
              name: { in: skillTerms, mode: 'insensitive' }
            }
          }
        };
      }
    }

    const [items, total] = await Promise.all([
      db.candidateProfile.findMany({
        where,
        skip,
        take: params.limit,
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          fullName: true,
          headline: true,
          location: true,
          country: true,
          city: true,
          summary: true,
          skills: {
            take: 12,
            select: {
              skill: { select: { id: true, name: true, category: true } }
            }
          },
          experiences: {
            take: 3,
            orderBy: { startDate: 'desc' },
            select: {
              company: true,
              jobTitle: true,
              startDate: true,
              endDate: true,
              isCurrent: true
            }
          },
          educations: {
            take: 2,
            select: {
              institution: true,
              degree: true,
              fieldOfStudy: true
            }
          }
        }
      }),
      db.candidateProfile.count({ where })
    ]);

    return {
      candidates: items,
      pagination: {
        page: params.page,
        limit: params.limit,
        total,
        totalPages: Math.ceil(total / params.limit)
      }
    };
  }

  /**
   * List team members
   */
  async listMembers(organizationId: string) {
    const db = prisma;
    return db.employerMember.findMany({
      where: { organizationId },
      include: {
        user: { select: { id: true, email: true, createdAt: true } }
      },
      orderBy: { joinedAt: 'asc' }
    });
  }

  /**
   * Add member to organization
   */
  async addMember(organizationId: string, userEmail: string, role: EmployerRole, title?: string) {
    const db = prisma;
    let user = await db.user.findUnique({ where: { email: userEmail } });
    if (!user) {
      // Create user placeholder for invitee
      user = await db.user.create({
        data: {
          email: userEmail,
          passwordHash: 'INVITED_PENDING_ACTIVATION',
          role: 'EMPLOYER'
        }
      });
    }

    return db.employerMember.create({
      data: {
        organizationId,
        userId: user.id,
        role,
        title: title || role
      },
      include: {
        user: { select: { id: true, email: true } }
      }
    });
  }

  /**
   * Update or create application review stage/notes
   */
  async recordApplicationReview(
    applicationId: string,
    reviewerId: string,
    data: { stage?: EmployerApplicationStage; rating?: number; notes?: string }
  ) {
    const db = prisma;
    return db.employerApplicationReview.create({
      data: {
        applicationId,
        reviewerId,
        stage: data.stage || EmployerApplicationStage.SCREENING,
        rating: data.rating,
        notes: data.notes
      }
    });
  }
}


