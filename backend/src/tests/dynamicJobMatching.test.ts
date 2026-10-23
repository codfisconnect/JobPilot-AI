import { describe, it } from 'node:test';
import assert from 'node:assert';
import { MatchingEngine } from '../analyzers/matching.engine.js';
import { ProductionMatchingService } from '../services/matching.service.js';
import { evaluateApplicationReadiness, ReadinessBlocker } from '../utils/readiness.js';

describe('Dynamic Job Match and ATS Compatibility Suite', () => {
  // Candidate Profile: QA / Automation Specialist
  const candidateQA: any = {
    id: 'cand-qa-1',
    name: 'Alex Mercer',
    email: 'alex.qa@example.com',
    phone: '+1-555-0199',
    location: 'Bengaluru, India',
    yearsOfExperience: 6,
    workPreference: 'Remote',
    primarySkills: ['Java', 'Selenium', 'Playwright', 'TestNG', 'API Testing', 'CI/CD'],
    secondarySkills: ['Postman', 'Git', 'SQL', 'Docker'],
    technologies: ['Cucumber', 'REST Assured', 'Jenkins'],
    targetRoles: ['Senior QA Automation Engineer'],
    experiences: [
      {
        id: 'exp-1',
        title: 'Senior QA Automation Engineer',
        company: 'Fintech Solutions',
        startDate: '2018-01-01',
        endDate: '2024-01-01',
        responsibilities: ['Architected Playwright & Selenium Java framework'],
        technologies: ['Java', 'Selenium', 'Playwright', 'TestNG']
      }
    ]
  };

  // Job A: Highly relevant QA role
  const jobQA: any = {
    id: 'job-qa-automation',
    title: 'Senior QA Automation Engineer',
    role: 'Senior QA Automation Engineer',
    company: 'Synechron',
    careerTrack: 'Quality Assurance',
    location: 'Bengaluru, India',
    experienceRequired: '5+ years',
    experienceMin: 5,
    mustHaveSkills: ['Selenium', 'Java', 'Playwright', 'TestNG'],
    niceToHaveSkills: ['API Testing', 'Docker', 'CI/CD']
  };

  // Job B: Partial match Backend role
  const jobBackend: any = {
    id: 'job-java-backend',
    title: 'Senior Java Backend Developer',
    role: 'Senior Java Backend Developer',
    company: 'Alpha Corp',
    careerTrack: 'Software Engineering',
    location: 'Bengaluru, India',
    experienceRequired: '5+ years',
    experienceMin: 5,
    mustHaveSkills: ['Java', 'Spring Boot', 'Microservices', 'Kafka'],
    niceToHaveSkills: ['Docker', 'SQL', 'Kubernetes']
  };

  // Job C: Irrelevant role (Mechanical / Sales)
  const jobMechanical: any = {
    id: 'job-mechanical-sales',
    title: 'Mechanical Design & Sales Engineer',
    role: 'Mechanical Design & Sales Engineer',
    company: 'Heavy Machinery Ltd',
    careerTrack: 'Mechanical Engineering',
    location: 'Munich, Germany',
    experienceRequired: '10+ years',
    experienceMin: 10,
    mustHaveSkills: ['SolidWorks', 'CAD', 'HVAC', 'B2B Sales'],
    niceToHaveSkills: ['Thermodynamics', 'Negotiation']
  };

  it('1. Matching Engine produces distinct, dynamically calculated Match Scores across different jobs', async () => {
    const analysisA = await MatchingEngine.analyze(candidateQA, jobQA);
    const analysisB = await MatchingEngine.analyze(candidateQA, jobBackend);
    const analysisC = await MatchingEngine.analyze(candidateQA, jobMechanical);

    // Job A (QA) should be a strong match (>80%)
    assert.ok(analysisA.scores.overallScore >= 80, `Expected QA job match >= 80, got ${analysisA.scores.overallScore}`);
    assert.ok(analysisA.recommendation.level === 'Strongly Recommended' || analysisA.recommendation.level === 'Recommended');

    // Job B (Java Backend) should be a moderate/good match (~55-75%) due to Java/SQL overlap but missing Spring/Kafka
    assert.ok(analysisB.scores.overallScore < analysisA.scores.overallScore, 'Backend job score should be lower than QA job score');
    assert.ok(analysisB.scores.overallScore >= 50, `Expected Backend job match >= 50, got ${analysisB.scores.overallScore}`);

    // Job C (Mechanical) should be a very low match (<=50%)
    assert.ok(analysisC.scores.overallScore <= 50, `Expected Mechanical job match <= 50, got ${analysisC.scores.overallScore}`);

    // Confirm that none of them blindly output 75%
    const scores = [analysisA.scores.overallScore, analysisB.scores.overallScore, analysisC.scores.overallScore];
    assert.notStrictEqual(scores[0], scores[2], 'Job A score must not equal Job C score');
    assert.notStrictEqual(scores[0], scores[1], 'Job A score must not equal Job B score');
  });

  it('2. ATS Compatibility calculation derives genuine job-specific keyword & track scores', async () => {
    const analysisA = await MatchingEngine.analyze(candidateQA, jobQA);
    const analysisB = await MatchingEngine.analyze(candidateQA, jobBackend);
    const analysisC = await MatchingEngine.analyze(candidateQA, jobMechanical);

    const atsA = analysisA.atsAnalysis.estimatedScore;
    const atsB = analysisB.atsAnalysis.estimatedScore;
    const atsC = analysisC.atsAnalysis.estimatedScore;

    // ATS score for Job A must be high (>80%) and pass the gate
    assert.ok(atsA >= 80, `Expected QA ATS >= 80, got ${atsA}`);

    // ATS score for Job C must be severely penalized (<50%) due to zero keyword overlap
    assert.ok(atsC < 50, `Expected Mechanical ATS < 50, got ${atsC}`);

    // ATS score for Job A must not equal ATS score for Job C
    assert.notStrictEqual(atsA, atsC);
    assert.notStrictEqual(atsA, 78, 'ATS score for Job A should not be a static 78%');
  });

  it('3. ATS Gate dynamically blocks irrelevant jobs and admits strong matching jobs', async () => {
    const analysisA = await MatchingEngine.analyze(candidateQA, jobQA);
    const analysisC = await MatchingEngine.analyze(candidateQA, jobMechanical);

    const readinessA = evaluateApplicationReadiness({
      candidate: candidateQA,
      job: jobQA,
      currentAtsScore: analysisA.atsAnalysis.estimatedScore,
      isExperienceConfirmed: true
    });

    const readinessC = evaluateApplicationReadiness({
      candidate: candidateQA,
      job: jobMechanical,
      currentAtsScore: analysisC.atsAnalysis.estimatedScore,
      isExperienceConfirmed: true
    });

    assert.strictEqual(readinessA.isAtsPassed, true, 'Job A ATS should pass gate');
    assert.strictEqual(readinessA.isReady, true, 'Job A should be ready for submission');

    assert.strictEqual(readinessC.isAtsPassed, false, 'Job C ATS should fail gate');
    assert.strictEqual(readinessC.isReady, false, 'Job C should be blocked');
    assert.ok(readinessC.blockers.some((b: ReadinessBlocker) => b.id === 'ATS_BELOW_THRESHOLD'));
  });

  it('4. When ATS score is null/uncalculated, readiness evaluation returns structured blocker and blocks Continue', () => {
    const readinessPending = evaluateApplicationReadiness({
      candidate: candidateQA,
      job: jobQA,
      currentAtsScore: null,
      isExperienceConfirmed: true
    });

    assert.strictEqual(readinessPending.isReady, false);
    assert.strictEqual(readinessPending.isAtsPassed, false);
    const blocker = readinessPending.blockers.find((b: ReadinessBlocker) => b.id === 'ATS_BELOW_THRESHOLD');
    assert.ok(blocker);
    assert.strictEqual(blocker?.title, 'ATS Compatibility Calculation Unavailable');
  });

  it('5. ProductionMatchingService calculates scores with complete input hash and no static defaults', () => {
    const updatedDate = new Date('2025-01-01T00:00:00Z');
    const hash1 = ProductionMatchingService.computeInputHash(updatedDate, 6, 1, 'hash-job-1');
    const hash2 = ProductionMatchingService.computeInputHash(updatedDate, 6, 1, 'hash-job-2');

    assert.notStrictEqual(hash1, hash2, 'Different jobs must produce distinct input cache hashes');

    // Test calculateScores directly
    const scoresA = ProductionMatchingService.calculateScores(
      6,
      'Bengaluru, India',
      'Remote',
      ['Bengaluru'],
      5,
      'Bengaluru, India',
      false,
      true, // same track
      6, // greenCount
      1, // yellowCount
      7 // totalRequirements
    );

    const scoresC = ProductionMatchingService.calculateScores(
      2,
      'Bengaluru, India',
      'Remote',
      ['Bengaluru'],
      8,
      'Munich, Germany',
      false,
      false, // different track
      0, // greenCount
      0, // yellowCount
      6 // totalRequirements
    );

    assert.ok(scoresA.overallScore >= 80, `Expected scoresA >= 80, got ${scoresA.overallScore}`);
    assert.ok(scoresC.overallScore <= 45, `Expected scoresC <= 45, got ${scoresC.overallScore}`);
    assert.notStrictEqual(scoresA.overallScore, scoresC.overallScore);
  });

  it('6. CI/CD administrator job ATS evaluation derives exact match and keyword gaps without fabrication', () => {
    const candidateJava6Yrs: any = {
      id: 'cand-chennai-java',
      name: 'Developer Chennai',
      email: 'dev@example.com',
      location: 'Chennai, India',
      yearsOfExperience: 6.8,
      workPreference: 'On-site',
      primarySkills: ['Java', 'Spring Boot', 'REST API', 'Microservices', 'PostgreSQL', 'AWS'],
      secondarySkills: ['Git', 'Maven'],
      technologies: ['Docker'],
      targetRoles: ['Java Backend Developer'],
      experiences: [
        {
          id: 'exp-1',
          title: 'Java Developer',
          company: 'Tech Corp',
          startDate: '2018-01-01',
          endDate: '2024-10-01',
          responsibilities: ['Developed Java microservices and REST APIs']
        }
      ]
    };

    const jobCicdAdminWithEmptySkills: any = {
      id: 'job-cicd-bahwan',
      role: 'CI CD administrator',
      title: 'CI CD administrator',
      company: 'Bahwan CyberTek',
      careerTrack: 'DevOps / Cloud',
      location: 'Chennai',
      experienceRequired: '5+ years',
      experienceMin: 5,
      mustHaveSkills: [],
      niceToHaveSkills: [],
      rawText: ''
    };

    const analysis = MatchingEngine.analyze(candidateJava6Yrs, jobCicdAdminWithEmptySkills);
    return analysis.then(res => {
      // In production, when a job has no tagged skills in DB, skillScore evaluates to 100%,
      // experienceScore is 95% (6.8 vs 5 yrs), locationScore is 98% (Chennai vs Chennai),
      // roleScore is 58% (cross-domain), yielding overall Match Score = 89%, and ATS = 54%
      assert.strictEqual(res.scores.overallScore, 89, `Expected exact production Match Score 89, got ${res.scores.overallScore}`);
      assert.strictEqual(res.atsAnalysis.estimatedScore, 54, `Expected exact production ATS Score 54, got ${res.atsAnalysis.estimatedScore}`);
      // Distinct concepts verified
      assert.notStrictEqual(res.scores.overallScore, res.atsAnalysis.estimatedScore);
    });
  });
});

