import { prisma } from '../database/prisma.js';
import type { Resume, ResumeVersion, ResumeStatus } from '@prisma/client';

export class ResumeRepository {
  public static async findById(id: string) {
    return prisma.resume.findUnique({
      where: { id },
      include: {
        versions: { orderBy: { versionNumber: 'desc' } },
        candidateProfile: true
      }
    });
  }

  public static async findByCandidateId(candidateProfileId: string) {
    return prisma.resume.findMany({
      where: {
        candidateProfileId,
        status: { not: 'ARCHIVED' }
      },
      include: {
        versions: { orderBy: { versionNumber: 'desc' } }
      },
      orderBy: { uploadedAt: 'desc' }
    });
  }

  public static async createResume(data: {
    candidateProfileId: string;
    title: string;
    originalFileName?: string;
    mimeType?: string;
    fileSize?: number;
    storageProvider?: string;
    storageKey?: string;
    status?: ResumeStatus;
    isMaster?: boolean;
    rawText?: string;
  }) {
    return prisma.resume.create({
      data: {
        ...data,
        storageProvider: data.storageProvider || 'local',
        status: data.status || 'UPLOADED'
      }
    });
  }

  public static async updateResume(id: string, data: any) {
    return prisma.resume.update({
      where: { id },
      data
    });
  }

  public static async archiveResume(id: string) {
    return prisma.resume.update({
      where: { id },
      data: {
        status: 'ARCHIVED',
        archivedAt: new Date()
      }
    });
  }

  // Resume Versions
  public static async findVersionsByResumeId(resumeId: string) {
    return prisma.resumeVersion.findMany({
      where: { resumeId },
      orderBy: { versionNumber: 'desc' }
    });
  }

  public static async findVersionById(id: string) {
    return prisma.resumeVersion.findUnique({
      where: { id },
      include: {
        resume: {
          include: { candidateProfile: true }
        }
      }
    });
  }

  public static async createResumeVersion(data: {
    resumeId: string;
    versionNumber: number;
    title: string;
    summary?: string;
    versionName: string;
    contentSnapshot: any;
    structuredContent: any;
  }) {
    return prisma.resumeVersion.create({
      data: {
        resumeId: data.resumeId,
        versionNumber: data.versionNumber,
        title: data.title,
        summary: data.summary,
        versionName: data.versionName,
        contentSnapshot: data.contentSnapshot,
        structuredContent: data.structuredContent
      }
    });
  }
}
