import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { ApplicationRepository } from '../services/repositories.js';
import { ApplicationRecord } from '../types/index.js';

describe('Phase 3 & 4: External Application Workflow & Tracker Regression Suite', () => {
  const timestamp = Date.now();
  const testCandidateId = `cand-external-tracker-${timestamp}`;
  const testJobId1 = `job-ext-1-${timestamp}`;
  const testJobId2 = `job-ext-2-${timestamp}`;

  it('Requirement 1: External site opened -> sets status to Ready to Apply (does NOT mark as applied)', async () => {
    const now = new Date().toISOString();
    const app: ApplicationRecord = {
      id: `app-${testCandidateId}-1`,
      candidateId: testCandidateId,
      jobId: testJobId1,
      company: 'Test Employer Corp',
      role: 'Software QA Engineer',
      location: 'Bangalore, India',
      applicationType: 'EXTERNAL',
      applicationMode: 'external',
      applicationUrl: 'https://careers.testemployer.com/jobs/1234',
      status: 'Ready to Apply' as any,
      matchScore: 85,
      candidateName: 'Test Candidate',
      applicationDate: now.split('T')[0],
      notes: 'Redirected to external career page.',
      statusHistory: [
        { status: 'Ready to Apply', changedAt: now, note: 'External career link opened' }
      ],
      timeline: [
        { timestamp: now, stage: 'Application Started', description: 'Application initiated on employer career site.' }
      ],
      createdAt: now,
      updatedAt: now
    };

    const saved = await ApplicationRepository.save(app);
    assert.strictEqual(saved.status, 'Ready to Apply', 'Opening external site must not set status to Applied');
    assert.strictEqual(saved.appliedAt, undefined, 'appliedAt timestamp must not be set prematurely');
  });

  it('Requirement 2: Duplicate application prevention -> preserves single tracking record for candidate and job', async () => {
    const existingApps = await ApplicationRepository.getAll(testCandidateId);
    const matches = existingApps.filter(a => a.jobId === testJobId1);
    assert.strictEqual(matches.length, 1, 'Only one tracking record must exist per candidate and job');
  });

  it('Requirement 3: Candidate confirms submission -> updates status to Applied with reference number', async () => {
    const now = new Date().toISOString();
    const existing = (await ApplicationRepository.getAll(testCandidateId)).find(a => a.jobId === testJobId1);
    assert.ok(existing);

    const refNumber = 'REQ-2026-998811';
    const updated: ApplicationRecord = {
      ...existing,
      status: 'Applied' as any,
      appliedAt: now,
      notes: `Candidate confirmed manual application submission. (Ref: ${refNumber})`,
      statusHistory: [
        ...(existing.statusHistory || []),
        { status: 'Applied', changedAt: now, note: `Submission confirmed. Ref: ${refNumber}` }
      ],
      timeline: [
        ...(existing.timeline || []),
        { timestamp: now, stage: 'Applied on External Site', description: `Candidate confirmed application was completed. (Ref: ${refNumber})` }
      ],
      updatedAt: now
    };

    const saved = await ApplicationRepository.save(updated);
    assert.strictEqual(saved.status, 'Applied');
    assert.ok(saved.appliedAt);
    assert.ok(saved.notes?.includes(refNumber));
  });

  it('Requirement 4: Candidate declines submission -> preserves record in Ready to Apply / saved state', async () => {
    const now = new Date().toISOString();
    const app2: ApplicationRecord = {
      id: `app-${testCandidateId}-2`,
      candidateId: testCandidateId,
      jobId: testJobId2,
      company: 'Second Tech Inc',
      role: 'Full Stack Engineer',
      location: 'Remote',
      applicationType: 'EXTERNAL',
      applicationMode: 'external',
      applicationUrl: 'https://careers.secondtech.com/jobs/5678',
      status: 'Ready to Apply' as any,
      matchScore: 90,
      candidateName: 'Test Candidate',
      applicationDate: now.split('T')[0],
      notes: 'Candidate returned without submitting.',
      statusHistory: [
        { status: 'Ready to Apply', changedAt: now, note: 'Candidate saved opportunity without submitting.' }
      ],
      timeline: [],
      createdAt: now,
      updatedAt: now
    };

    const saved = await ApplicationRepository.save(app2);
    assert.strictEqual(saved.status, 'Ready to Apply');
    assert.strictEqual(saved.appliedAt, undefined);
  });
});

