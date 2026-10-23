import { describe, it } from 'node:test';
import assert from 'node:assert';
import { MatchingEngine } from '../analyzers/matching.engine.js';
import { ResumeTailorService } from '../generators/resume.generator.js';
import { evaluateApplicationReadiness, MANDATORY_ATS_THRESHOLD } from '../utils/readiness.js';

// NOTE: This is a DETERMINISTIC FIXTURE-BASED TEST (NOT a live production session smoke test)
describe('Bahwan CyberTek Business Analyst — Fixture-Based Smoke Test Workflow', () => {
  // Candidate: 13.6 years experience, Business Analysis background, verified skills
  const candidateBA: any = {
    id: 'candidate-salman-ba',
    name: 'Salman Verified Candidate',
    email: 'salman.candidate@pilotmama.com',
    phone: '+91 98450 12345',
    location: 'Bengaluru, Karnataka, India',
    yearsOfExperience: 13.6,
    headline: 'Senior Business Analyst / Product Consultant',
    targetRoles: ['Business Analyst', 'Lead Business Analyst'],
    summary: 'Senior Business Analyst with 13.6 years of demonstrated experience in enterprise requirements management, process modeling, and cross-functional agile solution delivery.',
    companies: ['Cognizant', 'Infosys'],
    primarySkills: ['Business Analysis', 'Requirements Gathering', 'Process Modeling', 'SQL', 'Agile Scrum', 'User Stories'],
    secondarySkills: ['JIRA', 'Confluence', 'Data Mapping'],
    technologies: ['SQL', 'JIRA', 'PowerBI', 'Visio'],
    experiences: [
      {
        id: 'exp-1',
        title: 'Lead Business Analyst',
        company: 'Cognizant',
        startDate: '2016-04-01',
        endDate: 'Present',
        isCurrent: true,
        responsibilities: [
          'Led end-to-end business requirements elicitation across financial workflows.',
          'Formulated BRD, FRD, user stories, and acceptance criteria.',
          'Conducted gap analysis and business process modeling for digital platforms.'
        ]
      },
      {
        id: 'exp-2',
        title: 'Senior Business Analyst',
        company: 'Infosys',
        startDate: '2010-06-01',
        endDate: '2016-03-31',
        responsibilities: [
          'Managed stakeholder workshops, process mapping, and functional design.',
          'Wrote SQL scripts for data validation and system requirement verification.'
        ]
      }
    ],
    education: [
      {
        id: 'edu-1',
        degree: 'Bachelor of Engineering',
        institution: 'Visvesvaraya Technological University',
        year: '2010'
      }
    ],
    certifications: ['CBAP - Certified Business Analysis Professional', 'CSPO'],
    projects: [
      {
        id: 'proj-1',
        name: 'Core Banking Modernization',
        description: 'Transformed core banking workflow modules into digital self-service solutions.',
        technologies: ['SQL', 'JIRA', 'Confluence']
      }
    ]
  };

  // Job: Business Analyst — Bahwan CyberTek
  const jobBahwanBA: any = {
    id: 'job-bahwan-ba-001',
    role: 'Business Analyst',
    title: 'Business Analyst',
    company: 'Bahwan CyberTek',
    careerTrack: 'Business Analysis',
    location: 'Bengaluru, India',
    experienceRequired: '10+ years',
    experienceMin: 10,
    mustHaveSkills: ['Business Analysis', 'Requirements Gathering', 'Process Modeling', 'SQL', 'Agile Scrum', 'User Stories'],
    niceToHaveSkills: ['CBAP', 'JIRA'],
    responsibilities: [
      'Bridge business needs and technical delivery by translating complex domain requirements into technical specs.',
      'Conduct process modeling and stakeholder review sessions.',
      'Coordinate with QA squads and development leads.'
    ],
    qualifications: ['Bachelor degree', '10+ years of Business Analyst tenure']
  };

  it('Step 1: Readiness Check shows Match Score (83%+), ATS (64%), with preparation available', async () => {
    // 1. Calculate authoritative match
    const analysis = await MatchingEngine.analyze(candidateBA, jobBahwanBA);
    assert.ok(analysis.scores.overallScore >= 80, `Expected strong match score (>=80), got ${analysis.scores.overallScore}`);

    // Set baseline ATS (64%)
    const originalAts = 64;
    const readiness = evaluateApplicationReadiness({
      candidate: candidateBA,
      job: jobBahwanBA,
      currentAtsScore: originalAts,
      atsThreshold: MANDATORY_ATS_THRESHOLD,
      isExperienceConfirmed: true
    });

    assert.strictEqual(readiness.isAtsPassed, false, 'ATS 64% is below 80%');
    assert.strictEqual(readiness.canProceedToPreparation, true, 'Preparation must remain fully available');
    assert.strictEqual(readiness.canProceedToSubmission, false, 'Automatic submission must not be ready');
    assert.strictEqual(readiness.preparationBlockers.length, 0, 'No preparation blockers exist');
  });

  it('Step 2: Resume Selection displays Master vs Tailored and recalculates ATS', async () => {
    const truthCheck = MatchingEngine.performTruthCheck(candidateBA, jobBahwanBA);
    const tailored = await ResumeTailorService.tailorResume(candidateBA, jobBahwanBA, truthCheck, 0, 'TARGETED');

    // Deterministic ATS calculation for tailored resume (no artificial +8 boost)
    const scores = MatchingEngine.calculateScores(candidateBA, jobBahwanBA, truthCheck, true);
    const tailoredAts = MatchingEngine.performATSAnalysis(candidateBA, jobBahwanBA, truthCheck, scores);
    tailored.atsScore = tailoredAts.estimatedScore;

    // Verify Master Resume score
    const masterReadiness = evaluateApplicationReadiness({
      candidate: candidateBA,
      job: jobBahwanBA,
      currentAtsScore: 64,
      atsThreshold: MANDATORY_ATS_THRESHOLD,
      isExperienceConfirmed: true
    });
    assert.strictEqual(masterReadiness.atsScore, 64);

    // Verify Tailored Resume score is dynamic and independent
    const tailoredReadiness = evaluateApplicationReadiness({
      candidate: candidateBA,
      job: jobBahwanBA,
      currentAtsScore: tailored.atsScore,
      atsThreshold: MANDATORY_ATS_THRESHOLD,
      isExperienceConfirmed: true
    });
    assert.strictEqual(tailoredReadiness.atsScore, tailored.atsScore);
    assert.ok(typeof tailoredReadiness.atsScore === 'number');
  });

  it('Step 2 (View Diff): Exactly references tailored resume ID with zero hallucination', async () => {
    const truthCheck = MatchingEngine.performTruthCheck(candidateBA, jobBahwanBA);
    const tailored = await ResumeTailorService.tailorResume(candidateBA, jobBahwanBA, truthCheck, 0, 'TARGETED');

    assert.ok(tailored.id, 'Must contain canonical version ID');
    assert.strictEqual(tailored.targetCompany, 'Bahwan CyberTek');

    // Absolute truth rule validation
    const candidateOriginalSkills = new Set([...candidateBA.primarySkills, ...candidateBA.secondarySkills, ...candidateBA.technologies]);
    for (const skill of tailored.orderedSkills) {
      assert.ok(candidateOriginalSkills.has(skill), `Fabricated skill detected: ${skill}`);
    }
  });

  it('Step 3: Application Form can be completed while ATS is 64%', () => {
    const readiness = evaluateApplicationReadiness({
      candidate: candidateBA,
      job: jobBahwanBA,
      currentAtsScore: 64,
      atsThreshold: MANDATORY_ATS_THRESHOLD,
      isExperienceConfirmed: true
    });

    // Preparation includes form completion
    assert.strictEqual(readiness.canProceedToPreparation, true);
  });

  it('Step 4: Final Confirmation Gate strictly evaluates ATS >= 80% for submission eligibility', () => {
    // With Master (ATS 64%)
    const gateMaster = evaluateApplicationReadiness({
      candidate: candidateBA,
      job: jobBahwanBA,
      currentAtsScore: 64,
      atsThreshold: MANDATORY_ATS_THRESHOLD,
      isExperienceConfirmed: true
    });
    assert.strictEqual(gateMaster.canProceedToSubmission, false, 'Master resume (64%) must be BLOCKED for auto-submission');
    assert.strictEqual(gateMaster.submissionBlockers.some(b => b.id === 'ATS_BELOW_THRESHOLD'), true);

    // With Qualified Tailored Resume (e.g. ATS 84%)
    const gateQualified = evaluateApplicationReadiness({
      candidate: candidateBA,
      job: jobBahwanBA,
      currentAtsScore: 84,
      atsThreshold: MANDATORY_ATS_THRESHOLD,
      isExperienceConfirmed: true
    });
    assert.strictEqual(gateQualified.canProceedToSubmission, true, 'Qualified resume (84%) must PASS auto-submission gate');
    assert.strictEqual(gateQualified.isAtsPassed, true);
    assert.strictEqual(gateQualified.submissionBlockers.length, 0);
  });
});
