import { prisma } from '../../database/prisma.js';
import { ApplicationStatus, Prisma } from '@prisma/client';
import type {
  CreateApplicationDTO,
  UpdateApplicationDTO,
  ApplicationFilterQuery
} from './application.types.js';

export class ApplicationRepository {
  public static async findById(id: string, candidateProfileId: string) {
    return prisma.application.findFirst({
      where: {
        id,
        candidateProfileId
      },
      include: {
        job: {
          include: {
            company: true
          }
        },
        resumeVersion: true,
        statusHistory: {
          orderBy: { changedAt: 'desc' }
        },
        notes: {
          orderBy: { createdAt: 'desc' }
        },
        reminders: {
          orderBy: { dueDate: 'asc' }
        }
      }
    });
  }

  public static async findByCandidateAndJob(candidateProfileId: string, jobId: string) {
    return prisma.application.findUnique({
      where: {
        candidateProfileId_jobId: {
          candidateProfileId,
          jobId
        }
      }
    });
  }

  public static async list(candidateProfileId: string, query: ApplicationFilterQuery) {
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const where: Prisma.ApplicationWhereInput = {
      candidateProfileId
    };

    if (query.status) {
      where.status = query.status;
    }

    if (query.search) {
      const search = query.search.trim();
      where.OR = [
        { job: { title: { contains: search, mode: 'insensitive' } } },
        { job: { company: { name: { contains: search, mode: 'insensitive' } } } },
        { job: { location: { contains: search, mode: 'insensitive' } } }
      ];
    }

    const orderBy: Prisma.ApplicationOrderByWithRelationInput = {
      [query.sortBy || 'createdAt']: query.sortOrder || 'desc'
    };

    const [items, total] = await Promise.all([
      prisma.application.findMany({
        where,
        skip,
        take: pageSize,
        orderBy,
        include: {
          job: {
            include: {
              company: true
            }
          },
          resumeVersion: {
            select: {
              id: true,
              versionName: true,
              title: true,
              atsScore: true
            }
          },
          _count: {
            select: {
              notes: true,
              reminders: true,
              statusHistory: true
            }
          }
        }
      }),
      prisma.application.count({ where })
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

  public static async create(candidateProfileId: string, dto: CreateApplicationDTO) {
    const appliedAt = dto.status === ApplicationStatus.APPLIED ? new Date() : null;

    return prisma.$transaction(async tx => {
      const application = await tx.application.create({
        data: {
          candidateProfileId,
          jobId: dto.jobId,
          resumeVersionId: dto.resumeVersionId || null,
          status: dto.status || ApplicationStatus.SAVED,
          appliedAt,
          externalUrl: dto.externalUrl || null,
          notesSummary: dto.notesSummary || null,
          customAnswers: dto.customAnswers ? (dto.customAnswers as Prisma.InputJsonValue) : Prisma.JsonNull,
          metadata: dto.metadata ? (dto.metadata as Prisma.InputJsonValue) : Prisma.JsonNull
        },
        include: {
          job: {
            include: {
              company: true
            }
          },
          resumeVersion: true
        }
      });

      // Insert initial status history
      await tx.applicationStatusHistory.create({
        data: {
          applicationId: application.id,
          previousStatus: null,
          newStatus: application.status,
          reason: 'Initial application creation'
        }
      });

      return application;
    });
  }

  public static async update(id: string, candidateProfileId: string, dto: UpdateApplicationDTO) {
    return prisma.application.update({
      where: {
        id
      },
      data: {
        ...(dto.resumeVersionId !== undefined ? { resumeVersionId: dto.resumeVersionId } : {}),
        ...(dto.externalUrl !== undefined ? { externalUrl: dto.externalUrl } : {}),
        ...(dto.notesSummary !== undefined ? { notesSummary: dto.notesSummary } : {}),
        ...(dto.customAnswers !== undefined ? { customAnswers: dto.customAnswers ? (dto.customAnswers as Prisma.InputJsonValue) : Prisma.JsonNull } : {}),
        ...(dto.metadata !== undefined ? { metadata: dto.metadata ? (dto.metadata as Prisma.InputJsonValue) : Prisma.JsonNull } : {})
      },
      include: {
        job: {
          include: {
            company: true
          }
        },
        resumeVersion: true
      }
    });
  }

  public static async delete(id: string, candidateProfileId: string) {
    return prisma.application.delete({
      where: {
        id
      }
    });
  }

  public static async countByStatus(candidateProfileId: string) {
    return prisma.application.groupBy({
      by: ['status'],
      where: {
        candidateProfileId
      },
      _count: {
        status: true
      }
    });
  }

  public static async getStatusHistory(applicationId: string) {
    return prisma.applicationStatusHistory.findMany({
      where: { applicationId },
      orderBy: { changedAt: 'desc' }
    });
  }

  public static async addStatusHistory(
    applicationId: string,
    previousStatus: ApplicationStatus,
    newStatus: ApplicationStatus,
    reason?: string
  ) {
    return prisma.$transaction(async tx => {
      const appliedAtUpdate = newStatus === ApplicationStatus.APPLIED ? { appliedAt: new Date() } : {};

      const updated = await tx.application.update({
        where: { id: applicationId },
        data: {
          status: newStatus,
          ...appliedAtUpdate
        },
        include: {
          job: {
            include: {
              company: true
            }
          },
          resumeVersion: true
        }
      });

      await tx.applicationStatusHistory.create({
        data: {
          applicationId,
          previousStatus,
          newStatus,
          reason: reason || null
        }
      });

      return updated;
    });
  }

  // Notes
  public static async getNotes(applicationId: string) {
    return prisma.applicationNote.findMany({
      where: { applicationId },
      orderBy: { createdAt: 'desc' }
    });
  }

  public static async addNote(applicationId: string, content: string) {
    return prisma.applicationNote.create({
      data: {
        applicationId,
        content
      }
    });
  }

  public static async deleteNote(noteId: string, applicationId: string) {
    return prisma.applicationNote.delete({
      where: {
        id: noteId
      }
    });
  }

  // Reminders
  public static async getReminders(applicationId: string) {
    return prisma.applicationReminder.findMany({
      where: { applicationId },
      orderBy: { dueDate: 'asc' }
    });
  }

  public static async addReminder(applicationId: string, title: string, dueDate: Date) {
    return prisma.applicationReminder.create({
      data: {
        applicationId,
        title,
        dueDate
      }
    });
  }

  public static async deleteReminder(reminderId: string, applicationId: string) {
    return prisma.applicationReminder.delete({
      where: {
        id: reminderId
      }
    });
  }

  // Saved Jobs
  public static async getSavedJobs(candidateProfileId: string) {
    return prisma.savedJob.findMany({
      where: { candidateProfileId },
      orderBy: { savedAt: 'desc' },
      include: {
        job: {
          include: {
            company: true
          }
        }
      }
    });
  }

  public static async findSavedJob(candidateProfileId: string, jobId: string) {
    return prisma.savedJob.findUnique({
      where: {
        candidateProfileId_jobId: {
          candidateProfileId,
          jobId
        }
      }
    });
  }

  public static async createSavedJob(candidateProfileId: string, jobId: string, notes?: string) {
    return prisma.savedJob.create({
      data: {
        candidateProfileId,
        jobId,
        notes: notes || null
      },
      include: {
        job: {
          include: {
            company: true
          }
        }
      }
    });
  }

  public static async deleteSavedJob(candidateProfileId: string, jobId: string) {
    return prisma.savedJob.delete({
      where: {
        candidateProfileId_jobId: {
          candidateProfileId,
          jobId
        }
      }
    });
  }
}
