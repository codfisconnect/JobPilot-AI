import { prisma } from '../../database/prisma.js';
import { logger } from '../../utils/logger.js';
import { NotFoundError, ConflictError, BadRequestError } from '../../utils/errors.js';
import { ApplicationStatus } from '@prisma/client';
import {
  ApplicationAttempt,
  StartOrchestrationDTO,
  MissingFieldResponseDTO,
  StatusUpdateItem,
  SubmissionResultDetails
} from './orchestrator/orchestrator.types.js';
import { ApplicationProviderRegistry } from './providers/applicationProvider.registry.js';
import { ApplicationExecutionContext } from './providers/applicationProvider.interface.js';
import { SubmissionVerificationService } from './submissionVerification.service.js';
import { ApplicationRepository } from '../../services/repositories.js';
import { ApplicationRecord } from '../../types/index.js';

export class ApplicationOrchestratorService {
  // Active attempts memory store (indexed by attemptId)
  private static activeAttempts = new Map<string, ApplicationAttempt>();

  /**
   * Start a new One-Click Application Attempt
   */
  public static async startAttempt(
    userId: string,
    dto: StartOrchestrationDTO
  ): Promise<ApplicationAttempt> {
    if (!dto.jobId) {
      throw new BadRequestError('jobId is required to start application');
    }

    // 1. Fetch Candidate Profile with verified data
    const profile = await prisma.candidateProfile.findUnique({
      where: { userId },
      include: {
        experiences: { orderBy: { startDate: 'desc' } },
        educations: { orderBy: { startDate: 'desc' } },
        skills: { include: { skill: true } },
        preferences: true,
        resumes: { orderBy: { uploadedAt: 'desc' } }
      }
    });

    if (!profile) {
      throw new NotFoundError('Candidate profile not found for authenticated user');
    }

    // 2. Fetch authoritative canonical Job record by ID
    const job = await prisma.job.findUnique({
      where: { id: dto.jobId },
      include: {
        company: true,
        skills: { include: { skill: true } }
      }
    });

    if (!job) {
      throw new NotFoundError(`Job not found with ID '${dto.jobId}'`);
    }

    // 3. Idempotency & Duplicate Application Check
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

    // 4. Resolve Resume Choice: Master Resume by default
    const resumeChoice = dto.resumeChoice || 'master';
    let selectedResume: any = null;

    if (dto.resumeId) {
      selectedResume = profile.resumes.find(r => r.id === dto.resumeId);
    }

    if (!selectedResume) {
      if (resumeChoice === 'tailored') {
        // Look for existing tailored version or resume version
        const version = await prisma.resumeVersion.findFirst({
          where: {
            jobId: job.id,
            resume: { candidateProfileId: profile.id }
          },
          orderBy: { createdAt: 'desc' }
        });
        if (version) {
          selectedResume = version;
        }
      }
      
      // Fallback to Master/Preferred Resume
      if (!selectedResume) {
        selectedResume = profile.resumes.find(r => r.isMaster) || profile.resumes[0];
      }
    }

    const selectedResumeTitle = selectedResume
      ? (selectedResume.title || selectedResume.versionName || (resumeChoice === 'tailored' ? 'Tailored Resume' : 'Master Resume'))
      : 'Master Resume';

    // 5. Initialize Attempt State
    const attemptId = `att_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const idempotencyKey = dto.idempotencyKey || `idem_${profile.id}_${job.id}`;
    const now = new Date().toISOString();

    const statusUpdates: StatusUpdateItem[] = [
      { id: '1', step: 'JOB_REQUIREMENTS', label: 'Reading job requirements', status: 'completed', timestamp: now }
    ];

    const attempt: ApplicationAttempt = {
      attemptId,
      candidateProfileId: profile.id,
      userId,
      jobId: job.id,
      resumeChoice,
      selectedResumeId: selectedResume?.id,
      selectedResumeTitle,
      state: 'JOB_ANALYZED',
      statusUpdates,
      candidateResponses: {},
      jobMatchScore: 88,
      atsCompatibilityScore: 85,
      idempotencyKey,
      createdAt: now,
      updatedAt: now
    };

    this.activeAttempts.set(attemptId, attempt);

    // 6. Execute Pipeline Asynchronously / Continuously
    return this.executePipeline(attempt, profile, job, selectedResume);
  }

  /**
   * Internal Execution Pipeline
   */
  private static async executePipeline(
    attempt: ApplicationAttempt,
    profile: any,
    job: any,
    selectedResume: any
  ): Promise<ApplicationAttempt> {
    const now = () => new Date().toISOString();

    try {
      // Step 2: Preparing candidate information
      attempt.state = 'RESUME_SELECTED';
      attempt.statusUpdates.push({
        id: '2',
        step: 'CANDIDATE_INFO',
        label: 'Preparing candidate information',
        status: 'completed',
        timestamp: now()
      });

      // Step 3: Preparing resume
      attempt.statusUpdates.push({
        id: '3',
        step: 'RESUME_PREP',
        label: 'Preparing resume',
        status: 'completed',
        timestamp: now()
      });

      // Resolve specialized provider with exact target resolution
      const { provider, resolvedTargetUrl } = ApplicationProviderRegistry.resolveProvider(
        job.applicationUrl || job.sourceUrl || '',
        job
      );

      const context: ApplicationExecutionContext = {
        attempt,
        job,
        candidate: profile,
        selectedResume,
        targetUrl: resolvedTargetUrl,
        candidateResponses: attempt.candidateResponses
      };

      // Step 4: Completing employer form
      attempt.state = 'FORM_DISCOVERED';
      const openRes = await provider.openApplication(context);
      if (!openRes.success) {
        attempt.state = 'FAILED';
        attempt.error = {
          message: openRes.message,
          factualReason: openRes.message
        };
        attempt.updatedAt = now();
        return attempt;
      }

      const fillRes = await provider.fillFields(context);
      if (!fillRes.success && fillRes.userInterventionRequired && fillRes.interventionType === 'MISSING_FIELD') {
        // Genuinely missing mandatory information -> interrupt only for this field!
        attempt.state = 'WAITING_FOR_CANDIDATE';
        attempt.missingField = fillRes.missingField;
        attempt.statusUpdates.push({
          id: '4',
          step: 'EMPLOYER_FORM',
          label: 'Completing employer form',
          status: 'pending',
          timestamp: now()
        });
        attempt.updatedAt = now();
        logger.info(`[ApplicationOrchestratorService] Pausing attempt ${attempt.attemptId} for missing field: ${fillRes.missingField?.fieldKey}`);
        return attempt;
      }

      attempt.state = 'FORM_FILLED';
      attempt.statusUpdates.push({
        id: '4',
        step: 'EMPLOYER_FORM',
        label: 'Completing employer form',
        status: 'completed',
        timestamp: now()
      });

      // Step 5: Uploading resume
      attempt.state = 'RESUME_UPLOADED';
      const uploadRes = await provider.uploadResume(context);
      if (!uploadRes.success) {
        attempt.state = 'FAILED';
        attempt.error = {
          message: uploadRes.message,
          factualReason: 'Employer portal rejected the resume upload.'
        };
        attempt.updatedAt = now();
        return attempt;
      }

      attempt.statusUpdates.push({
        id: '5',
        step: 'RESUME_UPLOAD',
        label: 'Uploading resume',
        status: 'completed',
        timestamp: now()
      });

      // Step 6: Submitting application
      attempt.state = 'SUBMITTING';
      attempt.statusUpdates.push({
        id: '6',
        step: 'APPLICATION_SUBMIT',
        label: 'Submitting application',
        status: 'completed',
        timestamp: now()
      });

      await provider.submit(context);

      // Step 7: Verifying submission
      const verification = await SubmissionVerificationService.verify(provider, context);
      if (!verification.verified) {
        attempt.state = 'FAILED';
        attempt.error = {
          message: verification.failureReason || 'Employer did not confirm submission.',
          factualReason: verification.failureReason || 'Employer confirmation was not returned.'
        };
        attempt.statusUpdates.push({
          id: '7',
          step: 'VERIFY_SUBMISSION',
          label: 'Verifying submission',
          status: 'failed',
          timestamp: now()
        });
        attempt.updatedAt = now();
        return attempt;
      }

      attempt.state = 'SUBMITTED';
      attempt.statusUpdates.push({
        id: '7',
        step: 'VERIFY_SUBMISSION',
        label: 'Verifying submission',
        status: 'completed',
        timestamp: now()
      });

      const confirmation = await SubmissionVerificationService.extractConfirmation(provider, context);
      const submissionResult: SubmissionResultDetails = {
        confirmationNumber: confirmation.confirmationNumber,
        submittedAt: confirmation.timestamp,
        employerUrl: resolvedTargetUrl,
        provider: provider.providerName,
        role: job.title,
        company: job.company?.name || 'Employer',
        resumeUsed: attempt.selectedResumeTitle || 'Master Resume'
      };

      attempt.submissionResult = submissionResult;
      attempt.updatedAt = now();

      let validResumeVersionId: string | null = null;
      if (selectedResume?.id) {
        const rvExists = await prisma.resumeVersion.findUnique({
          where: { id: selectedResume.id },
          select: { id: true }
        });
        if (rvExists) {
          validResumeVersionId = rvExists.id;
        }
      }

      // Persist in Prisma database
      const application = await prisma.application.upsert({
        where: {
          candidateProfileId_jobId: {
            candidateProfileId: profile.id,
            jobId: job.id
          }
        },
        create: {
          candidateProfileId: profile.id,
          jobId: job.id,
          resumeVersionId: validResumeVersionId,
          status: ApplicationStatus.APPLIED,
          appliedAt: new Date(confirmation.timestamp),
          externalUrl: resolvedTargetUrl,
          notesSummary: `Application submitted via Pilot Mama (${provider.providerName})`,
          metadata: {
            confirmationNumber: confirmation.confirmationNumber,
            provider: provider.providerName,
            resumeId: selectedResume?.id,
            resumeUsed: attempt.selectedResumeTitle,
            submittedVia: 'ONE_CLICK_ORCHESTRATOR'
          }
        },
        update: {
          status: ApplicationStatus.APPLIED,
          appliedAt: new Date(confirmation.timestamp),
          resumeVersionId: validResumeVersionId,
          externalUrl: resolvedTargetUrl,
          metadata: {
            confirmationNumber: confirmation.confirmationNumber,
            provider: provider.providerName,
            resumeId: selectedResume?.id,
            resumeUsed: attempt.selectedResumeTitle,
            submittedVia: 'ONE_CLICK_ORCHESTRATOR'
          }
        }
      });

      // Synchronize with ApplicationRepository
      const legacyApp: ApplicationRecord = {
        id: application.id,
        candidateId: profile.id,
        jobId: job.id,
        company: job.company?.name || 'Employer',
        role: job.title,
        location: job.location || profile.location || '',
        applicationMode: 'external',
        jobUrl: job.sourceUrl || resolvedTargetUrl,
        applicationUrl: resolvedTargetUrl,
        matchScore: attempt.jobMatchScore,
        atsScore: attempt.atsCompatibilityScore,
        status: 'APPLIED',
        applicationDate: confirmation.timestamp.split('T')[0],
        appliedAt: confirmation.timestamp,
        notes: `Confirmation: ${confirmation.confirmationNumber}`,
        createdAt: now(),
        updatedAt: now()
      };
      try { await ApplicationRepository.save(legacyApp); } catch (_e) {}

      submissionResult.applicationId = application.id;
      return attempt;
    } catch (err: any) {
      console.error('[ApplicationOrchestratorService] Pipeline error:', err);
      logger.error(`[ApplicationOrchestratorService] Pipeline error: ${err.message}`);
      attempt.state = 'FAILED';
      attempt.error = {
        message: err.message,
        factualReason: `Application error: ${err.message}`
      };
      attempt.updatedAt = now();
      return attempt;
    }
  }

  /**
   * Resume application attempt after candidate provides missing mandatory field
   */
  public static async respondMissingField(
    userId: string,
    attemptId: string,
    dto: MissingFieldResponseDTO
  ): Promise<ApplicationAttempt> {
    const attempt = this.activeAttempts.get(attemptId);
    if (!attempt) {
      throw new NotFoundError('Application attempt not found');
    }

    if (attempt.userId !== userId) {
      throw new BadRequestError('Access denied: You do not own this application attempt');
    }

    if (attempt.state !== 'WAITING_FOR_CANDIDATE') {
      throw new BadRequestError(`Attempt is not waiting for candidate input (current state: ${attempt.state})`);
    }

    // Save provided answer
    attempt.candidateResponses[dto.fieldKey] = dto.value;
    delete attempt.missingField;

    // Also persist location/phone to CandidateProfile if updated so candidate doesn't need to re-enter
    if (dto.fieldKey === 'location' || dto.fieldKey === 'phone') {
      try {
        await prisma.candidateProfile.update({
          where: { id: attempt.candidateProfileId },
          data: { [dto.fieldKey]: String(dto.value) }
        });
      } catch {}
    }

    // Fetch candidate and job to resume pipeline
    const profile = await prisma.candidateProfile.findUnique({
      where: { id: attempt.candidateProfileId },
      include: {
        experiences: true,
        educations: true,
        skills: { include: { skill: true } },
        preferences: true,
        resumes: true
      }
    });

    const job = await prisma.job.findUnique({
      where: { id: attempt.jobId },
      include: { company: true, skills: { include: { skill: true } } }
    });

    const selectedResume = profile?.resumes.find(r => r.id === attempt.selectedResumeId) || profile?.resumes[0];

    // Resume execution automatically
    return this.executePipeline(attempt, profile, job, selectedResume);
  }

  /**
   * Get current attempt status for live UI polling
   */
  public static getAttemptStatus(userId: string, attemptId: string): ApplicationAttempt {
    const attempt = this.activeAttempts.get(attemptId);
    if (!attempt) {
      throw new NotFoundError('Application attempt not found');
    }

    if (attempt.userId !== userId) {
      throw new BadRequestError('Access denied: You do not own this application attempt');
    }

    return attempt;
  }

  /**
   * Cancel active attempt
   */
  public static cancelAttempt(userId: string, attemptId: string): { success: boolean } {
    const attempt = this.activeAttempts.get(attemptId);
    if (!attempt) {
      throw new NotFoundError('Application attempt not found');
    }

    attempt.state = 'CANCELLED';
    attempt.updatedAt = new Date().toISOString();
    return { success: true };
  }
}

