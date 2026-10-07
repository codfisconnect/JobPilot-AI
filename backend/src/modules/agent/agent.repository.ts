import { prisma } from '../../database/prisma.js';
import {
  AgentSessionStatus,
  AgentActionStatus,
  AgentActionType
} from '@prisma/client';

export class AgentRepository {
  async findCandidateProfileByUserId(userId: string) {
    return prisma.candidateProfile.findUnique({
      where: { userId },
      include: {
        skills: { include: { skill: true } },
        preferences: true,
        resumes: {
          include: {
            versions: {
              orderBy: { createdAt: 'desc' },
              take: 2
            }
          }
        },
        applications: {
          include: {
            job: {
              select: {
                id: true,
                title: true,
                location: true,
                company: { select: { name: true } }
              }
            }
          },
          take: 5,
          orderBy: { createdAt: 'desc' }
        }
      }
    });
  }

  async createSession(candidateProfileId: string, title?: string) {
    return prisma.agentSession.create({
      data: {
        candidateProfileId,
        title: title || 'Career Strategy Copilot Session',
        status: AgentSessionStatus.ACTIVE
      }
    });
  }

  async findSessionById(sessionId: string, candidateProfileId: string) {
    return prisma.agentSession.findFirst({
      where: {
        id: sessionId,
        candidateProfileId
      },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' }
        },
        actions: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });
  }

  async listCandidateSessions(candidateProfileId: string) {
    return prisma.agentSession.findMany({
      where: { candidateProfileId },
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: {
          select: { messages: true, actions: true }
        }
      }
    });
  }

  async addMessage(sessionId: string, role: 'USER' | 'ASSISTANT' | 'SYSTEM', content: string, metadata?: any) {
    return prisma.agentMessage.create({
      data: {
        sessionId,
        role,
        content,
        metadata: metadata || null
      }
    });
  }

  async createAction(
    sessionId: string,
    actionType: AgentActionType,
    description: string,
    payload: any,
    creditCost: number,
    status: AgentActionStatus = AgentActionStatus.WAITING_FOR_APPROVAL
  ) {
    return prisma.agentAction.create({
      data: {
        sessionId,
        actionType,
        description,
        payload,
        creditCost,
        status
      }
    });
  }

  async findActionById(actionId: string) {
    return prisma.agentAction.findUnique({
      where: { id: actionId },
      include: {
        session: {
          include: {
            candidateProfile: true
          }
        }
      }
    });
  }

  async updateActionStatus(actionId: string, status: AgentActionStatus) {
    return prisma.agentAction.update({
      where: { id: actionId },
      data: {
        status,
        executedAt: status === AgentActionStatus.EXECUTED ? new Date() : undefined
      }
    });
  }

  async searchTopJobs(query?: string) {
    return prisma.job.findMany({
      where: {
        status: 'ACTIVE',
        ...(query ? { title: { contains: query, mode: 'insensitive' } } : {})
      },
      take: 5,
      include: {
        company: { select: { name: true, logoUrl: true } }
      },
      orderBy: { postedAt: 'desc' }
    });
  }
}
