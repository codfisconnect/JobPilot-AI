import { prisma } from '../database/prisma.js';
import { ResumeRepository } from '../repositories/resume.repository.js';
import { CandidateProfileRepository } from '../repositories/candidateProfile.repository.js';
import { resumeStorage } from '../storage/index.js';
import { FileValidationService } from './fileValidation.service.js';
import { ResumeTextExtractor, ResumeParsingService } from './resumeParsing.service.js';
import { NotFoundError, ForbiddenError, BadRequestError, ResumeFileMissingError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import type { StructuredParsedResume } from '../schemas/resumeParser.schema.js';

export class ResumeService {
  /**
   * Upload resume: Validate -> Store Privately -> Create Resume Entity
   */
  public static async uploadResume(userId: string, file: Express.Multer.File | undefined, title = 'Uploaded Resume') {
    const profile = await CandidateProfileRepository.findByUserId(userId);
    if (!profile) {
      throw new NotFoundError('Candidate profile not found');
    }

    // 0. Enforce Active Resumes Limit: Maximum 5 active resumes per candidate
    const existingActiveResumes = await ResumeRepository.findByCandidateId(profile.id);
    if (existingActiveResumes.length >= 5) {
      throw new BadRequestError('Maximum limit of 5 active resumes reached. Please archive or delete an existing resume before uploading a new one.');
    }

    // 1. File Validation (magic number, size, extension)
    const validation = FileValidationService.validateUpload(file);

    // 2. Private Storage (Candidate ownership)
    const storageResult = await resumeStorage.upload(
      file!.buffer,
      validation.sanitizedFilename,
      validation.detectedMimeType,
      { candidateId: profile.id }
    );

    // 3. Confirm object exists in storage before database insert (consistency guarantee)
    const exists = await resumeStorage.exists(storageResult.storageKey);
    if (!exists) {
      throw new Error('Storage verification failed: Object was not confirmed in persistent storage');
    }

    // Exactly one active resume must be Preferred. If candidate has no active resumes, first one becomes preferred.
    const isFirstActive = existingActiveResumes.length === 0;

    // 4. Create Resume record
    const resume = await ResumeRepository.createResume({
      candidateProfileId: profile.id,
      title: title || validation.sanitizedFilename,
      originalFileName: validation.sanitizedFilename,
      mimeType: validation.detectedMimeType,
      fileSize: storageResult.byteSize,
      storageProvider: storageResult.storageProvider,
      storageKey: storageResult.storageKey,
      checksum: storageResult.checksum,
      status: 'UPLOADED',
      isMaster: isFirstActive
    });

    return resume;
  }

  /**
   * Replace missing/existing resume file without destroying historical database record
   */
  public static async replaceResumeFile(userId: string, resumeId: string, file: Express.Multer.File | undefined) {
    const profile = await CandidateProfileRepository.findByUserId(userId);
    if (!profile) {
      throw new NotFoundError('Candidate profile not found');
    }

    const resume = await ResumeRepository.findById(resumeId);
    if (!resume || resume.candidateProfileId !== profile.id) {
      throw new NotFoundError('Resume not found or unauthorized');
    }

    // 1. Validate replacement file
    const validation = FileValidationService.validateUpload(file);

    // 2. Upload replacement to persistent storage
    const storageResult = await resumeStorage.upload(
      file!.buffer,
      validation.sanitizedFilename,
      validation.detectedMimeType,
      { candidateId: profile.id }
    );

    // 3. Confirm object exists
    const exists = await resumeStorage.exists(storageResult.storageKey);
    if (!exists) {
      throw new Error('Replacement storage verification failed');
    }

    // 4. Update Resume metadata
    const updated = await ResumeRepository.updateResume(resumeId, {
      originalFileName: validation.sanitizedFilename,
      mimeType: validation.detectedMimeType,
      fileSize: storageResult.byteSize,
      storageProvider: storageResult.storageProvider,
      storageKey: storageResult.storageKey,
      checksum: storageResult.checksum,
      status: 'UPLOADED'
    });

    return updated;
  }

  /**
   * Parse Resume: Extract text -> Detect sections -> Parse structured fields
   */
  public static async parseResume(userId: string, resumeId: string): Promise<StructuredParsedResume> {
    const profile = await CandidateProfileRepository.findByUserId(userId);
    if (!profile) {
      throw new NotFoundError('Candidate profile not found');
    }

    const resume = await ResumeRepository.findById(resumeId);
    if (!resume || resume.candidateProfileId !== profile.id) {
      throw new NotFoundError('Resume not found or unauthorized');
    }

    if (!resume.storageKey) {
      await ResumeRepository.updateResume(resumeId, { status: 'FILE_MISSING' });
      throw new ResumeFileMissingError();
    }

    // Check storage availability before parsing
    const fileExists = await resumeStorage.exists(resume.storageKey);
    if (!fileExists) {
      await ResumeRepository.updateResume(resumeId, { status: 'FILE_MISSING' });
      throw new ResumeFileMissingError();
    }

    // Update status to PARSING
    await ResumeRepository.updateResume(resumeId, { status: 'PARSING' });

    try {
      // 1. Download buffer from private storage
      const fileBuffer = await resumeStorage.download(resume.storageKey);

      // 2. Extract raw text
      const rawText = await ResumeTextExtractor.extractText(fileBuffer, resume.mimeType || 'application/pdf');

      // 3. Deterministic structured parse
      const parsedData = ResumeParsingService.parse(rawText);

      // 4. Update resume record with parsed data
      const finalStatus = parsedData.needsReview ? 'PARSE_REVIEW_REQUIRED' : 'PARSED';

      await ResumeRepository.updateResume(resumeId, {
        rawText,
        parsedData: parsedData as any,
        status: finalStatus,
        parsedAt: new Date()
      });

      return parsedData;
    } catch (err: any) {
      if (err instanceof ResumeFileMissingError || err.code === 'RESUME_FILE_MISSING') {
        await ResumeRepository.updateResume(resumeId, { status: 'FILE_MISSING' });
        throw err;
      }
      logger.error('Failed to parse resume:', { resumeId, error: err.message });
      await ResumeRepository.updateResume(resumeId, { status: 'FAILED' });
      throw err;
    }
  }

  /**
   * Save Reviewed Data into Candidate Profile (Candidate retains 100% control)
   */
  public static async saveReviewedResumeData(userId: string, resumeId: string, confirmedData: any) {
    const profile = await CandidateProfileRepository.findByUserId(userId);
    if (!profile) {
      throw new NotFoundError('Candidate profile not found');
    }

    const resume = await ResumeRepository.findById(resumeId);
    if (!resume || resume.candidateProfileId !== profile.id) {
      throw new NotFoundError('Resume not found or unauthorized');
    }

    // 1. Update personal details and summary if provided
    const updateData: any = {};
    if (confirmedData.personalInfo) {
      if (confirmedData.personalInfo.fullName) updateData.fullName = confirmedData.personalInfo.fullName;
      if (confirmedData.personalInfo.headline) updateData.headline = confirmedData.personalInfo.headline;
      if (confirmedData.personalInfo.phone) updateData.phone = confirmedData.personalInfo.phone;
      if (confirmedData.personalInfo.email) updateData.email = confirmedData.personalInfo.email;
      if (confirmedData.personalInfo.location) updateData.location = confirmedData.personalInfo.location;
      if (confirmedData.personalInfo.country) updateData.country = confirmedData.personalInfo.country;
      if (confirmedData.personalInfo.city) updateData.city = confirmedData.personalInfo.city;
      if (confirmedData.personalInfo.stateProvince) updateData.stateProvince = confirmedData.personalInfo.stateProvince;
      if (confirmedData.personalInfo.postalCode) updateData.postalCode = confirmedData.personalInfo.postalCode;
      if (confirmedData.personalInfo.linkedinUrl) updateData.linkedinUrl = confirmedData.personalInfo.linkedinUrl;
      if (confirmedData.personalInfo.githubUrl) updateData.githubUrl = confirmedData.personalInfo.githubUrl;
      if (confirmedData.personalInfo.portfolioUrl) updateData.portfolioUrl = confirmedData.personalInfo.portfolioUrl;
    }

    if (confirmedData.summary !== undefined && confirmedData.summary !== null && confirmedData.summary.trim()) {
      updateData.summary = confirmedData.summary.trim();
    }

    if (Object.keys(updateData).length > 0) {
      await CandidateProfileRepository.updateProfile(profile.id, updateData);
    }

    // 2. Save experiences (with intelligent deduplication)
    if (Array.isArray(confirmedData.experience)) {
      const existingExps = profile.experiences || [];
      for (const exp of confirmedData.experience) {
        if (!exp.company || !exp.jobTitle) continue;
        const compNorm = exp.company.toLowerCase().trim();
        const titleNorm = exp.jobTitle.toLowerCase().trim();

        // Check if an existing experience entry matches this company and title
        const duplicate = existingExps.some((e: any) =>
          e.company.toLowerCase().trim() === compNorm &&
          e.jobTitle.toLowerCase().trim() === titleNorm
        );
        if (duplicate) continue;

        let parsedStart: Date | null = exp.startDate ? new Date(exp.startDate) : null;
        if (!parsedStart || isNaN(parsedStart.getTime())) {
          // If duration is specified (e.g. "6 years"), estimate realistic startDate from current year
          const durMatch = (exp.duration || '').match(/(\d+(?:\.\d+)?)\s*(?:years|yrs)/i);
          if (durMatch) {
            const yrs = parseFloat(durMatch[1]);
            const startYear = Math.max(1990, new Date().getFullYear() - Math.round(yrs));
            parsedStart = new Date(`${startYear}-01-01`);
          } else {
            parsedStart = new Date('2020-01-01');
          }
        }

        const endDate = exp.isCurrent || !exp.endDate ? null : new Date(exp.endDate);

        // Store duration in description if present and description is empty
        const description = exp.description || (exp.duration ? `Duration: ${exp.duration}` : null);

        await CandidateProfileRepository.createExperience(profile.id, {
          company: exp.company,
          jobTitle: exp.jobTitle,
          location: exp.location,
          employmentType: exp.employmentType || 'Full-time',
          startDate: parsedStart,
          endDate: endDate && !isNaN(endDate.getTime()) ? endDate : null,
          isCurrent: Boolean(exp.isCurrent),
          description,
          responsibilities: exp.responsibilities || [],
          achievements: exp.achievements || [],
          technologies: exp.technologies || [],
          displayOrder: exp.displayOrder ?? 0
        });
      }
    }

    // 3. Save education (with deduplication)
    if (Array.isArray(confirmedData.education)) {
      const existingEdu = profile.educations || [];
      for (const edu of confirmedData.education) {
        if (!edu.institution || !edu.degree) continue;
        const instNorm = edu.institution.toLowerCase().trim();
        const degNorm = edu.degree.toLowerCase().trim();

        const duplicate = existingEdu.some((e: any) =>
          e.institution.toLowerCase().trim() === instNorm &&
          e.degree.toLowerCase().trim() === degNorm
        );
        if (duplicate) continue;

        await CandidateProfileRepository.createEducation(profile.id, {
          institution: edu.institution,
          degree: edu.degree,
          fieldOfStudy: edu.fieldOfStudy,
          location: edu.location,
          startDate: edu.startDate ? new Date(edu.startDate) : null,
          endDate: edu.endDate ? new Date(edu.endDate) : null,
          gradeGpa: edu.gradeGpa,
          description: edu.description
        });
      }
    }

    // 4. Save certifications (with deduplication)
    if (Array.isArray(confirmedData.certifications)) {
      const existingCerts = profile.certifications || [];
      for (const cert of confirmedData.certifications) {
        if (!cert.name) continue;
        const nameNorm = cert.name.toLowerCase().trim();
        const duplicate = existingCerts.some((c: any) => c.name.toLowerCase().trim() === nameNorm);
        if (duplicate) continue;

        await CandidateProfileRepository.createCertification(profile.id, {
          name: cert.name,
          issuingOrganization: cert.issuingOrganization || 'Accredited Issuer',
          issueDate: cert.issueDate ? new Date(cert.issueDate) : null,
          expirationDate: cert.expirationDate ? new Date(cert.expirationDate) : null,
          credentialId: cert.credentialId,
          credentialUrl: cert.credentialUrl
        });
      }
    }

    // 5. Save skills
    if (Array.isArray(confirmedData.skills)) {
      for (const s of confirmedData.skills) {
        if (!s.name) continue;
        const skill = await CandidateProfileRepository.upsertSkill(s.name, s.category || 'TECHNICAL');
        await CandidateProfileRepository.addCandidateSkill(profile.id, skill.id, {
          proficiency: s.proficiency || 'Intermediate',
          yearsOfExperience: s.yearsOfExperience ? Number(s.yearsOfExperience) : null,
          source: 'RESUME',
          displayOrder: 0
        });
      }
    }

    // 6. Save projects (with deduplication)
    if (Array.isArray(confirmedData.projects)) {
      const existingProjects = profile.projects || [];
      for (const proj of confirmedData.projects) {
        if (!proj.name) continue;
        const nameNorm = proj.name.toLowerCase().trim();
        const duplicate = existingProjects.some((p: any) => p.name.toLowerCase().trim() === nameNorm);
        if (duplicate) continue;

        await CandidateProfileRepository.createProject(profile.id, {
          name: proj.name,
          description: proj.description,
          role: proj.role,
          technologies: proj.technologies || [],
          url: proj.url,
          startDate: proj.startDate ? new Date(proj.startDate) : null,
          endDate: proj.endDate ? new Date(proj.endDate) : null,
          displayOrder: 0
        });
      }
    }

    // Mark resume as PARSED and optionally mark as master
    await ResumeRepository.updateResume(resumeId, {
      status: 'PARSED',
      isMaster: confirmedData.setAsMaster !== undefined ? Boolean(confirmedData.setAsMaster) : true
    });

    return CandidateProfileRepository.findByUserId(userId);
  }

  /**
   * List Resumes for Candidate with safe, lightweight storage reconciliation
   */
  public static async getResumes(userId: string) {
    const profile = await CandidateProfileRepository.findByUserId(userId);
    if (!profile) {
      throw new NotFoundError('Candidate profile not found');
    }
    const resumes = await ResumeRepository.findByCandidateId(profile.id);

    // Reconcile storage existence for active resumes: if DB says UPLOADED/PARSED but file is gone, mark FILE_MISSING
    const reconciled = await Promise.all(
      resumes.map(async (resume) => {
        if (resume.status === 'ARCHIVED') return resume;
        if (!resume.storageKey) {
          if (resume.status !== 'FILE_MISSING') {
            await ResumeRepository.updateResume(resume.id, { status: 'FILE_MISSING' });
            return { ...resume, status: 'FILE_MISSING' as const };
          }
          return resume;
        }

        const exists = await resumeStorage.exists(resume.storageKey);
        if (!exists && resume.status !== 'FILE_MISSING') {
          logger.warn(`Storage reconciliation: Resume file missing for key ${resume.storageKey}. Updating status to FILE_MISSING.`);
          await ResumeRepository.updateResume(resume.id, { status: 'FILE_MISSING' });
          return { ...resume, status: 'FILE_MISSING' as const };
        } else if (exists && resume.status === 'FILE_MISSING') {
          // If file was recovered or replaced
          const newStatus = resume.parsedData ? ('PARSED' as const) : ('UPLOADED' as const);
          await ResumeRepository.updateResume(resume.id, { status: newStatus });
          return { ...resume, status: newStatus };
        }

        return resume;
      })
    );

    return reconciled;
  }

  /**
   * Get Resume by ID with ownership check
   */
  public static async getResumeById(userId: string, resumeId: string) {
    const profile = await CandidateProfileRepository.findByUserId(userId);
    if (!profile) {
      throw new NotFoundError('Candidate profile not found');
    }

    const resume = await ResumeRepository.findById(resumeId);
    if (!resume || resume.candidateProfileId !== profile.id) {
      throw new NotFoundError('Resume not found or unauthorized');
    }

    // Verify storage existence
    if (resume.storageKey) {
      const exists = await resumeStorage.exists(resume.storageKey);
      if (!exists && resume.status !== 'FILE_MISSING') {
        await ResumeRepository.updateResume(resume.id, { status: 'FILE_MISSING' });
        return { ...resume, status: 'FILE_MISSING' as const };
      }
    }

    return resume;
  }

  /**
   * Download physical resume file buffer (authorized by candidate ownership)
   */
  public static async downloadResumeBuffer(userId: string, resumeId: string): Promise<{ buffer: Buffer; filename: string; mimeType: string }> {
    const resume = await this.getResumeById(userId, resumeId);
    if (!resume.storageKey) {
      throw new ResumeFileMissingError();
    }

    const buffer = await resumeStorage.download(resume.storageKey);
    return {
      buffer,
      filename: resume.originalFileName || `${resume.title}.pdf`,
      mimeType: resume.mimeType || 'application/pdf'
    };
  }

  /**
   * Set Preferred (Master) Resume for Candidate
   * Strictly enforces: Exactly ONE active resume is Preferred.
   */
  public static async setPreferredResume(userId: string, resumeId: string) {
    const resume = await this.getResumeById(userId, resumeId);
    if (resume.status === 'ARCHIVED') {
      throw new BadRequestError('Cannot set an archived resume as Preferred.');
    }

    const profile = await CandidateProfileRepository.findByUserId(userId);
    if (!profile) {
      throw new NotFoundError('Candidate profile not found');
    }

    // Unset current master for all candidate resumes
    await prisma.resume.updateMany({
      where: { candidateProfileId: profile.id, isMaster: true },
      data: { isMaster: false }
    });

    // Set target resume as master
    const updated = await ResumeRepository.updateResume(resume.id, { isMaster: true });

    // Touch candidate profile timestamp to trigger downstream recommendation & match cache invalidation
    await prisma.candidateProfile.update({
      where: { id: profile.id },
      data: { updatedAt: new Date() }
    });

    return updated;
  }

  /**
   * Archive / Soft delete resume (retains physical file in storage)
   */
  public static async archiveResume(userId: string, resumeId: string) {
    const resume = await this.getResumeById(userId, resumeId);
    const profile = await CandidateProfileRepository.findByUserId(userId);
    const archived = await ResumeRepository.archiveResume(resume.id);

    // If archived resume was preferred, promote the newest remaining active resume to Preferred
    if (resume.isMaster && profile) {
      const remainingActive = await ResumeRepository.findByCandidateId(profile.id);
      if (remainingActive.length > 0) {
        await ResumeRepository.updateResume(remainingActive[0].id, { isMaster: true });
      }
      await prisma.candidateProfile.update({
        where: { id: profile.id },
        data: { updatedAt: new Date() }
      });
    }

    return archived;
  }

  /**
   * Explicit Permanent Deletion of Resume and its Physical Storage Object
   */
  public static async deleteResumePermanently(userId: string, resumeId: string) {
    const resume = await this.getResumeById(userId, resumeId);
    const profile = await CandidateProfileRepository.findByUserId(userId);

    // 1. Delete physical file from storage if present
    if (resume.storageKey) {
      try {
        await resumeStorage.delete(resume.storageKey);
      } catch (storageErr: any) {
        logger.warn(`Storage delete notice for key ${resume.storageKey}: ${storageErr?.message || storageErr}`);
      }
    }

    // 2. Delete database resume record (and cascading versions)
    await prisma.resume.delete({
      where: { id: resume.id }
    });

    // 3. If deleted resume was preferred, re-assign preferred status to next active
    if (resume.isMaster && profile) {
      const remainingActive = await ResumeRepository.findByCandidateId(profile.id);
      if (remainingActive.length > 0) {
        await ResumeRepository.updateResume(remainingActive[0].id, { isMaster: true });
      }
      await prisma.candidateProfile.update({
        where: { id: profile.id },
        data: { updatedAt: new Date() }
      });
    }

    return { success: true, message: 'Resume permanently deleted' };
  }

  /**
   * Create Immutable Resume Version from current Master Profile
   */
  public static async createVersion(userId: string, resumeId: string, title?: string) {
    const profile = await CandidateProfileRepository.findByUserId(userId);
    if (!profile) {
      throw new NotFoundError('Candidate profile not found');
    }

    const resume = await ResumeRepository.findById(resumeId);
    if (!resume || resume.candidateProfileId !== profile.id) {
      throw new NotFoundError('Resume not found or unauthorized');
    }

    const existingVersions = await ResumeRepository.findVersionsByResumeId(resumeId);
    const nextVersionNum = existingVersions.length + 1;
    const versionTitle = title || `Resume Version ${nextVersionNum}`;

    // Snapshot current candidate profile state
    const snapshot = {
      profile: {
        fullName: profile.fullName,
        headline: profile.headline,
        email: profile.email,
        phone: profile.phone,
        location: profile.location,
        summary: profile.summary,
        linkedinUrl: profile.linkedinUrl,
        githubUrl: profile.githubUrl,
        portfolioUrl: profile.portfolioUrl
      },
      experiences: profile.experiences,
      educations: profile.educations,
      certifications: profile.certifications,
      skills: profile.skills.map(s => ({
        name: s.skill.name,
        category: s.skill.category,
        proficiency: s.proficiency,
        yearsOfExperience: s.yearsOfExperience
      })),
      projects: profile.projects,
      snapshotTimestamp: new Date().toISOString()
    };

    return ResumeRepository.createResumeVersion({
      resumeId,
      versionNumber: nextVersionNum,
      title: versionTitle,
      summary: profile.summary || '',
      versionName: `${profile.fullName.replace(/\s+/g, '_')}_v${nextVersionNum}`,
      contentSnapshot: snapshot,
      structuredContent: snapshot
    });
  }

  /**
   * Get Versions for a resume
   */
  public static async getVersions(userId: string, resumeId: string) {
    const resume = await this.getResumeById(userId, resumeId);
    return ResumeRepository.findVersionsByResumeId(resume.id);
  }

  /**
   * Get Resume Version details by Version ID
   */
  public static async getVersionById(userId: string, versionId: string) {
    const profile = await CandidateProfileRepository.findByUserId(userId);
    if (!profile) {
      throw new NotFoundError('Candidate profile not found');
    }

    const version = await ResumeRepository.findVersionById(versionId);
    if (!version || version.resume.candidateProfileId !== profile.id) {
      throw new NotFoundError('Resume version not found or unauthorized');
    }

    return version;
  }
}
