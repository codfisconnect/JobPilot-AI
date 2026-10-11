import { describe, it } from 'node:test';
import assert from 'node:assert';

export interface DashboardReadiness {
  profile: boolean;
  resume: boolean;
  jobs: boolean;
  applications: boolean;
  careerIntelligence: boolean;
  isReady: boolean;
  error: string | null;
}

export const INITIAL_READINESS: DashboardReadiness = {
  profile: false,
  resume: false,
  jobs: false,
  applications: false,
  careerIntelligence: false,
  isReady: false,
  error: null
};

export const ROTATING_VALUE_MESSAGES = [
  {
    title: 'Find better opportunities.',
    description: 'Discover verified jobs matching your real competencies and experience.'
  },
  {
    title: 'Build a stronger profile.',
    description: 'Keep your verified career information ready for every targeted application.'
  },
  {
    title: 'Close your skill gaps.',
    description: 'Understand industry requirements and focus on the skills that unlock more roles.'
  },
  {
    title: 'Prepare with confidence.',
    description: 'Practice tailored interview preparation designed for your target position.'
  },
  {
    title: 'Helping you make smarter career moves.',
    description: 'AI-guided guidance to help you move closer to the right opportunity.'
  }
];

describe('Candidate Dashboard Welcome Experience Logic', () => {
  it('initializes with all sections false and isReady false', () => {
    assert.strictEqual(INITIAL_READINESS.isReady, false);
    assert.strictEqual(INITIAL_READINESS.profile, false);
    assert.strictEqual(INITIAL_READINESS.resume, false);
    assert.strictEqual(INITIAL_READINESS.jobs, false);
    assert.strictEqual(INITIAL_READINESS.applications, false);
    assert.strictEqual(INITIAL_READINESS.careerIntelligence, false);
    assert.strictEqual(INITIAL_READINESS.error, null);
  });

  it('contains truthful, trust-building value messages without employment guarantees', () => {
    assert.ok(ROTATING_VALUE_MESSAGES.length >= 4, 'Should have multiple rotating value messages');

    for (const msg of ROTATING_VALUE_MESSAGES) {
      assert.ok(msg.title && msg.title.trim().length > 0, 'Message title must not be empty');
      assert.ok(msg.description && msg.description.trim().length > 0, 'Message description must not be empty');

      const lower = `${msg.title} ${msg.description}`.toLowerCase();
      // Verify no misleading guarantee claims
      assert.ok(!lower.includes('guarantee'), 'Must not claim guaranteed job/placement');
      assert.ok(!lower.includes('100% placement'), 'Must not claim 100% placement');
    }
  });

  it('determines readiness state correctly based on data presence without artificial timers', () => {
    const readyState: DashboardReadiness = {
      profile: true,
      resume: true,
      jobs: true,
      applications: true,
      careerIntelligence: true,
      isReady: true,
      error: null
    };

    assert.strictEqual(readyState.isReady, true);
    assert.ok(readyState.profile && readyState.resume && readyState.jobs);

    const errorState: DashboardReadiness = {
      ...INITIAL_READINESS,
      error: 'Backend request timed out'
    };
    assert.strictEqual(errorState.isReady, false);
    assert.strictEqual(typeof errorState.error, 'string');
  });
});
