import { prisma } from '../../database/prisma.js';
import { UserRole } from '@prisma/client';

export class AdminRepository {
  // 1. Metrics & Aggregates
  async getDashboardMetrics() {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const [
      totalCandidates,
      candidatesToday,
      candidatesThisWeek,
      candidatesWithResumes,
      totalActiveJobs,
      totalApplications,
      totalEmployers,
      activeSubscriptions,
      paymentsSummary,
      creditsSummary
    ] = await Promise.all([
      // Total candidates registered
      prisma.user.count({
        where: { role: UserRole.CANDIDATE }
      }),
      // Candidates registered today
      prisma.user.count({
        where: {
          role: UserRole.CANDIDATE,
          createdAt: { gte: startOfToday }
        }
      }),
      // Candidates registered this week
      prisma.user.count({
        where: {
          role: UserRole.CANDIDATE,
          createdAt: { gte: startOfWeek }
        }
      }),
      // Candidates who have uploaded at least 1 resume
      prisma.candidateProfile.count({
        where: {
          resumes: { some: {} }
        }
      }),
      // Active jobs
      prisma.job.count({
        where: { status: 'ACTIVE' }
      }),
      // Total applications
      prisma.application.count(),
      // Total employers
      prisma.employerOrganization.count(),
      // Active subscriptions
      prisma.subscription.count({
        where: { status: 'ACTIVE' }
      }),
      // Revenue / payments aggregation (only captured/successful payments)
      prisma.payment.aggregate({
        where: { status: 'CAPTURED' },
        _sum: { amount: true },
        _count: { id: true }
      }),
      // Credit wallet summary
      prisma.creditWallet.aggregate({
        _sum: {
          balance: true,
          lifetimeGranted: true,
          lifetimeConsumed: true
        }
      })
    ]);

    return {
      totalCandidates,
      candidatesToday,
      candidatesThisWeek,
      candidatesWithResumes,
      totalActiveJobs,
      totalApplications,
      totalEmployers,
      activeSubscriptions,
      paymentsSummary: {
        totalRevenue: Number(paymentsSummary._sum.amount || 0),
        successfulPaymentsCount: paymentsSummary._count.id || 0
      },
      creditsSummary: {
        totalBalance: creditsSummary._sum.balance || 0,
        lifetimeGranted: creditsSummary._sum.lifetimeGranted || 0,
        lifetimeConsumed: creditsSummary._sum.lifetimeConsumed || 0
      }
    };
  }

  // 2. Candidates
  async getCandidates(params: { page: number; pageSize: number; search?: string }) {
    const { page, pageSize, search } = params;
    const skip = (page - 1) * pageSize;

    const where: any = { role: UserRole.CANDIDATE };
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { candidateProfile: { fullName: { contains: search, mode: 'insensitive' } } }
      ];
    }

    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          role: true,
          isActive: true,
          emailVerified: true,
          createdAt: true,
          candidateProfile: {
            select: {
              id: true,
              fullName: true,
              headline: true,
              location: true,
              _count: {
                select: {
                  resumes: true,
                  experiences: true,
                  skills: true,
                  educations: true,
                  projects: true,
                  certifications: true,
                  applications: true
                }
              }
            }
          },
          subscriptions: {
            where: { status: 'ACTIVE' },
            take: 1,
            select: {
              id: true,
              status: true,
              plan: {
                select: {
                  name: true,
                  code: true
                }
              }
            }
          },
          creditWallet: {
            select: {
              balance: true
            }
          }
        }
      }),
      prisma.user.count({ where })
    ]);

    return {
      items: items.map(u => ({
        id: u.id,
        email: u.email,
        isActive: u.isActive,
        emailVerified: u.emailVerified,
        createdAt: u.createdAt,
        candidateProfileId: u.candidateProfile?.id || null,
        fullName: u.candidateProfile?.fullName || 'Incomplete Profile',
        headline: u.candidateProfile?.headline || null,
        location: u.candidateProfile?.location || null,
        resumeCount: u.candidateProfile?._count.resumes || 0,
        applicationCount: u.candidateProfile?._count.applications || 0,
        experienceCount: u.candidateProfile?._count.experiences || 0,
        skillsCount: u.candidateProfile?._count.skills || 0,
        subscriptionPlan: u.subscriptions[0]?.plan?.name || 'Free',
        subscriptionStatus: u.subscriptions[0]?.status || 'INACTIVE',
        creditBalance: u.creditWallet?.balance || 0
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    };
  }

  async getCandidateById(userId: string) {
    const user = await prisma.user.findFirst({
      where: { id: userId, role: UserRole.CANDIDATE },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        emailVerified: true,
        createdAt: true,
        candidateProfile: {
          include: {
            experiences: { orderBy: { displayOrder: 'asc' } },
            educations: { orderBy: { startDate: 'desc' } },
            skills: { include: { skill: true } },
            certifications: { orderBy: { issueDate: 'desc' } },
            projects: { orderBy: { displayOrder: 'asc' } },
            resumes: {
              orderBy: { uploadedAt: 'desc' },
              include: {
                versions: {
                  orderBy: { versionNumber: 'desc' },
                  select: {
                    id: true,
                    versionNumber: true,
                    title: true,
                    strategy: true,
                    atsScore: true,
                    createdAt: true
                  }
                }
              }
            },
            preferences: true,
            applications: {
              orderBy: { createdAt: 'desc' },
              include: {
                job: {
                  select: {
                    id: true,
                    title: true,
                    company: { select: { id: true, name: true } }
                  }
                },
                resumeVersion: {
                  select: {
                    id: true,
                    versionNumber: true,
                    title: true
                  }
                }
              }
            },
            savedJobs: {
              orderBy: { savedAt: 'desc' },
              include: {
                job: {
                  select: {
                    id: true,
                    title: true,
                    company: { select: { id: true, name: true } }
                  }
                }
              }
            },
            interviewSessions: {
              orderBy: { createdAt: 'desc' },
              include: {
                job: { select: { id: true, title: true } },
                _count: { select: { questions: true } }
              }
            },
            learningPlans: {
              orderBy: { createdAt: 'desc' },
              include: {
                items: true
              }
            }
          }
        },
        subscriptions: {
          orderBy: { createdAt: 'desc' },
          include: { plan: true }
        },
        creditWallet: true,
        creditLedgers: {
          orderBy: { createdAt: 'desc' },
          take: 10
        },
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            providerPaymentId: true,
            amount: true,
            currency: true,
            status: true,
            createdAt: true,
            plan: { select: { name: true } }
          }
        }
      }
    });

    return user;
  }

  // 3. Resumes
  async getResumes(params: { page: number; pageSize: number; search?: string; status?: string }) {
    const { page, pageSize, search, status } = params;
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (status && status !== 'ALL') {
      where.status = status;
    }
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { originalFileName: { contains: search, mode: 'insensitive' } },
        { candidateProfile: { fullName: { contains: search, mode: 'insensitive' } } },
        { candidateProfile: { user: { email: { contains: search, mode: 'insensitive' } } } }
      ];
    }

    const [items, total] = await Promise.all([
      prisma.resume.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { uploadedAt: 'desc' },
        select: {
          id: true,
          title: true,
          originalFileName: true,
          status: true,
          source: true,
          fileSize: true,
          mimeType: true,
          isMaster: true,
          uploadedAt: true,
          parsedAt: true,
          updatedAt: true,
          candidateProfile: {
            select: {
              id: true,
              fullName: true,
              user: { select: { id: true, email: true } }
            }
          },
          _count: {
            select: {
              versions: true
            }
          }
        }
      }),
      prisma.resume.count({ where })
    ]);

    return {
      items: items.map(r => ({
        id: r.id,
        title: r.title || r.originalFileName || 'Untitled Resume',
        originalFileName: r.originalFileName,
        status: r.status,
        source: r.source,
        fileSize: r.fileSize,
        mimeType: r.mimeType,
        isMaster: r.isMaster,
        uploadedAt: r.uploadedAt,
        parsedAt: r.parsedAt,
        updatedAt: r.updatedAt,
        versionCount: r._count.versions,
        candidateName: r.candidateProfile?.fullName || 'Unknown Candidate',
        candidateEmail: r.candidateProfile?.user?.email || '',
        candidateUserId: r.candidateProfile?.user?.id || ''
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    };
  }

  // 4. Jobs
  async getJobs(params: { page: number; pageSize: number; search?: string; status?: string; source?: string; company?: string }) {
    const { page, pageSize, search, status, source, company } = params;
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (status && status !== 'ALL') {
      where.status = status;
    }
    if (source) {
      where.sourceType = { contains: source, mode: 'insensitive' };
    }
    if (company) {
      where.company = { name: { contains: company, mode: 'insensitive' } };
    }
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { location: { contains: search, mode: 'insensitive' } },
        { company: { name: { contains: search, mode: 'insensitive' } } }
      ];
    }

    const [items, total] = await Promise.all([
      prisma.job.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          location: true,
          remoteType: true,
          employmentType: true,
          status: true,
          sourceType: true,
          sourceName: true,
          sourceUrl: true,
          firstSeenAt: true,
          lastSeenAt: true,
          createdAt: true,
          company: {
            select: {
              id: true,
              name: true,
              officialDomain: true
            }
          },
          _count: {
            select: {
              applications: true
            }
          }
        }
      }),
      prisma.job.count({ where })
    ]);

    return {
      items: items.map(j => ({
        id: j.id,
        title: j.title,
        location: j.location,
        remoteType: j.remoteType,
        employmentType: j.employmentType,
        status: j.status,
        sourceType: j.sourceType,
        sourceName: j.sourceName,
        sourceUrl: j.sourceUrl,
        firstSeenAt: j.firstSeenAt,
        lastSeenAt: j.lastSeenAt,
        createdAt: j.createdAt,
        companyName: j.company?.name || 'Unknown Company',
        companyId: j.company?.id || '',
        applicationCount: j._count.applications
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    };
  }

  // 5. Applications
  async getApplications(params: { page: number; pageSize: number; search?: string; status?: string }) {
    const { page, pageSize, search, status } = params;
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (status && status !== 'ALL') {
      where.status = status;
    }
    if (search) {
      where.OR = [
        { candidateProfile: { user: { email: { contains: search, mode: 'insensitive' } } } },
        { candidateProfile: { fullName: { contains: search, mode: 'insensitive' } } },
        { job: { title: { contains: search, mode: 'insensitive' } } },
        { job: { company: { name: { contains: search, mode: 'insensitive' } } } }
      ];
    }

    const [items, total] = await Promise.all([
      prisma.application.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          status: true,
          appliedAt: true,
          createdAt: true,
          updatedAt: true,
          candidateProfile: {
            select: {
              id: true,
              fullName: true,
              user: {
                select: {
                  id: true,
                  email: true
                }
              }
            }
          },
          job: {
            select: {
              id: true,
              title: true,
              company: { select: { id: true, name: true } }
            }
          },
          resumeVersion: {
            select: {
              id: true,
              versionNumber: true,
              title: true
            }
          }
        }
      }),
      prisma.application.count({ where })
    ]);

    return {
      items: items.map(a => ({
        id: a.id,
        status: a.status,
        appliedAt: a.appliedAt,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
        candidateName: a.candidateProfile?.fullName || a.candidateProfile?.user?.email || 'Unknown',
        candidateEmail: a.candidateProfile?.user?.email || '',
        candidateId: a.candidateProfile?.user?.id || '',
        jobTitle: a.job.title,
        jobId: a.job.id,
        companyName: a.job.company.name,
        resumeVersionTitle: a.resumeVersion ? `v${a.resumeVersion.versionNumber}: ${a.resumeVersion.title}` : 'None'
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    };
  }

  // 6. Employers
  async getEmployers(params: { page: number; pageSize: number; search?: string }) {
    const { page, pageSize, search } = params;
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { domain: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [items, total] = await Promise.all([
      prisma.employerOrganization.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          domain: true,
          industry: true,
          website: true,
          verificationStatus: true,
          createdAt: true,
          members: {
            select: {
              id: true,
              role: true,
              user: {
                select: {
                  id: true,
                  email: true
                }
              }
            }
          },
          _count: {
            select: {
              jobs: true
            }
          }
        }
      }),
      prisma.employerOrganization.count({ where })
    ]);

    return {
      items: items.map(org => ({
        id: org.id,
        name: org.name,
        domain: org.domain || org.website,
        industry: org.industry,
        verificationStatus: org.verificationStatus,
        createdAt: org.createdAt,
        memberCount: org.members.length,
        jobCount: org._count.jobs,
        primaryContact: org.members[0]?.user?.email || 'None'
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    };
  }

  // 7. Payments
  async getPayments(params: { page: number; pageSize: number; search?: string; status?: string }) {
    const { page, pageSize, search, status } = params;
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (status && status !== 'ALL') {
      where.status = status;
    }
    if (search) {
      where.OR = [
        { providerPaymentId: { contains: search, mode: 'insensitive' } },
        { providerOrderId: { contains: search, mode: 'insensitive' } },
        { user: { email: { contains: search, mode: 'insensitive' } } }
      ];
    }

    const [items, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          providerPaymentId: true,
          providerOrderId: true,
          amount: true,
          currency: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          user: {
            select: {
              id: true,
              email: true,
              candidateProfile: { select: { fullName: true } }
            }
          },
          plan: {
            select: {
              name: true,
              code: true
            }
          }
        }
      }),
      prisma.payment.count({ where })
    ]);

    return {
      items: items.map(p => ({
        id: p.id,
        paymentId: p.providerPaymentId,
        orderId: p.providerOrderId,
        amount: Number(p.amount),
        currency: p.currency,
        status: p.status,
        createdAt: p.createdAt,
        userEmail: p.user.email,
        userName: p.user.candidateProfile?.fullName || p.user.email,
        planName: p.plan?.name || 'Top-up / Custom'
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    };
  }

  // 8. Subscriptions
  async getSubscriptions(params: { page: number; pageSize: number; search?: string; status?: string }) {
    const { page, pageSize, search, status } = params;
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (status && status !== 'ALL') {
      where.status = status;
    }
    if (search) {
      where.user = { email: { contains: search, mode: 'insensitive' } };
    }

    const [items, total] = await Promise.all([
      prisma.subscription.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          status: true,
          currentPeriodStart: true,
          currentPeriodEnd: true,
          cancelledAt: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              email: true,
              candidateProfile: { select: { fullName: true } },
              creditWallet: { select: { balance: true } }
            }
          },
          plan: {
            select: {
              name: true,
              code: true,
              price: true,
              billingInterval: true,
              creditAllowance: true
            }
          }
        }
      }),
      prisma.subscription.count({ where })
    ]);

    return {
      items: items.map(s => ({
        id: s.id,
        status: s.status,
        currentPeriodStart: s.currentPeriodStart,
        currentPeriodEnd: s.currentPeriodEnd,
        cancelledAt: s.cancelledAt,
        createdAt: s.createdAt,
        userName: s.user.candidateProfile?.fullName || s.user.email,
        userEmail: s.user.email,
        userId: s.user.id,
        planName: s.plan.name,
        planCode: s.plan.code,
        price: Number(s.plan.price),
        interval: s.plan.billingInterval,
        creditBalance: s.user.creditWallet?.balance || 0
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    };
  }

  // 9. Credits
  async getCredits(params: { page: number; pageSize: number; search?: string }) {
    const { page, pageSize, search } = params;
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (search) {
      where.user = { email: { contains: search, mode: 'insensitive' } };
    }

    const [items, total, recentLedgers] = await Promise.all([
      prisma.creditWallet.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { balance: 'desc' },
        select: {
          id: true,
          balance: true,
          lifetimeGranted: true,
          lifetimeConsumed: true,
          updatedAt: true,
          user: {
            select: {
              id: true,
              email: true,
              candidateProfile: { select: { fullName: true } }
            }
          }
        }
      }),
      prisma.creditWallet.count({ where }),
      prisma.creditLedger.findMany({
        take: 20,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          amount: true,
          balanceAfter: true,
          type: true,
          reason: true,
          createdAt: true,
          user: {
            select: {
              email: true
            }
          }
        }
      })
    ]);

    return {
      wallets: items.map(w => ({
        id: w.id,
        balance: w.balance,
        lifetimeGranted: w.lifetimeGranted,
        lifetimeConsumed: w.lifetimeConsumed,
        updatedAt: w.updatedAt,
        userEmail: w.user.email,
        userName: w.user.candidateProfile?.fullName || w.user.email
      })),
      recentActivity: recentLedgers.map(l => ({
        id: l.id,
        amount: l.amount,
        balanceAfter: l.balanceAfter,
        type: l.type,
        reason: l.reason,
        createdAt: l.createdAt,
        userEmail: l.user.email
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    };
  }
}

export const adminRepository = new AdminRepository();
