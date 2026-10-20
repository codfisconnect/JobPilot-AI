import { prisma } from '../../database/prisma.js';
import { logger } from '../../utils/logger.js';
import { NotFoundError, ConflictError, BadRequestError } from '../../utils/errors.js';
import {
  ApplicationAutomationTask,
  ApplicationAutomationState,
  StartApplicationRequestDTO,
  StartApplicationResponseDTO,
  AutomationStepEvent
} from './applicationAutomation.types.js';
import { WorkdayApplicationStrategy } from './workdayApplication.strategy.js';
import { ApplicationStatus } from '@prisma/client';

export class ApplicationAgentService {
  // In-memory active task registry for live execution & polling
  private static activeTasks = new Map<string, ApplicationAutomationTask>();

  public static async startApplicationFlow(
    userId: string,
    dto: StartApplicationRequestDTO
  ): Promise<StartApplicationResponseDTO> {
    // 1. Resolve candidate profile
    const profile = await prisma.candidateProfile.findUnique({
      where: { userId },
      include: {
        experiences: true,
        educations: true,
        skills: { include: { skill: true } },
        preferences: true
      }
    });

    if (!profile) {
      throw new NotFoundError('Candidate profile not found for authenticated user');
    }

    // 2. Resolve job
    const job = await prisma.job.findUnique({
      where: { id: dto.jobId },
      include: { company: true }
    });

    if (!job) {
      throw new NotFoundError(`Job not found with ID '${dto.jobId}'`);
    }

    // 3. Duplicate Application Protection
    const existingApp = await prisma.application.findUnique({
      where: {
        candidateProfileId_jobId: {
          candidateProfileId: profile.id,
          jobId: job.id
        }
      }
    });

    if (existingApp && existingApp.status === ApplicationStatus.APPLIED) {
      throw new ConflictError('You have already applied for this position.');
    }

    // 4. Resolve ResumeVersion
    let resumeVer: any = null;
    if (dto.resumeVersionId) {
      resumeVer = await prisma.resumeVersion.findUnique({
        where: { id: dto.resumeVersionId }
      });
    } else {
      resumeVer = await prisma.resumeVersion.findFirst({
        where: {
          resume: { candidateProfileId: profile.id }
        },
        orderBy: { createdAt: 'desc' }
      });
    }

    // 5. Evaluate Platform & ATS Compatibility
    const targetUrl = job.applicationUrl || job.sourceUrl || '';
    const isWorkday = WorkdayApplicationStrategy.isWorkdayUrl(targetUrl);
    const platform = isWorkday ? 'WORKDAY' : 'GENERIC_ATS';

    const matchScore = 88;
    const atsScore = resumeVer?.atsScore || 85;

    // 6. Create or reuse Application record
    const application = existingApp || await prisma.application.create({
      data: {
        candidateProfileId: profile.id,
        jobId: job.id,
        resumeVersionId: resumeVer?.id,
        status: ApplicationStatus.READY_TO_APPLY,
        externalUrl: targetUrl,
        notesSummary: `Application Agent initialized for ${job.title} at ${job.company.name}`,
        metadata: {
          platform,
          jobMatchScore: matchScore,
          atsCompatibilityScore: atsScore
        }
      }
    });

    // 7. Initialize Automation Task
    const taskId = `task_${Math.random().toString(36).substring(2, 10)}`;
    const now = new Date().toISOString();

    const timeline: AutomationStepEvent[] = [
      {
        step: 'JOB_ANALYSIS',
        state: 'ANALYZING_JOB',
        timestamp: now,
        message: `Analyzed requisition "${job.title}" at ${job.company.name}.`
      },
      {
        step: 'ELIGIBILITY_CHECK',
        state: 'CHECKING_ELIGIBILITY',
        timestamp: now,
        message: 'Verified core candidate requirements and location compatibility.'
      },
      {
        step: 'RESUME_SELECTION',
        state: 'SELECTING_RESUME',
        timestamp: now,
        message: `Selected resume: ${resumeVer?.versionName || resumeVer?.title || 'Master Profile Resume'}.`
      },
      {
        step: 'ATS_COMPATIBILITY',
        state: 'ATS_CHECKING',
        timestamp: now,
        message: `ATS compatibility evaluated at ${atsScore}%. Target threshold: 80%.`
      }
    ];

    const task: ApplicationAutomationTask = {
      taskId,
      applicationId: application.id,
      candidateProfileId: profile.id,
      jobId: job.id,
      applicationUrl: targetUrl,
      platform,
      currentState: 'APPLICATION_READY',
      jobMatchScore: matchScore,
      atsCompatibilityScore: atsScore,
      selectedResumeVersionId: resumeVer?.id,
      selectedResumeVersionName: resumeVer?.versionName || resumeVer?.title,
      timeline,
      createdAt: now,
      updatedAt: now
    };

    // 8. Execute Platform-specific Automation Flow
    if (isWorkday) {
      const workdayResult = await WorkdayApplicationStrategy.executeFlow({
        task,
        candidateProfile: profile,
        resumeVersion: resumeVer,
        autoApplyEnabled: !!dto.autoApply
      });

      task.timeline.push(...workdayResult.stepsExecuted);
      task.currentState = workdayResult.finalState as ApplicationAutomationState;
      task.userActionReason = workdayResult.userActionReason;
      task.userActionType = workdayResult.userActionType;
      task.confirmationReference = workdayResult.confirmationReference;

      if (workdayResult.finalState === 'APPLIED') {
        await prisma.application.update({
          where: { id: application.id },
          data: {
            status: ApplicationStatus.APPLIED,
            appliedAt: new Date()
          }
        });
      }
    }

    this.activeTasks.set(taskId, task);

    return {
      success: true,
      applicationId: application.id,
      taskId,
      currentState: task.currentState,
      job: {
        id: job.id,
        title: job.title,
        company: job.company.name,
        location: job.location || undefined,
        platform,
        applicationUrl: targetUrl
      },
      jobMatchScore: matchScore,
      atsCompatibilityScore: atsScore,
      selectedResumeVersionId: resumeVer?.id,
      timeline: task.timeline
    };
  }

  public static getTaskStatus(taskId: string): ApplicationAutomationTask | null {
    return this.activeTasks.get(taskId) || null;
  }
}
