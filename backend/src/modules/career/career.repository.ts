import { prisma } from '../../database/prisma.js';
import type {
  LearningPlan,
  LearningPlanItem,
  LearningProgress,
  CareerTrackAssessment,
  LearningItemStatus,
  SkillGapClassification
} from '@prisma/client';

export class CareerRepository {
  public static async createPlan(data: {
    candidateProfileId: string;
    jobId?: string | null;
    title: string;
    description?: string | null;
    targetRole?: string | null;
  }): Promise<LearningPlan> {
    return prisma.learningPlan.create({
      data: {
        candidateProfileId: data.candidateProfileId,
        jobId: data.jobId || null,
        title: data.title,
        description: data.description || null,
        targetRole: data.targetRole || null
      },
      include: {
        items: {
          orderBy: { displayOrder: 'asc' },
          include: { progress: { orderBy: { loggedAt: 'desc' } } }
        },
        job: { select: { id: true, title: true, company: { select: { name: true } } } }
      }
    });
  }

  public static async findPlanById(id: string) {
    return prisma.learningPlan.findUnique({
      where: { id },
      include: {
        candidateProfile: true,
        job: { select: { id: true, title: true, company: { select: { name: true } } } },
        items: {
          orderBy: { displayOrder: 'asc' },
          include: { progress: { orderBy: { loggedAt: 'desc' } } }
        }
      }
    });
  }

  public static async findPlansByCandidate(candidateProfileId: string) {
    return prisma.learningPlan.findMany({
      where: { candidateProfileId },
      orderBy: { createdAt: 'desc' },
      include: {
        job: { select: { id: true, title: true, company: { select: { name: true } } } },
        items: {
          orderBy: { displayOrder: 'asc' },
          include: { progress: { orderBy: { loggedAt: 'desc' } } }
        }
      }
    });
  }

  public static async createPlanItems(planId: string, items: Array<{
    skillName: string;
    classification: SkillGapClassification;
    priority: string;
    rationale: string;
    suggestedAction: string;
    verifiedResources?: any;
    displayOrder: number;
  }>): Promise<LearningPlanItem[]> {
    const created: LearningPlanItem[] = [];
    for (const item of items) {
      const rec = await prisma.learningPlanItem.create({
        data: {
          planId,
          skillName: item.skillName,
          classification: item.classification,
          priority: item.priority,
          rationale: item.rationale,
          suggestedAction: item.suggestedAction,
          verifiedResources: item.verifiedResources || null,
          displayOrder: item.displayOrder,
          status: 'NOT_STARTED'
        }
      });
      created.push(rec);
    }
    return created;
  }

  public static async findPlanItemById(itemId: string) {
    return prisma.learningPlanItem.findUnique({
      where: { id: itemId },
      include: {
        plan: { include: { candidateProfile: true } },
        progress: { orderBy: { loggedAt: 'desc' } }
      }
    });
  }

  public static async updatePlanItem(itemId: string, data: {
    status?: LearningItemStatus;
    targetDate?: Date | null;
  }) {
    return prisma.learningPlanItem.update({
      where: { id: itemId },
      data: {
        ...(data.status ? { status: data.status } : {}),
        ...(data.targetDate !== undefined ? { targetDate: data.targetDate } : {})
      },
      include: {
        progress: { orderBy: { loggedAt: 'desc' } }
      }
    });
  }

  public static async logProgress(itemId: string, data: {
    status: LearningItemStatus;
    notes?: string | null;
    hoursSpent?: number;
  }): Promise<LearningProgress> {
    return prisma.learningProgress.create({
      data: {
        itemId,
        status: data.status,
        notes: data.notes || null,
        hoursSpent: data.hoursSpent || 0
      }
    });
  }

  public static async saveCareerAssessment(data: {
    candidateProfileId: string;
    currentTrack: string;
    targetTrack: string;
    readinessScore: number;
    isSameTrack: boolean;
    transitionGapExplanation?: string | null;
    verifiedStrengths: string[];
    transferableSkills: string[];
    missingPriorities: string[];
    recommendations: string[];
    evidenceBasis: any;
  }): Promise<CareerTrackAssessment> {
    return prisma.careerTrackAssessment.create({
      data: {
        candidateProfileId: data.candidateProfileId,
        currentTrack: data.currentTrack,
        targetTrack: data.targetTrack,
        readinessScore: data.readinessScore,
        isSameTrack: data.isSameTrack,
        transitionGapExplanation: data.transitionGapExplanation || null,
        verifiedStrengths: data.verifiedStrengths,
        transferableSkills: data.transferableSkills,
        missingPriorities: data.missingPriorities,
        recommendations: data.recommendations,
        evidenceBasis: data.evidenceBasis
      }
    });
  }

  public static async getLatestCareerAssessment(candidateProfileId: string) {
    return prisma.careerTrackAssessment.findFirst({
      where: { candidateProfileId },
      orderBy: { createdAt: 'desc' }
    });
  }
}
