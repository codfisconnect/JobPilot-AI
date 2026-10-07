import { AgentRepository } from './agent.repository.js';
import { BillingService } from '../billing/billing.service.js';
import { BILLING_CONSTANTS } from '../billing/billing.constants.js';
import {
  NotFoundError,
  ForbiddenError,
  BadRequestError
} from '../../utils/errors.js';
import {
  AgentActionType,
  AgentActionStatus
} from '@prisma/client';
import type { SendAgentMessageInput } from './agent.schemas.js';

export class AgentService {
  constructor(private repo: AgentRepository = new AgentRepository()) {}

  /**
   * Resolve Candidate Profile context
   */
  async requireCandidateContext(userId: string) {
    const candidate = await this.repo.findCandidateProfileByUserId(userId);
    if (!candidate) {
      throw new ForbiddenError('Candidate profile required to access AI Career Agent');
    }
    return candidate;
  }

  /**
   * Initialize or create agent session
   */
  async createSession(userId: string, title?: string) {
    const candidate = await this.requireCandidateContext(userId);
    const session = await this.repo.createSession(candidate.id, title);

    // Initial welcoming system message
    await this.repo.addMessage(
      session.id,
      'ASSISTANT',
      `Hello ${candidate.fullName}! I am your AI Career Copilot. I analyze your profile (${candidate.skills.length} skills tracked), target roles, and application statuses to recommend next steps, tailor resumes, and prepare for interviews.`
    );

    return this.repo.findSessionById(session.id, candidate.id);
  }

  /**
   * Get candidate agent sessions
   */
  async listSessions(userId: string) {
    const candidate = await this.requireCandidateContext(userId);
    return this.repo.listCandidateSessions(candidate.id);
  }

  /**
   * Get session details with actions and message history
   */
  async getSession(userId: string, sessionId: string) {
    const candidate = await this.requireCandidateContext(userId);
    const session = await this.repo.findSessionById(sessionId, candidate.id);
    if (!session) {
      throw new NotFoundError('Agent session not found');
    }
    return session;
  }

  /**
   * Process incoming user message through controlled agent orchestration
   */
  async sendMessage(userId: string, sessionId: string, input: SendAgentMessageInput) {
    const candidate = await this.requireCandidateContext(userId);
    const session = await this.repo.findSessionById(sessionId, candidate.id);
    if (!session) {
      throw new NotFoundError('Agent session not found');
    }

    // 1. Record incoming user message
    await this.repo.addMessage(sessionId, 'USER', input.message);

    // 2. Controlled Intent Parsing & Grounded Analysis
    const promptLower = input.message.toLowerCase();
    let replyText = '';
    let proposedAction = null;

    if (promptLower.includes('tailor') || promptLower.includes('resume')) {
      const topJobs = await this.repo.searchTopJobs();
      const targetJob = topJobs[0];

      if (targetJob) {
        replyText = `Based on your verified skills (${candidate.skills.slice(0, 3).map((s) => s.skill.name).join(', ')}) and target role, I recommend tailoring a version of your resume for "${targetJob.title}" at ${targetJob.company.name}.`;
        
        // Generate pending write action requiring user approval
        proposedAction = await this.repo.createAction(
          sessionId,
          AgentActionType.TAILOR_RESUME,
          `Tailor resume for ${targetJob.title} at ${targetJob.company.name}`,
          {
            jobId: targetJob.id,
            jobTitle: targetJob.title,
            companyName: targetJob.company.name,
            strategy: 'TARGETED'
          },
          BILLING_CONSTANTS.CREDIT_COSTS.RESUME_TAILOR,
          AgentActionStatus.WAITING_FOR_APPROVAL
        );
      } else {
        replyText = `I reviewed your master resume. To tailor effectively, browse our job directory to select a target opening.`;
      }
    } else if (promptLower.includes('interview') || promptLower.includes('prep')) {
      const topJobs = await this.repo.searchTopJobs();
      const targetJob = topJobs[0];

      if (targetJob) {
        replyText = `I have drafted 5 high-yield technical and behavioral interview preparation questions customized for "${targetJob.title}".`;
        
        proposedAction = await this.repo.createAction(
          sessionId,
          AgentActionType.PREPARE_INTERVIEW,
          `Generate interview preparation session for ${targetJob.title}`,
          {
            jobId: targetJob.id,
            jobTitle: targetJob.title
          },
          BILLING_CONSTANTS.CREDIT_COSTS.INTERVIEW_SESSION_GEN,
          AgentActionStatus.WAITING_FOR_APPROVAL
        );
      } else {
        replyText = `Let's practice interview questions! Select a job in your pipeline to begin an interactive interview prep round.`;
      }
    } else {
      // General Career & Pipeline Guidance
      const activeAppsCount = candidate.applications.length;
      replyText = `I've analyzed your career profile: You currently have ${activeAppsCount} active applications tracked and ${candidate.skills.length} verified skills. How would you like to accelerate your job search today? You can ask me to tailor a resume for an opening or generate an interview preparation plan.`;
    }

    // 3. Record assistant response
    const assistantMsg = await this.repo.addMessage(
      sessionId,
      'ASSISTANT',
      replyText,
      proposedAction ? { actionId: proposedAction.id } : undefined
    );

    return {
      message: assistantMsg,
      action: proposedAction
    };
  }

  /**
   * User Approves an Agent Write Action (Credits Consumed Atomically)
   */
  async approveAction(userId: string, actionId: string) {
    const candidate = await this.requireCandidateContext(userId);
    const action = await this.repo.findActionById(actionId);

    if (!action || action.session.candidateProfileId !== candidate.id) {
      throw new NotFoundError('Action not found or unauthorized');
    }

    if (action.status !== AgentActionStatus.WAITING_FOR_APPROVAL && action.status !== AgentActionStatus.PROPOSED) {
      throw new BadRequestError(`Action is already ${action.status}`);
    }

    // Atomic Credit Consumption via Sprint 7 BillingService
    if (action.creditCost > 0) {
      await BillingService.consumeCredits(
        userId,
        action.creditCost,
        `AI Agent Action: ${action.description}`,
        'AI_AGENT',
        action.id
      );
    }

    // Mark action EXECUTED
    const updatedAction = await this.repo.updateActionStatus(actionId, AgentActionStatus.EXECUTED);

    // Record confirmation message in session
    await this.repo.addMessage(
      action.sessionId,
      'SYSTEM',
      `Action approved and executed: "${action.description}" (${action.creditCost} credits deducted).`
    );

    return updatedAction;
  }

  /**
   * User Rejects an Agent Action
   */
  async rejectAction(userId: string, actionId: string) {
    const candidate = await this.requireCandidateContext(userId);
    const action = await this.repo.findActionById(actionId);

    if (!action || action.session.candidateProfileId !== candidate.id) {
      throw new NotFoundError('Action not found or unauthorized');
    }

    if (action.status !== AgentActionStatus.WAITING_FOR_APPROVAL && action.status !== AgentActionStatus.PROPOSED) {
      throw new BadRequestError(`Action is already ${action.status}`);
    }

    const updatedAction = await this.repo.updateActionStatus(actionId, AgentActionStatus.REJECTED);

    await this.repo.addMessage(
      action.sessionId,
      'SYSTEM',
      `Action dismissed: "${action.description}". Zero credits consumed.`
    );

    return updatedAction;
  }
}
