import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  evaluateApplicationReadiness,
  calculateWorkHistoryExperienceYears,
  MANDATORY_ATS_THRESHOLD,
  ReadinessBlocker
} from '../utils/readiness.js';

describe('Application Readiness Data Integrity & Gate Suite', () => {
  const baseCandidate: any = {
    id: 'cand-1',
    name: 'Sarah Connor',
    email: 'sarah@example.com',
    phone: '+1-555-0199',
    location: 'Bengaluru, India',
    yearsOfExperience: 6.8,
    experiences: [
      {
        id: 'exp-1',
        company: 'Acme Corp',
        title: 'QA Tester',
        startDate: '2022-01-01',
        endDate: '2024-01-01', // Exactly 2 years
        isCurrent: false,
        responsibilities: [],
        technologies: []
      }
    ]
  };

  const baseJob: any = {
    id: 'job-1',
    role: 'Performance Testing Engineer',
    company: 'Synechron',
    location: 'Bengaluru - Bellandur (GTP)',
    experienceRequired: '3+ years'
  };

  it('1. Deterministic experience calculation correctly totals work history years without crude multipliers', () => {
    const years = calculateWorkHistoryExperienceYears(baseCandidate.experiences);
    assert.strictEqual(years, 2);
  });

  it('2. Profile experience ≠ work history triggers PROFILE_DATA_CONFLICT blocker with Continue disabled', () => {
    const res = evaluateApplicationReadiness({
      candidate: baseCandidate, // stated: 6.8, history: 2.0
      job: baseJob,
      currentAtsScore: 85,
      isExperienceConfirmed: false
    });

    assert.strictEqual(res.isReady, false);
    assert.strictEqual(res.hasExperienceDiscrepancy, true);
    assert.strictEqual(res.profileStatedYears, 6.8);
    assert.strictEqual(res.workHistoryYears, 2.0);
    assert.strictEqual(res.experienceDiscrepancy, 4.8);

    const conflictBlocker = res.blockers.find((b: ReadinessBlocker) => b.id === 'PROFILE_DATA_CONFLICT');
    assert.ok(conflictBlocker, 'Expected PROFILE_DATA_CONFLICT blocker to be present');
    assert.ok(conflictBlocker?.description.includes('6.8 yrs'));
    assert.ok(conflictBlocker?.description.includes('2 yrs'));
  });

  it('3. Profile experience = work history does not trigger PROFILE_DATA_CONFLICT blocker', () => {
    const candidateAligned = {
      ...baseCandidate,
      yearsOfExperience: 2.0
    };

    const res = evaluateApplicationReadiness({
      candidate: candidateAligned,
      job: baseJob,
      currentAtsScore: 85,
      isExperienceConfirmed: false
    });

    const conflictBlocker = res.blockers.find((b: ReadinessBlocker) => b.id === 'PROFILE_DATA_CONFLICT');
    assert.strictEqual(conflictBlocker, undefined);
    assert.strictEqual(res.hasExperienceDiscrepancy, false);
    assert.strictEqual(res.isReady, true);
  });

  it('4. Candidate confirmed experience discrepancy resolves PROFILE_DATA_CONFLICT blocker', () => {
    const res = evaluateApplicationReadiness({
      candidate: baseCandidate, // stated: 6.8, history: 2.0
      job: baseJob,
      currentAtsScore: 85,
      isExperienceConfirmed: true
    });

    const conflictBlocker = res.blockers.find((b: ReadinessBlocker) => b.id === 'PROFILE_DATA_CONFLICT');
    assert.strictEqual(conflictBlocker, undefined);
    assert.strictEqual(res.isReady, true);
  });

  it('5. Missing candidate location produces MISSING_CANDIDATE_LOCATION while preserving job location', () => {
    const candidateMissingLoc = {
      ...baseCandidate,
      location: ''
    };

    const res = evaluateApplicationReadiness({
      candidate: candidateMissingLoc,
      job: baseJob,
      currentAtsScore: 85,
      isExperienceConfirmed: true
    });

    assert.strictEqual(res.isReady, false);
    assert.strictEqual(res.isLocationMissing, true);
    assert.strictEqual(res.jobLocation, 'Bengaluru - Bellandur (GTP)');
    assert.strictEqual(res.candidateLocation, '');

    const locBlocker = res.blockers.find((b: ReadinessBlocker) => b.id === 'MISSING_CANDIDATE_LOCATION');
    assert.ok(locBlocker, 'Expected MISSING_CANDIDATE_LOCATION blocker');
    assert.ok(locBlocker?.description.includes('Bengaluru - Bellandur (GTP)'));
  });

  it('6. Mandatory ATS Gate: ATS 78% is BLOCKED (requires >= 80%)', () => {
    const res = evaluateApplicationReadiness({
      candidate: { ...baseCandidate, yearsOfExperience: 2.0 },
      job: baseJob,
      currentAtsScore: 78,
      atsThreshold: MANDATORY_ATS_THRESHOLD
    });

    assert.strictEqual(res.isReady, false);
    assert.strictEqual(res.isAtsPassed, false);
    const atsBlocker = res.blockers.find((b: ReadinessBlocker) => b.id === 'ATS_BELOW_THRESHOLD');
    assert.ok(atsBlocker, 'Expected ATS_BELOW_THRESHOLD blocker');
    assert.ok(atsBlocker?.description.includes('78%'));
    assert.ok(atsBlocker?.description.includes('80%'));
  });

  it('7. Mandatory ATS Gate: ATS 79% is BLOCKED (boundary check)', () => {
    const res = evaluateApplicationReadiness({
      candidate: { ...baseCandidate, yearsOfExperience: 2.0 },
      job: baseJob,
      currentAtsScore: 79,
      atsThreshold: 80
    });

    assert.strictEqual(res.isReady, false);
    assert.strictEqual(res.isAtsPassed, false);
    assert.ok(res.blockers.some((b: ReadinessBlocker) => b.id === 'ATS_BELOW_THRESHOLD'));
  });

  it('8. Mandatory ATS Gate: ATS 80% PASSES (boundary check)', () => {
    const res = evaluateApplicationReadiness({
      candidate: { ...baseCandidate, yearsOfExperience: 2.0 },
      job: baseJob,
      currentAtsScore: 80,
      atsThreshold: 80
    });

    assert.strictEqual(res.isAtsPassed, true);
    assert.strictEqual(res.blockers.some((b: ReadinessBlocker) => b.id === 'ATS_BELOW_THRESHOLD'), false);
    assert.strictEqual(res.isReady, true);
  });

  it('9. Mandatory ATS Gate: ATS > 80% (85%) PASSES', () => {
    const res = evaluateApplicationReadiness({
      candidate: { ...baseCandidate, yearsOfExperience: 2.0 },
      job: baseJob,
      currentAtsScore: 85,
      atsThreshold: 80
    });

    assert.strictEqual(res.isAtsPassed, true);
    assert.strictEqual(res.blockers.some((b: ReadinessBlocker) => b.id === 'ATS_BELOW_THRESHOLD'), false);
    assert.strictEqual(res.isReady, true);
  });

  it('10. Multiple blockers: discrepancy (6.8 vs 2.0) + missing location + ATS 78% produces 3 structured blockers and blocks Continue', () => {
    const candidateMultipleErrors = {
      ...baseCandidate,
      yearsOfExperience: 6.8,
      location: ''
    };

    const res = evaluateApplicationReadiness({
      candidate: candidateMultipleErrors,
      job: baseJob,
      currentAtsScore: 78,
      isExperienceConfirmed: false
    });

    assert.strictEqual(res.isReady, false);
    assert.strictEqual(res.blockers.length, 3);
    assert.ok(res.blockers.some((b: ReadinessBlocker) => b.id === 'PROFILE_DATA_CONFLICT'));
    assert.ok(res.blockers.some((b: ReadinessBlocker) => b.id === 'MISSING_CANDIDATE_LOCATION'));
    assert.ok(res.blockers.some((b: ReadinessBlocker) => b.id === 'ATS_BELOW_THRESHOLD'));
  });

  it('11. Zero blockers: resolved experience + valid location + ATS >= 80% enables Continue', () => {
    const candidateResolved = {
      ...baseCandidate,
      location: 'Bengaluru, India'
    };

    const res = evaluateApplicationReadiness({
      candidate: candidateResolved,
      job: baseJob,
      currentAtsScore: 82,
      isExperienceConfirmed: true // confirmed
    });

    assert.strictEqual(res.isReady, true);
    assert.strictEqual(res.blockers.length, 0);
  });
});
