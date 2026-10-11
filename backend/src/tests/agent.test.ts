import test from 'node:test';
import assert from 'node:assert/strict';
import { AgentRepository } from '../modules/agent/agent.repository.js';
import { AgentService } from '../modules/agent/agent.service.js';
import { BillingService } from '../modules/billing/billing.service.js';
import { BillingRepository } from '../modules/billing/billing.repository.js';
import { prisma } from '../database/prisma.js';
import { AgentActionStatus, AgentActionType, UserRole } from '@prisma/client';

test('Sprint 9: AI Career Agent Test Suite', async (t) => {
  const repo = new AgentRepository();
  const service = new AgentService(repo);

  const timestamp = Date.now();
  const candidateEmail = `agent.user.${timestamp}@pilotmama.test`;
  const otherCandidateEmail = `agent.other.${timestamp}@pilotmama.test`;

  // 1. Create candidate user with skills and wallet
  const user = await prisma.user.create({
    data: {
      email: candidateEmail,
      passwordHash: 'dummy-hash',
      role: UserRole.CANDIDATE,
      candidateProfile: {
        create: {
          fullName: 'Career Agent Test Candidate',
          email: candidateEmail,
          headline: 'Full Stack AI Engineer',
          location: 'Pune, India'
        }
      }
    },
    include: { candidateProfile: true }
  });

  const otherUser = await prisma.user.create({
    data: {
      email: otherCandidateEmail,
      passwordHash: 'dummy-hash',
      role: UserRole.CANDIDATE,
      candidateProfile: {
        create: {
          fullName: 'Other Candidate',
          email: otherCandidateEmail
        }
      }
    },
    include: { candidateProfile: true }
  });

  // Attach a skill to candidate
  const skill = await prisma.skill.create({
    data: {
      name: `AgentTestSkill-${timestamp}`,
      category: 'TECHNICAL'
    }
  });

  await prisma.candidateSkill.create({
    data: {
      candidateProfileId: user.candidateProfile!.id,
      skillId: skill.id,
      proficiency: 'Advanced'
    }
  });

  // Seed plans and wallet with credits for user
  const { seedMasterData } = await import('../database/seedMaster.js');
  await seedMasterData();
  await BillingService.getUserBillingState(user.id); // initial 10 credits

  // Create a target company and job for testing
  const comp = await prisma.company.create({
    data: {
      name: `DeepMind Research ${timestamp}`,
      sourceType: 'DIRECT'
    }
  });

  await prisma.job.create({
    data: {
      companyId: comp.id,
      title: 'Senior AI System Architect',
      description: 'Build mission-critical AI agents for career coaching.',
      contentHash: `job-hash-${timestamp}`,
      sourceType: 'DIRECT',
      sourceName: 'Direct',
      sourceUrl: '',
      status: 'ACTIVE'
    }
  });

  let sessionId: string;
  let actionId: string;

  await t.test('1. Session Initialization creates session and initial assistant message', async () => {
    const session = await service.createSession(user.id, 'My 2026 Career Transition');
    assert.ok(session);
    assert.equal(session.candidateProfileId, user.candidateProfile!.id);
    assert.equal(session.messages.length, 1);
    assert.equal(session.messages[0].role, 'ASSISTANT');
    sessionId = session.id;
  });

  await t.test('2. Resume Tailoring Intent produces structured proposed action (WAITING_FOR_APPROVAL)', async () => {
    const response = await service.sendMessage(user.id, sessionId, {
      message: 'Please help me tailor my resume for the Senior AI System Architect opening.'
    });

    assert.ok(response.message);
    assert.ok(response.action);
    assert.equal(response.action.actionType, AgentActionType.TAILOR_RESUME);
    assert.equal(response.action.status, AgentActionStatus.WAITING_FOR_APPROVAL);
    assert.equal(response.action.creditCost, 5);
    actionId = response.action.id;
  });

  await t.test('3. IDOR Protection: Other candidate cannot approve or access session actions', async () => {
    await assert.rejects(
      async () => service.getSession(otherUser.id, sessionId),
      { name: 'NotFoundError' }
    );

    await assert.rejects(
      async () => service.approveAction(otherUser.id, actionId),
      { name: 'NotFoundError' }
    );
  });

  await t.test('4. Action Approval executes atomically and deducts 5 credits', async () => {
    const initialWallet = await BillingRepository.getWalletByUserId(user.id);
    assert.equal(initialWallet?.balance, 10);

    const executedAction = await service.approveAction(user.id, actionId);
    assert.equal(executedAction.status, AgentActionStatus.EXECUTED);

    const postWallet = await BillingRepository.getWalletByUserId(user.id);
    assert.equal(postWallet?.balance, 5); // 10 - 5 = 5
  });

  await t.test('5. Rejection Flow: Proposing and rejecting an action leaves credits untouched', async () => {
    const response = await service.sendMessage(user.id, sessionId, {
      message: 'Can you generate interview preparation questions?'
    });

    assert.ok(response.action);
    assert.equal(response.action.creditCost, 3);

    const rejectedAction = await service.rejectAction(user.id, response.action.id);
    assert.equal(rejectedAction.status, AgentActionStatus.REJECTED);

    // Balance remains 5
    const wallet = await BillingRepository.getWalletByUserId(user.id);
    assert.equal(wallet?.balance, 5);
  });
});
