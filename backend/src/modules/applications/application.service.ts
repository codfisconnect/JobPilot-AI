import { ApplicationRepository } from './application.repository.js';
import { ApplicationStatusService } from './application-status.service.js';
import { CandidateProfileRepository } from '../../repositories/candidateProfile.repository.js';
import { JobRepositoryV1 } from '../../repositories/job.repository.js';
import { prisma } from '../../database/prisma.js';
import {
  NotFoundError,
  ForbiddenError,
  ConflictError,
  BadRequestError
} from '../../utils/errors.js';
import { ApplicationStatus } from '@prisma/client';
import type {
  CreateApplicationDTO,
  UpdateApplicationDTO,
  UpdateStatusDTO,
  CreateNoteDTO,
  CreateReminderDTO,
  ApplicationFilterQuery,
  ApplicationStatsResponse
} from './application.types.js';

export class ApplicationService {
  private static async getCandidateProfileId(userId: string): Promise<string> {
    const profile = await CandidateProfileRepository.findByUserId(userId);
    if (!profile) {
      throw new NotFoundError('Candidate profile not found for authenticated user');
    }
    return profile.id;
  }

  /**
   * Verify candidate ownership of an application
   */
  private static async verifyApplicationOwnership(id: string, candidateProfileId: string) {
    const application = await ApplicationRepository.findById(id, candidateProfileId);
    if (!application) {
      // Check if application exists for another candidate to return 403 or 404
      const existing = await prisma.application.findUnique({ where: { id } });
      if (existing) {
        throw new ForbiddenError('Access denied: You do not own this application');
      }
      throw new NotFoundError(`Application not found with ID '${id}'`);
    }
    return application;
  }

  /**
   * Verify candidate ownership of a resume version
   */
  private static async verifyResumeVersionOwnership(resumeVersionId: string, candidateProfileId: string) {
    const version = await prisma.resumeVersion.findUnique({
      where: { id: resumeVersionId },
      include: { resume: true }
    });

    if (!version) {
      throw new NotFoundError(`ResumeVersion not found with ID '${resumeVersionId}'`);
    }

    if (version.resume.candidateProfileId !== candidateProfileId) {
      throw new ForbiddenError('Access denied: You cannot attach a resume version belonging to another candidate');
    }

    return version;
  }

  public static async listApplications(userId: string, query: ApplicationFilterQuery) {
    const candidateProfileId = await this.getCandidateProfileId(userId);
    return ApplicationRepository.list(candidateProfileId, query);
  }

  public static async getApplicationById(userId: string, id: string) {
    const candidateProfileId = await this.getCandidateProfileId(userId);
    return this.verifyApplicationOwnership(id, candidateProfileId);
  }

  public static async createApplication(userId: string, dto: CreateApplicationDTO) {
    const candidateProfileId = await this.getCandidateProfileId(userId);

    // 1. Verify Job existence
    const job = await JobRepositoryV1.findById(dto.jobId);
    if (!job) {
      throw new NotFoundError(`Job not found with ID '${dto.jobId}'`);
    }

    // 2. Duplicate Protection: Candidate cannot have multiple applications for same job
    const existing = await ApplicationRepository.findByCandidateAndJob(candidateProfileId, dto.jobId);
    if (existing) {
      throw new ConflictError('An application already exists for this job and candidate');
    }

    // 3. ResumeVersion Ownership Verification
    if (dto.resumeVersionId) {
      await this.verifyResumeVersionOwnership(dto.resumeVersionId, candidateProfileId);
    }

    // 4. Default externalUrl to job's applicationUrl if not provided
    const payload: CreateApplicationDTO = {
      ...dto,
      externalUrl: dto.externalUrl || job.applicationUrl || undefined
    };

    return ApplicationRepository.create(candidateProfileId, payload);
  }

  public static async updateApplication(userId: string, id: string, dto: UpdateApplicationDTO) {
    const candidateProfileId = await this.getCandidateProfileId(userId);
    await this.verifyApplicationOwnership(id, candidateProfileId);

    if (dto.resumeVersionId) {
      await this.verifyResumeVersionOwnership(dto.resumeVersionId, candidateProfileId);
    }

    return ApplicationRepository.update(id, candidateProfileId, dto);
  }

  public static async deleteApplication(userId: string, id: string) {
    const candidateProfileId = await this.getCandidateProfileId(userId);
    await this.verifyApplicationOwnership(id, candidateProfileId);

    await ApplicationRepository.delete(id, candidateProfileId);
    return { success: true, message: 'Application deleted successfully' };
  }

  public static async updateStatus(userId: string, id: string, dto: UpdateStatusDTO) {
    const candidateProfileId = await this.getCandidateProfileId(userId);
    const application = await this.verifyApplicationOwnership(id, candidateProfileId);

    // Validate status transition rule
    ApplicationStatusService.validateTransition(application.status, dto.status);

    return ApplicationRepository.addStatusHistory(
      id,
      application.status,
      dto.status,
      dto.reason
    );
  }

  public static async getStatusHistory(userId: string, id: string) {
    const candidateProfileId = await this.getCandidateProfileId(userId);
    await this.verifyApplicationOwnership(id, candidateProfileId);

    return ApplicationRepository.getStatusHistory(id);
  }

  // Notes
  public static async getNotes(userId: string, applicationId: string) {
    const candidateProfileId = await this.getCandidateProfileId(userId);
    await this.verifyApplicationOwnership(applicationId, candidateProfileId);

    return ApplicationRepository.getNotes(applicationId);
  }

  public static async addNote(userId: string, applicationId: string, dto: CreateNoteDTO) {
    const candidateProfileId = await this.getCandidateProfileId(userId);
    await this.verifyApplicationOwnership(applicationId, candidateProfileId);

    return ApplicationRepository.addNote(applicationId, dto.content.trim());
  }

  public static async deleteNote(userId: string, applicationId: string, noteId: string) {
    const candidateProfileId = await this.getCandidateProfileId(userId);
    await this.verifyApplicationOwnership(applicationId, candidateProfileId);

    const note = await prisma.applicationNote.findUnique({ where: { id: noteId } });
    if (!note || note.applicationId !== applicationId) {
      throw new NotFoundError('Note not found for this application');
    }

    await ApplicationRepository.deleteNote(noteId, applicationId);
    return { success: true, message: 'Note deleted successfully' };
  }

  // Reminders
  public static async getReminders(userId: string, applicationId: string) {
    const candidateProfileId = await this.getCandidateProfileId(userId);
    await this.verifyApplicationOwnership(applicationId, candidateProfileId);

    return ApplicationRepository.getReminders(applicationId);
  }

  public static async addReminder(userId: string, applicationId: string, dto: CreateReminderDTO) {
    const candidateProfileId = await this.getCandidateProfileId(userId);
    await this.verifyApplicationOwnership(applicationId, candidateProfileId);

    return ApplicationRepository.addReminder(applicationId, dto.title.trim(), dto.dueDate);
  }

  public static async deleteReminder(userId: string, applicationId: string, reminderId: string) {
    const candidateProfileId = await this.getCandidateProfileId(userId);
    await this.verifyApplicationOwnership(applicationId, candidateProfileId);

    const reminder = await prisma.applicationReminder.findUnique({ where: { id: reminderId } });
    if (!reminder || reminder.applicationId !== applicationId) {
      throw new NotFoundError('Reminder not found for this application');
    }

    await ApplicationRepository.deleteReminder(reminderId, applicationId);
    return { success: true, message: 'Reminder deleted successfully' };
  }

  // Analytics
  public static async getStats(userId: string): Promise<ApplicationStatsResponse> {
    const candidateProfileId = await this.getCandidateProfileId(userId);
    const counts = await ApplicationRepository.countByStatus(candidateProfileId);

    const map: Record<ApplicationStatus, number> = {
      [ApplicationStatus.SAVED]: 0,
      [ApplicationStatus.READY_TO_APPLY]: 0,
      [ApplicationStatus.APPLIED]: 0,
      [ApplicationStatus.ASSESSMENT]: 0,
      [ApplicationStatus.HR_SCREEN]: 0,
      [ApplicationStatus.TECHNICAL]: 0,
      [ApplicationStatus.FINAL_ROUND]: 0,
      [ApplicationStatus.OFFER]: 0,
      [ApplicationStatus.REJECTED]: 0,
      [ApplicationStatus.WITHDRAWN]: 0
    };

    let total = 0;
    for (const c of counts) {
      map[c.status] = c._count.status;
      total += c._count.status;
    }

    const interviewsTotal =
      map[ApplicationStatus.ASSESSMENT] +
      map[ApplicationStatus.HR_SCREEN] +
      map[ApplicationStatus.TECHNICAL] +
      map[ApplicationStatus.FINAL_ROUND];

    const active =
      map[ApplicationStatus.SAVED] +
      map[ApplicationStatus.READY_TO_APPLY] +
      map[ApplicationStatus.APPLIED] +
      interviewsTotal +
      map[ApplicationStatus.OFFER];

    // Response rate: percentage of non-saved/ready that reached applied or beyond
    const appliedAndBeyond = total - map[ApplicationStatus.SAVED] - map[ApplicationStatus.READY_TO_APPLY];
    const advancedPastApplied = interviewsTotal + map[ApplicationStatus.OFFER];

    const conversionRate = appliedAndBeyond > 0 ? Math.round((advancedPastApplied / appliedAndBeyond) * 100) : 0;
    const responseRate = appliedAndBeyond > 0 ? Math.round(((appliedAndBeyond - map[ApplicationStatus.APPLIED]) / appliedAndBeyond) * 100) : 0;

    return {
      total,
      active,
      saved: map[ApplicationStatus.SAVED],
      readyToApply: map[ApplicationStatus.READY_TO_APPLY],
      applied: map[ApplicationStatus.APPLIED],
      assessment: map[ApplicationStatus.ASSESSMENT],
      hrScreen: map[ApplicationStatus.HR_SCREEN],
      technical: map[ApplicationStatus.TECHNICAL],
      finalRound: map[ApplicationStatus.FINAL_ROUND],
      interviewsTotal,
      offers: map[ApplicationStatus.OFFER],
      rejected: map[ApplicationStatus.REJECTED],
      withdrawn: map[ApplicationStatus.WITHDRAWN],
      conversionRate,
      responseRate
    };
  }
}
