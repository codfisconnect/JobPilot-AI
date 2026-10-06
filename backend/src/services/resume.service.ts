import { ResumeRepository } from '../repositories/resume.repository.js';
import { CandidateProfileRepository } from '../repositories/candidateProfile.repository.js';
import { resumeStorage } from '../storage/localResumeStorage.js';
import { FileValidationService } from './fileValidation.service.js';
import { ResumeTextExtractor, ResumeParsingService } from './resumeParsing.service.js';
import { NotFoundError, ForbiddenError, BadRequestError } from '../utils/errors.js';
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

    // 1. File Validation (magic number, size, extension)
    const validation = FileValidationService.validateUpload(file);

    // 2. Private Storage
    const storageResult = await resumeStorage.upload(
      file!.buffer,
      validation.sanitizedFilename,
      validation.detectedMimeType
    );

    // 3. Create Resume record
    const resume = await ResumeRepository.createResume({
      candidateProfileId: profile.id,
      title: title || validation.sanitizedFilename,
      originalFileName: validation.sanitizedFilename,
      mimeType: validation.detectedMimeType,
      fileSize: storageResult.byteSize,
      storageProvider: storageResult.storageProvider,
      storageKey: storageResult.storageKey,
      status: 'UPLOADED',
      isMaster: false
    });

    return resume;
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
      throw new BadRequestError('Resume file has no associated storage key');
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

    // 1. Update personal details if provided
    if (confirmedData.personalInfo) {
      await CandidateProfileRepository.updateProfile(profile.id, {
        fullName: confirmedData.personalInfo.fullName || profile.fullName,
        headline: confirmedData.personalInfo.headline || profile.headline,
        phone: confirmedData.personalInfo.phone || profile.phone,
        email: confirmedData.personalInfo.email || profile.email,
        location: confirmedData.personalInfo.location || profile.location,
        country: confirmedData.personalInfo.country || profile.country,
        city: confirmedData.personalInfo.city || profile.city,
        stateProvince: confirmedData.personalInfo.stateProvince || profile.stateProvince,
        postalCode: confirmedData.personalInfo.postalCode || profile.postalCode,
        summary: confirmedData.summary || profile.summary,
        linkedinUrl: confirmedData.personalInfo.linkedinUrl || profile.linkedinUrl,
        githubUrl: confirmedData.personalInfo.githubUrl || profile.githubUrl,
        portfolioUrl: confirmedData.personalInfo.portfolioUrl || profile.portfolioUrl
      });
    }

    // 2. Save experiences
    if (Array.isArray(confirmedData.experience)) {
      for (const exp of confirmedData.experience) {
        if (!exp.company || !exp.jobTitle) continue;
        const startDate = exp.startDate ? new Date(exp.startDate) : new Date('2020-01-01');
        const endDate = exp.isCurrent || !exp.endDate ? null : new Date(exp.endDate);

        await CandidateProfileRepository.createExperience(profile.id, {
          company: exp.company,
          jobTitle: exp.jobTitle,
          location: exp.location,
          employmentType: exp.employmentType || 'Full-time',
          startDate: isNaN(startDate.getTime()) ? new Date('2020-01-01') : startDate,
          endDate: endDate && !isNaN(endDate.getTime()) ? endDate : null,
          isCurrent: Boolean(exp.isCurrent),
          description: exp.description,
          responsibilities: exp.responsibilities || [],
          achievements: exp.achievements || [],
          technologies: exp.technologies || [],
          displayOrder: exp.displayOrder ?? 0
        });
      }
    }

    // 3. Save education
    if (Array.isArray(confirmedData.education)) {
      for (const edu of confirmedData.education) {
        if (!edu.institution || !edu.degree) continue;
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

    // 4. Save certifications (only actual certifications)
    if (Array.isArray(confirmedData.certifications)) {
      for (const cert of confirmedData.certifications) {
        if (!cert.name) continue;
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

    // 6. Save projects
    if (Array.isArray(confirmedData.projects)) {
      for (const proj of confirmedData.projects) {
        if (!proj.name) continue;
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
   * List Resumes for Candidate
   */
  public static async getResumes(userId: string) {
    const profile = await CandidateProfileRepository.findByUserId(userId);
    if (!profile) {
      throw new NotFoundError('Candidate profile not found');
    }
    return ResumeRepository.findByCandidateId(profile.id);
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

    return resume;
  }

  /**
   * Archive / Soft delete resume
   */
  public static async archiveResume(userId: string, resumeId: string) {
    const resume = await this.getResumeById(userId, resumeId);
    return ResumeRepository.archiveResume(resume.id);
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
