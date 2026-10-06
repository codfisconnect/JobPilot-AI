import { prisma } from '../database/prisma.js';
import type {
  CandidateProfile,
  CandidatePreference,
  Experience,
  Education,
  Certification,
  Project,
  CandidateSkill
} from '@prisma/client';

export class CandidateProfileRepository {
  public static async findByUserId(userId: string) {
    return prisma.candidateProfile.findUnique({
      where: { userId },
      include: {
        preferences: true,
        experiences: { orderBy: { displayOrder: 'asc' } },
        educations: { orderBy: { startDate: 'desc' } },
        certifications: { orderBy: { issueDate: 'desc' } },
        projects: { orderBy: { displayOrder: 'asc' } },
        skills: {
          include: { skill: true },
          orderBy: { displayOrder: 'asc' }
        },
        resumes: {
          where: { status: { not: 'ARCHIVED' } },
          orderBy: { uploadedAt: 'desc' },
          include: { versions: { orderBy: { versionNumber: 'desc' } } }
        }
      }
    });
  }

  public static async findById(id: string) {
    return prisma.candidateProfile.findUnique({
      where: { id },
      include: {
        preferences: true,
        experiences: { orderBy: { displayOrder: 'asc' } },
        educations: { orderBy: { startDate: 'desc' } },
        certifications: { orderBy: { issueDate: 'desc' } },
        projects: { orderBy: { displayOrder: 'asc' } },
        skills: {
          include: { skill: true },
          orderBy: { displayOrder: 'asc' }
        }
      }
    });
  }

  public static async updateProfile(id: string, data: Partial<CandidateProfile>) {
    return prisma.candidateProfile.update({
      where: { id },
      data
    });
  }

  public static async upsertPreferences(candidateProfileId: string, data: Partial<CandidatePreference>) {
    return prisma.candidatePreference.upsert({
      where: { candidateProfileId },
      update: data,
      create: {
        candidateProfileId,
        ...data
      }
    });
  }

  // Experience CRUD
  public static async findExperienceById(id: string) {
    return prisma.experience.findUnique({ where: { id } });
  }

  public static async createExperience(candidateProfileId: string, data: any) {
    return prisma.experience.create({
      data: {
        ...data,
        candidateProfileId
      }
    });
  }

  public static async updateExperience(id: string, data: any) {
    return prisma.experience.update({
      where: { id },
      data
    });
  }

  public static async deleteExperience(id: string) {
    return prisma.experience.delete({ where: { id } });
  }

  // Education CRUD
  public static async findEducationById(id: string) {
    return prisma.education.findUnique({ where: { id } });
  }

  public static async createEducation(candidateProfileId: string, data: any) {
    return prisma.education.create({
      data: {
        ...data,
        candidateProfileId
      }
    });
  }

  public static async updateEducation(id: string, data: any) {
    return prisma.education.update({
      where: { id },
      data
    });
  }

  public static async deleteEducation(id: string) {
    return prisma.education.delete({ where: { id } });
  }

  // Certification CRUD
  public static async findCertificationById(id: string) {
    return prisma.certification.findUnique({ where: { id } });
  }

  public static async createCertification(candidateProfileId: string, data: any) {
    return prisma.certification.create({
      data: {
        ...data,
        candidateProfileId
      }
    });
  }

  public static async updateCertification(id: string, data: any) {
    return prisma.certification.update({
      where: { id },
      data
    });
  }

  public static async deleteCertification(id: string) {
    return prisma.certification.delete({ where: { id } });
  }

  // Project CRUD
  public static async findProjectById(id: string) {
    return prisma.project.findUnique({ where: { id } });
  }

  public static async createProject(candidateProfileId: string, data: any) {
    return prisma.project.create({
      data: {
        ...data,
        candidateProfileId
      }
    });
  }

  public static async updateProject(id: string, data: any) {
    return prisma.project.update({
      where: { id },
      data
    });
  }

  public static async deleteProject(id: string) {
    return prisma.project.delete({ where: { id } });
  }

  // Skill CRUD
  public static async findCandidateSkillById(id: string) {
    return prisma.candidateSkill.findUnique({
      where: { id },
      include: { skill: true }
    });
  }

  public static async upsertSkill(skillName: string, category: any = 'TECHNICAL') {
    return prisma.skill.upsert({
      where: { name: skillName.trim() },
      update: {},
      create: {
        name: skillName.trim(),
        category
      }
    });
  }

  public static async addCandidateSkill(candidateProfileId: string, skillId: string, data: any) {
    return prisma.candidateSkill.upsert({
      where: {
        candidateProfileId_skillId: {
          candidateProfileId,
          skillId
        }
      },
      update: {
        proficiency: data.proficiency,
        yearsOfExperience: data.yearsOfExperience,
        source: data.source,
        displayOrder: data.displayOrder
      },
      create: {
        candidateProfileId,
        skillId,
        proficiency: data.proficiency,
        yearsOfExperience: data.yearsOfExperience,
        source: data.source || 'MANUAL',
        displayOrder: data.displayOrder || 0
      },
      include: { skill: true }
    });
  }

  public static async deleteCandidateSkill(id: string) {
    return prisma.candidateSkill.delete({ where: { id } });
  }
}
