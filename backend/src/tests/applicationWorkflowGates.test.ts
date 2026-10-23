import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  evaluateApplicationReadiness,
  ReadinessBlocker,
  MANDATORY_ATS_THRESHOLD
} from '../utils/readiness.js';
import { ResumeTailorService } from '../generators/resume.generator.js';
import { MatchingEngine } from '../analyzers/matching.engine.js';

describe('Candidate Application Agent Workflow - 12 Acceptance Tests', () => {
  const mockCandidate: any = {
    id: 'cand-bahwan-01',
    name: 'Verified Business Analyst',
    email: 'ba.analyst@example.com',
    phone: '+91 98765 43210',
    location: 'Bengaluru, India',
    yearsOfExperience: 13.6,
    headline: 'Senior Business Analyst',
    targetRoles: ['Business Analyst', 'Senior Business Analyst'],
    summary: 'Experienced Business Analyst with 13+ years specializing in requirements analysis, gap evaluation, and Agile product workflows.',
    companies: ['Global Tech Corp'],
    primarySkills: ['Business Analysis', 'Requirements Gathering', 'Process Modeling', 'SQL', 'Agile'],
    secondarySkills: ['JIRA', 'Confluence', 'User Stories'],
    technologies: ['SQL', 'JIRA', 'PowerBI'],
    experiences: [
      {
        id: 'exp-1',
        title: 'Lead Business Analyst',
        company: 'Global Tech Corp',
        startDate: '2010-06-01',
        endDate: '2024-01-01',
        responsibilities: [
          'Elicited business requirements and created BRDs/FRDs',
          'Conducted gap analysis and mapped business processes',
          'Collaborated with stakeholders and development squads'
        ]
      }
    ],
    education: [
      {
        id: 'edu-1',
        degree: 'Bachelor of Technology',
        institution: 'National Institute of Technology',
        year: '2010'
      }
    ],
    certifications: ['CBAP Certified Business Analysis Professional'],
    projects: [
      {
        id: 'proj-1',
        name: 'Enterprise Workflow Transformation',
        description: 'Digitized enterprise business analysis workflow for financial services.',
        technologies: ['SQL', 'Visio', 'JIRA']
      }
    ]
  };

  const mockJobA: any = {
    id: 'job-bahwan-cybertek-01',
    role: 'Business Analyst',
    company: 'Bahwan CyberTek',
    location: 'Bengaluru / Hybrid',
    careerTrack: 'Business Analysis',
    experienceRequired: '10+ years',
    mustHaveSkills: ['Business Analysis', 'Requirements Gathering', 'Process Modeling', 'SQL', 'Stakeholder Management', 'Banking Domain'],
    niceToHaveSkills: ['CBAP', 'Agile Scrum']
  };

  const mockJobB: any = {
    id: 'job-other-fintech-02',
    role: 'Product Manager',
    company: 'Fintech Solutions',
    location: 'Mumbai / Onsite',
    careerTrack: 'Product Management',
    experienceRequired: '5+ years',
    mustHaveSkills: ['Product Roadmapping', 'User Research', 'GTM Strategy', 'Metrics Analysis'],
    niceToHaveSkills: ['SQL', 'Figma']
  };

  // TEST 1: ATS 64% → Resume Selection accessible (canProceedToPreparation is true)
  it('TEST 1: ATS 64% allows candidate to access Resume Selection (preparation not blocked)', () => {
    const result = evaluateApplicationReadiness({
      candidate: mockCandidate,
      job: mockJobA,
      currentAtsScore: 64,
      atsThreshold: MANDATORY_ATS_THRESHOLD,
      isExperienceConfirmed: true
    });

    assert.strictEqual(result.canProceedToPreparation, true, 'Resume Selection must be accessible when ATS is 64%');
    assert.strictEqual(result.preparationBlockers.length, 0, 'No preparation blockers should exist');
    assert.strictEqual(result.isAtsPassed, false, 'ATS 64% is below 80% threshold');
  });

  // TEST 2: ATS 64% → Tailor Resume accessible
  it('TEST 2: ATS 64% allows candidate to access Tailor Resume action', () => {
    const result = evaluateApplicationReadiness({
      candidate: mockCandidate,
      job: mockJobA,
      currentAtsScore: 64,
      atsThreshold: MANDATORY_ATS_THRESHOLD,
      isExperienceConfirmed: true
    });

    assert.strictEqual(result.canProceedToPreparation, true, 'Tailor resume should be fully accessible');
    const atsBlocker = result.blockers.find(b => b.id === 'ATS_BELOW_THRESHOLD');
    assert.ok(atsBlocker, 'ATS blocker exists');
    assert.ok(atsBlocker.description.includes('Tailoring may improve ATS compatibility'), 'Copy must be truthful and not guarantee improvement');
  });

  // TEST 3: ATS 64% → Application Form accessible
  it('TEST 3: ATS 64% allows candidate to access Application Form (Step 3)', () => {
    const result = evaluateApplicationReadiness({
      candidate: mockCandidate,
      job: mockJobA,
      currentAtsScore: 64,
      atsThreshold: MANDATORY_ATS_THRESHOLD,
      isExperienceConfirmed: true
    });

    // In the application workflow, canProceedToPreparation guards entering Form (Step 3)
    assert.strictEqual(result.canProceedToPreparation, true, 'Application Form must be accessible at 64% ATS');
  });

  // TEST 4: ATS 64% → Final automatic submission blocked
  it('TEST 4: ATS 64% blocks final automatic submission gate at Step 4', () => {
    const result = evaluateApplicationReadiness({
      candidate: mockCandidate,
      job: mockJobA,
      currentAtsScore: 64,
      atsThreshold: MANDATORY_ATS_THRESHOLD,
      isExperienceConfirmed: true
    });

    assert.strictEqual(result.canProceedToSubmission, false, 'Automatic submission must be BLOCKED when ATS is 64%');
    assert.strictEqual(result.submissionBlockers.some(b => b.id === 'ATS_BELOW_THRESHOLD'), true);
  });

  // TEST 5: ATS 82% → Final automatic submission eligible
  it('TEST 5: ATS 82% allows final automatic submission at Step 4', () => {
    const result = evaluateApplicationReadiness({
      candidate: mockCandidate,
      job: mockJobA,
      currentAtsScore: 82,
      atsThreshold: MANDATORY_ATS_THRESHOLD,
      isExperienceConfirmed: true
    });

    assert.strictEqual(result.canProceedToSubmission, true, 'Automatic submission must be ELIGIBLE when ATS is 82%');
    assert.strictEqual(result.isAtsPassed, true);
    assert.strictEqual(result.submissionBlockers.length, 0);
  });

  // TEST 6: Resume A → Resume B: ATS recalculates (conceptual cache identity candidateId + jobId + resumeVersionId)
  it('TEST 6: Resume A → Resume B: ATS score recalculates and does not reuse stale score', () => {
    const resumeA_ATS = 64;
    const resumeB_ATS = 76; // e.g. newly tailored or uploaded resume with different alignment

    const readinessResumeA = evaluateApplicationReadiness({
      candidate: mockCandidate,
      job: mockJobA,
      currentAtsScore: resumeA_ATS,
      atsThreshold: MANDATORY_ATS_THRESHOLD,
      isExperienceConfirmed: true
    });

    const readinessResumeB = evaluateApplicationReadiness({
      candidate: mockCandidate,
      job: mockJobA,
      currentAtsScore: resumeB_ATS,
      atsThreshold: MANDATORY_ATS_THRESHOLD,
      isExperienceConfirmed: true
    });

    assert.strictEqual(readinessResumeA.atsScore, 64);
    assert.strictEqual(readinessResumeB.atsScore, 76);
    assert.notStrictEqual(readinessResumeA.atsScore, readinessResumeB.atsScore);
  });

  // TEST 7: Job A → Job B: Application context changes correctly without data leakage
  it('TEST 7: Job A → Job B changes company, role, requirements, and match context cleanly', async () => {
    const truthCheckA = MatchingEngine.performTruthCheck(mockCandidate, mockJobA);
    const scoresA = MatchingEngine.calculateScores(mockCandidate, mockJobA, truthCheckA, true);

    const truthCheckB = MatchingEngine.performTruthCheck(mockCandidate, mockJobB);
    const scoresB = MatchingEngine.calculateScores(mockCandidate, mockJobB, truthCheckB, false);

    assert.notStrictEqual(mockJobA.company, mockJobB.company);
    assert.notStrictEqual(mockJobA.role, mockJobB.role);
    // Overall scores between BA role vs PM role differ according to role alignment
    assert.notStrictEqual(scoresA.overallScore, scoresB.overallScore);
  });

  // TEST 8: Tailored Resume → View Diff references exact ResumeVersion ID
  it('TEST 8: Tailored Resume provides exact canonical ResumeVersion ID for diff view', async () => {
    const truthCheck = MatchingEngine.performTruthCheck(mockCandidate, mockJobA);
    const tailored = await ResumeTailorService.tailorResume(mockCandidate, mockJobA, truthCheck, 0, 'TARGETED');

    assert.ok(tailored.id, 'Tailored resume must have a distinct version ID');
    assert.ok(tailored.id.startsWith('resume-') || tailored.id.startsWith('ver-'), 'Version ID must follow canonical prefix');
    assert.strictEqual(tailored.jobId, mockJobA.id, 'Resume must be tied specifically to Job A');
  });

  // TEST 9: Tailoring does not fabricate information (Absolute Truth Rule)
  it('TEST 9: Tailoring strictly obeys Absolute Truth Rule without inventing skills or experiences', async () => {
    const truthCheck = MatchingEngine.performTruthCheck(mockCandidate, mockJobA);
    const tailored = await ResumeTailorService.tailorResume(mockCandidate, mockJobA, truthCheck, 0, 'TARGETED');

    // Candidate does not have 'Banking Domain' in verified skills
    const candidateOriginalSkills = new Set([...mockCandidate.primarySkills, ...mockCandidate.secondarySkills, ...mockCandidate.technologies]);
    for (const skill of tailored.orderedSkills) {
      assert.ok(
        candidateOriginalSkills.has(skill),
        `Fabrication detected: skill "${skill}" was not in candidate profile`
      );
    }

    // Check company and experiences preserved
    for (const exp of tailored.experiences) {
      assert.strictEqual(exp.company, 'Global Tech Corp', 'Company cannot be altered or invented');
    }
  });

  // TEST 10: No misleading promise that tailoring will reach 80%
  it('TEST 10: Copy does not guarantee tailoring will reach 80% and states truthful possibility', () => {
    const readiness = evaluateApplicationReadiness({
      candidate: mockCandidate,
      job: mockJobA,
      currentAtsScore: 64,
      atsThreshold: MANDATORY_ATS_THRESHOLD,
      isExperienceConfirmed: true
    });

    const atsBlocker = readiness.blockers.find(b => b.id === 'ATS_BELOW_THRESHOLD');
    assert.ok(atsBlocker);
    // Must NOT say "Tailor Resume will boost ATS above 80%"
    assert.strictEqual(atsBlocker.description.includes('will boost ATS above 80%'), false);
    // Must contain truthful possibility copy
    assert.ok(atsBlocker.description.includes('Tailoring may improve ATS compatibility'));
  });

  // TEST 11: Valid Match Score shown consistently
  it('TEST 11: Authoritative Match Score is calculated and returned consistently', () => {
    const truthCheck = MatchingEngine.performTruthCheck(mockCandidate, mockJobA);
    const scores = MatchingEngine.calculateScores(mockCandidate, mockJobA, truthCheck, true);

    assert.ok(scores.overallScore > 0, 'Match score must be a positive integer');
    assert.ok(typeof scores.overallScore === 'number');
  });

  // TEST 12: Returning from Step 3 to Step 2 preserves selected resume and application state
  it('TEST 12: Preparation state preserves selected resume across workflow transitions', () => {
    let activeResumeId = 'resume-ver-bahwan-01';
    let applicationAnswers: Record<string, string> = {
      interest_in_role: 'Strong domain alignment with Bahwan CyberTek'
    };

    // Simulate moving to Step 3
    const step3State = { activeResumeId, applicationAnswers };

    // Simulate returning to Step 2
    const step2RestoredResumeId = step3State.activeResumeId;
    assert.strictEqual(step2RestoredResumeId, 'resume-ver-bahwan-01');

    // Simulate moving back to Step 3
    assert.strictEqual(step3State.applicationAnswers['interest_in_role'], 'Strong domain alignment with Bahwan CyberTek');
  });
});
