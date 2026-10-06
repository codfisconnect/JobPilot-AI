import { CandidateProfileRepository } from '../repositories/candidateProfile.repository.js';
import { NotFoundError, BadRequestError, ForbiddenError } from '../utils/errors.js';

export class CandidateProfileService {
  public static async getProfile(userId: string) {
    const profile = await CandidateProfileRepository.findByUserId(userId);
    if (!profile) {
      throw new NotFoundError('Candidate profile not found');
    }
    return profile;
  }

  public static async updateProfile(userId: string, data: any) {
    const profile = await this.getProfile(userId);
    return CandidateProfileRepository.updateProfile(profile.id, {
      fullName: data.fullName !== undefined ? data.fullName : profile.fullName,
      headline: data.headline !== undefined ? data.headline : profile.headline,
      phone: data.phone !== undefined ? data.phone : profile.phone,
      email: data.email !== undefined ? data.email : profile.email,
      location: data.location !== undefined ? data.location : profile.location,
      country: data.country !== undefined ? data.country : profile.country,
      city: data.city !== undefined ? data.city : profile.city,
      stateProvince: data.stateProvince !== undefined ? data.stateProvince : profile.stateProvince,
      postalCode: data.postalCode !== undefined ? data.postalCode : profile.postalCode,
      summary: data.summary !== undefined ? data.summary : profile.summary,
      bio: data.bio !== undefined ? data.bio : profile.bio,
      linkedinUrl: data.linkedinUrl !== undefined ? data.linkedinUrl : profile.linkedinUrl,
      githubUrl: data.githubUrl !== undefined ? data.githubUrl : profile.githubUrl,
      portfolioUrl: data.portfolioUrl !== undefined ? data.portfolioUrl : profile.portfolioUrl
    });
  }

  public static async getPreferences(userId: string) {
    const profile = await this.getProfile(userId);
    return profile.preferences || null;
  }

  public static async updatePreferences(userId: string, data: any) {
    const profile = await this.getProfile(userId);
    return CandidateProfileRepository.upsertPreferences(profile.id, {
      targetRoles: data.targetRoles || [],
      preferredLocations: data.preferredLocations || [],
      preferredCountries: data.preferredCountries || [],
      remotePreference: data.remotePreference,
      employmentType: data.employmentType,
      salaryExpectations: data.salaryExpectations,
      minSalary: data.minSalary !== undefined ? data.minSalary : undefined,
      maxSalary: data.maxSalary !== undefined ? data.maxSalary : undefined,
      currency: data.currency || 'USD',
      noticePeriod: data.noticePeriod,
      willingToRelocate: Boolean(data.willingToRelocate),
      preferredWorkArrangement: data.preferredWorkArrangement
    });
  }

  // Experiences
  public static async getExperiences(userId: string) {
    const profile = await this.getProfile(userId);
    return profile.experiences;
  }

  public static async addExperience(userId: string, data: any) {
    const profile = await this.getProfile(userId);
    this.validateExperienceDates(data.startDate, data.endDate, data.isCurrent);

    return CandidateProfileRepository.createExperience(profile.id, {
      company: data.company,
      jobTitle: data.jobTitle,
      location: data.location,
      employmentType: data.employmentType,
      startDate: new Date(data.startDate),
      endDate: data.isCurrent || !data.endDate ? null : new Date(data.endDate),
      isCurrent: Boolean(data.isCurrent),
      description: data.description,
      responsibilities: data.responsibilities || [],
      achievements: data.achievements || [],
      technologies: data.technologies || [],
      displayOrder: data.displayOrder ?? 0
    });
  }

  public static async updateExperience(userId: string, expId: string, data: any) {
    const profile = await this.getProfile(userId);
    const existing = await CandidateProfileRepository.findExperienceById(expId);
    if (!existing || existing.candidateProfileId !== profile.id) {
      throw new NotFoundError('Experience entry not found or unauthorized');
    }

    const startDate = data.startDate ? new Date(data.startDate) : existing.startDate;
    const isCurrent = data.isCurrent !== undefined ? Boolean(data.isCurrent) : existing.isCurrent;
    const endDate = isCurrent ? null : (data.endDate ? new Date(data.endDate) : existing.endDate);

    this.validateExperienceDates(startDate, endDate, isCurrent);

    return CandidateProfileRepository.updateExperience(expId, {
      company: data.company ?? existing.company,
      jobTitle: data.jobTitle ?? existing.jobTitle,
      location: data.location !== undefined ? data.location : existing.location,
      employmentType: data.employmentType !== undefined ? data.employmentType : existing.employmentType,
      startDate,
      endDate,
      isCurrent,
      description: data.description !== undefined ? data.description : existing.description,
      responsibilities: data.responsibilities ?? existing.responsibilities,
      achievements: data.achievements ?? existing.achievements,
      technologies: data.technologies ?? existing.technologies,
      displayOrder: data.displayOrder ?? existing.displayOrder
    });
  }

  public static async deleteExperience(userId: string, expId: string) {
    const profile = await this.getProfile(userId);
    const existing = await CandidateProfileRepository.findExperienceById(expId);
    if (!existing || existing.candidateProfileId !== profile.id) {
      throw new NotFoundError('Experience entry not found or unauthorized');
    }
    return CandidateProfileRepository.deleteExperience(expId);
  }

  // Educations
  public static async getEducations(userId: string) {
    const profile = await this.getProfile(userId);
    return profile.educations;
  }

  public static async addEducation(userId: string, data: any) {
    const profile = await this.getProfile(userId);
    return CandidateProfileRepository.createEducation(profile.id, {
      institution: data.institution,
      degree: data.degree,
      fieldOfStudy: data.fieldOfStudy,
      location: data.location,
      startDate: data.startDate ? new Date(data.startDate) : null,
      endDate: data.endDate ? new Date(data.endDate) : null,
      gradeGpa: data.gradeGpa,
      description: data.description
    });
  }

  public static async updateEducation(userId: string, eduId: string, data: any) {
    const profile = await this.getProfile(userId);
    const existing = await CandidateProfileRepository.findEducationById(eduId);
    if (!existing || existing.candidateProfileId !== profile.id) {
      throw new NotFoundError('Education entry not found or unauthorized');
    }

    return CandidateProfileRepository.updateEducation(eduId, {
      institution: data.institution ?? existing.institution,
      degree: data.degree ?? existing.degree,
      fieldOfStudy: data.fieldOfStudy !== undefined ? data.fieldOfStudy : existing.fieldOfStudy,
      location: data.location !== undefined ? data.location : existing.location,
      startDate: data.startDate ? new Date(data.startDate) : existing.startDate,
      endDate: data.endDate ? new Date(data.endDate) : existing.endDate,
      gradeGpa: data.gradeGpa !== undefined ? data.gradeGpa : existing.gradeGpa,
      description: data.description !== undefined ? data.description : existing.description
    });
  }

  public static async deleteEducation(userId: string, eduId: string) {
    const profile = await this.getProfile(userId);
    const existing = await CandidateProfileRepository.findEducationById(eduId);
    if (!existing || existing.candidateProfileId !== profile.id) {
      throw new NotFoundError('Education entry not found or unauthorized');
    }
    return CandidateProfileRepository.deleteEducation(eduId);
  }

  // Certifications
  public static async getCertifications(userId: string) {
    const profile = await this.getProfile(userId);
    return profile.certifications;
  }

  public static async addCertification(userId: string, data: any) {
    const profile = await this.getProfile(userId);
    return CandidateProfileRepository.createCertification(profile.id, {
      name: data.name,
      issuingOrganization: data.issuingOrganization || 'Accredited Issuer',
      issueDate: data.issueDate ? new Date(data.issueDate) : null,
      expirationDate: data.expirationDate ? new Date(data.expirationDate) : null,
      credentialId: data.credentialId,
      credentialUrl: data.credentialUrl
    });
  }

  public static async updateCertification(userId: string, certId: string, data: any) {
    const profile = await this.getProfile(userId);
    const existing = await CandidateProfileRepository.findCertificationById(certId);
    if (!existing || existing.candidateProfileId !== profile.id) {
      throw new NotFoundError('Certification not found or unauthorized');
    }

    return CandidateProfileRepository.updateCertification(certId, {
      name: data.name ?? existing.name,
      issuingOrganization: data.issuingOrganization ?? existing.issuingOrganization,
      issueDate: data.issueDate ? new Date(data.issueDate) : existing.issueDate,
      expirationDate: data.expirationDate ? new Date(data.expirationDate) : existing.expirationDate,
      credentialId: data.credentialId !== undefined ? data.credentialId : existing.credentialId,
      credentialUrl: data.credentialUrl !== undefined ? data.credentialUrl : existing.credentialUrl
    });
  }

  public static async deleteCertification(userId: string, certId: string) {
    const profile = await this.getProfile(userId);
    const existing = await CandidateProfileRepository.findCertificationById(certId);
    if (!existing || existing.candidateProfileId !== profile.id) {
      throw new NotFoundError('Certification not found or unauthorized');
    }
    return CandidateProfileRepository.deleteCertification(certId);
  }

  // Skills
  public static async getSkills(userId: string) {
    const profile = await this.getProfile(userId);
    return profile.skills;
  }

  public static async addSkill(userId: string, data: any) {
    const profile = await this.getProfile(userId);
    const skill = await CandidateProfileRepository.upsertSkill(data.name, data.category || 'TECHNICAL');
    return CandidateProfileRepository.addCandidateSkill(profile.id, skill.id, {
      proficiency: data.proficiency,
      yearsOfExperience: data.yearsOfExperience !== undefined ? Number(data.yearsOfExperience) : null,
      source: data.source || 'MANUAL',
      displayOrder: data.displayOrder ?? 0
    });
  }

  public static async deleteSkill(userId: string, candidateSkillId: string) {
    const profile = await this.getProfile(userId);
    const existing = await CandidateProfileRepository.findCandidateSkillById(candidateSkillId);
    if (!existing || existing.candidateProfileId !== profile.id) {
      throw new NotFoundError('Skill entry not found or unauthorized');
    }
    return CandidateProfileRepository.deleteCandidateSkill(candidateSkillId);
  }

  // Projects
  public static async getProjects(userId: string) {
    const profile = await this.getProfile(userId);
    return profile.projects;
  }

  public static async addProject(userId: string, data: any) {
    const profile = await this.getProfile(userId);
    return CandidateProfileRepository.createProject(profile.id, {
      name: data.name,
      description: data.description,
      role: data.role,
      technologies: data.technologies || [],
      url: data.url,
      startDate: data.startDate ? new Date(data.startDate) : null,
      endDate: data.endDate ? new Date(data.endDate) : null,
      displayOrder: data.displayOrder ?? 0
    });
  }

  public static async updateProject(userId: string, projectId: string, data: any) {
    const profile = await this.getProfile(userId);
    const existing = await CandidateProfileRepository.findProjectById(projectId);
    if (!existing || existing.candidateProfileId !== profile.id) {
      throw new NotFoundError('Project entry not found or unauthorized');
    }

    return CandidateProfileRepository.updateProject(projectId, {
      name: data.name ?? existing.name,
      description: data.description !== undefined ? data.description : existing.description,
      role: data.role !== undefined ? data.role : existing.role,
      technologies: data.technologies ?? existing.technologies,
      url: data.url !== undefined ? data.url : existing.url,
      startDate: data.startDate ? new Date(data.startDate) : existing.startDate,
      endDate: data.endDate ? new Date(data.endDate) : existing.endDate,
      displayOrder: data.displayOrder ?? existing.displayOrder
    });
  }

  public static async deleteProject(userId: string, projectId: string) {
    const profile = await this.getProfile(userId);
    const existing = await CandidateProfileRepository.findProjectById(projectId);
    if (!existing || existing.candidateProfileId !== profile.id) {
      throw new NotFoundError('Project entry not found or unauthorized');
    }
    return CandidateProfileRepository.deleteProject(projectId);
  }

  private static validateExperienceDates(startDateInput: any, endDateInput: any, isCurrent?: boolean) {
    if (!startDateInput) {
      throw new BadRequestError('Start date is required for work experience');
    }
    const start = new Date(startDateInput);
    if (isNaN(start.getTime())) {
      throw new BadRequestError('Invalid start date format');
    }

    if (isCurrent && endDateInput) {
      throw new BadRequestError('Current jobs cannot have an end date');
    }

    if (!isCurrent && endDateInput) {
      const end = new Date(endDateInput);
      if (isNaN(end.getTime())) {
        throw new BadRequestError('Invalid end date format');
      }
      if (end < start) {
        throw new BadRequestError('End date cannot precede start date');
      }
    }
  }
}
