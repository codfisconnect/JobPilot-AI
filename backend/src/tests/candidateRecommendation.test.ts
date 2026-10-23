import { describe, it } from 'node:test';
import assert from 'node:assert';
import { JobRecommendationService } from '../services/jobRecommendation.service.js';

describe('Personalized Candidate Job Discovery & Recommendation Suite', () => {
  // Test 1, 2, 3: Candidate Java Backend Developer
  const javaCandidate: any = {
    id: 'cand-java-dev',
    headline: 'Java Backend Developer',
    location: 'Bengaluru, India',
    yearsOfExperience: 6,
    preferences: {
      targetRoles: ['Java Backend Developer', 'Software Engineer'],
      preferredLocations: ['Bengaluru', 'Remote'],
      remotePreference: 'HYBRID'
    },
    skills: [
      { skill: { name: 'Java' } },
      { skill: { name: 'Spring Boot' } },
      { skill: { name: 'REST API' } },
      { skill: { name: 'Microservices' } },
      { skill: { name: 'PostgreSQL' } },
      { skill: { name: 'AWS' } }
    ],
    experiences: [
      {
        id: 'exp-java-1',
        company: 'Cloud Corp',
        startDate: '2018-01-01',
        endDate: '2024-01-01',
        description: '6 years developing microservices in Java and Spring Boot'
      }
    ]
  };

  // Job A: Strong Java Backend Role
  const jobJava: any = {
    id: 'job-java-backend',
    title: 'Senior Java Backend Engineer',
    location: 'Bengaluru, India',
    remoteType: 'HYBRID',
    experienceMin: 5,
    skills: [
      { skill: { name: 'Java' }, skillType: 'REQUIRED' },
      { skill: { name: 'Spring Boot' }, skillType: 'REQUIRED' },
      { skill: { name: 'Microservices' }, skillType: 'REQUIRED' },
      { skill: { name: 'PostgreSQL' }, skillType: 'PREFERRED' },
      { skill: { name: 'AWS' }, skillType: 'PREFERRED' }
    ]
  };

  // Job B: Data Analyst (moderately unrelated)
  const jobDataAnalyst: any = {
    id: 'job-data-analyst',
    title: 'Senior Data Analyst',
    location: 'Bengaluru, India',
    remoteType: 'HYBRID',
    experienceMin: 4,
    skills: [
      { skill: { name: 'Python' }, skillType: 'REQUIRED' },
      { skill: { name: 'SQL' }, skillType: 'REQUIRED' },
      { skill: { name: 'Tableau' }, skillType: 'REQUIRED' },
      { skill: { name: 'PowerBI' }, skillType: 'PREFERRED' }
    ]
  };

  // Job C: Graphic Designer (wholly unrelated)
  const jobGraphicDesigner: any = {
    id: 'job-graphic-designer',
    title: 'Graphic Designer',
    location: 'Chennai, India',
    remoteType: 'ON_SITE',
    experienceMin: 2,
    skills: [
      { skill: { name: 'Figma' }, skillType: 'REQUIRED' },
      { skill: { name: 'Adobe Photoshop' }, skillType: 'REQUIRED' },
      { skill: { name: 'Illustrator' }, skillType: 'REQUIRED' }
    ]
  };

  it('TEST 1: Evaluates high recommendation relevance for Senior Java Backend Engineer', () => {
    const candidateSkillsLower = new Set<string>(javaCandidate.skills.map((s: any) => s.skill.name.toLowerCase()));
    const evalJava = JobRecommendationService.evaluateJobRecommendation(jobJava, {
      primaryRole: javaCandidate.preferences.targetRoles[0],
      secondaryRoles: javaCandidate.preferences.targetRoles.slice(1),
      candidateSkillsLower,
      candidateExpYears: javaCandidate.yearsOfExperience,
      candidateLocation: javaCandidate.location,
      preferredLocations: javaCandidate.preferences.preferredLocations.map((l: string) => l.toLowerCase()),
      remotePref: javaCandidate.preferences.remotePreference
    });

    assert.ok(evalJava.score >= 75, `Expected score >= 75, got ${evalJava.score}`);
    assert.strictEqual(evalJava.isStrongMatch, true);
    assert.ok(evalJava.reasons.length > 0);
  });

  it('TEST 2 & 3: Java candidate gets lower score on Data Analyst and very low on Graphic Designer', () => {
    const candidateSkillsLower = new Set<string>(javaCandidate.skills.map((s: any) => s.skill.name.toLowerCase()));
    const context = {
      primaryRole: javaCandidate.preferences.targetRoles[0],
      secondaryRoles: javaCandidate.preferences.targetRoles.slice(1),
      candidateSkillsLower,
      candidateExpYears: javaCandidate.yearsOfExperience,
      candidateLocation: javaCandidate.location,
      preferredLocations: javaCandidate.preferences.preferredLocations.map((l: string) => l.toLowerCase()),
      remotePref: javaCandidate.preferences.remotePreference
    };

    const evalJava = JobRecommendationService.evaluateJobRecommendation(jobJava, context);
    const evalData = JobRecommendationService.evaluateJobRecommendation(jobDataAnalyst, context);
    const evalDesigner = JobRecommendationService.evaluateJobRecommendation(jobGraphicDesigner, context);

    assert.ok(evalJava.score > evalData.score, `Java (${evalJava.score}) should score higher than Data Analyst (${evalData.score})`);
    assert.ok(evalData.score > evalDesigner.score, `Data Analyst (${evalData.score}) should score higher than Designer (${evalDesigner.score})`);
    assert.ok(evalDesigner.score < 40, `Graphic Designer should have very low relevance, got ${evalDesigner.score}`);
  });

  it('TEST 4: Graphic Designer does NOT outrank Java backend simply due to recency', () => {
    const candidateSkillsLower = new Set<string>(javaCandidate.skills.map((s: any) => s.skill.name.toLowerCase()));
    const context = {
      primaryRole: javaCandidate.preferences.targetRoles[0],
      secondaryRoles: javaCandidate.preferences.targetRoles.slice(1),
      candidateSkillsLower,
      candidateExpYears: javaCandidate.yearsOfExperience,
      candidateLocation: javaCandidate.location,
      preferredLocations: javaCandidate.preferences.preferredLocations.map((l: string) => l.toLowerCase()),
      remotePref: javaCandidate.preferences.remotePreference
    };

    const evalJava = JobRecommendationService.evaluateJobRecommendation(jobJava, context);
    const evalDesigner = JobRecommendationService.evaluateJobRecommendation(jobGraphicDesigner, context);

    // In a recommendation sort:
    const ranked = [
      { title: 'Graphic Designer', score: evalDesigner.score },
      { title: 'Senior Java Backend Engineer', score: evalJava.score }
    ].sort((a, b) => b.score - a.score);

    assert.strictEqual(ranked[0].title, 'Senior Java Backend Engineer');
  });

  it('TEST 5: Role switch from Java Developer to Data Analyst changes recommendations', () => {
    const candidateSkillsLower = new Set<string>(javaCandidate.skills.map((s: any) => s.skill.name.toLowerCase()));
    const javaContext = {
      primaryRole: 'Java Backend Developer',
      secondaryRoles: ['Software Engineer'],
      candidateSkillsLower,
      candidateExpYears: 6,
      candidateLocation: 'Bengaluru, India',
      preferredLocations: ['bengaluru'],
      remotePref: 'HYBRID'
    };

    const analystContext = {
      primaryRole: 'Data Analyst',
      secondaryRoles: ['Business Analyst'],
      candidateSkillsLower,
      candidateExpYears: 6,
      candidateLocation: 'Bengaluru, India',
      preferredLocations: ['bengaluru'],
      remotePref: 'HYBRID'
    };

    const evalJavaWithJavaRole = JobRecommendationService.evaluateJobRecommendation(jobJava, javaContext);
    const evalJavaWithAnalystRole = JobRecommendationService.evaluateJobRecommendation(jobJava, analystContext);

    assert.ok(
      evalJavaWithJavaRole.score > evalJavaWithAnalystRole.score,
      `Java job score under Java role (${evalJavaWithJavaRole.score}) must exceed score under Analyst role (${evalJavaWithAnalystRole.score})`
    );
  });

  it('TEST 6: Adding relevant skill increases job recommendation score', () => {
    const skillsWithoutKafka = new Set(['java', 'spring boot']);
    const skillsWithKafka = new Set(['java', 'spring boot', 'kafka']);

    const jobWithKafka: any = {
      id: 'job-kafka',
      title: 'Java Microservices Engineer',
      location: 'Bengaluru, India',
      remoteType: 'HYBRID',
      experienceMin: 4,
      skills: [
        { skill: { name: 'Java' }, skillType: 'REQUIRED' },
        { skill: { name: 'Spring Boot' }, skillType: 'REQUIRED' },
        { skill: { name: 'Kafka' }, skillType: 'REQUIRED' }
      ]
    };

    const context1 = {
      primaryRole: 'Java Microservices Engineer',
      secondaryRoles: [],
      candidateSkillsLower: skillsWithoutKafka,
      candidateExpYears: 5,
      candidateLocation: 'Bengaluru',
      preferredLocations: ['bengaluru'],
      remotePref: 'HYBRID'
    };

    const context2 = {
      ...context1,
      candidateSkillsLower: skillsWithKafka
    };

    const score1 = JobRecommendationService.evaluateJobRecommendation(jobWithKafka, context1).score;
    const score2 = JobRecommendationService.evaluateJobRecommendation(jobWithKafka, context2).score;

    assert.ok(score2 > score1, `Score with Kafka (${score2}) must be strictly higher than score without Kafka (${score1})`);
  });

  it('TEST 7: Profile state evaluation behaves correctly for empty, partial, and complete', () => {
    // New candidate with no profile and no resume
    const emptyProfile: any = null;
    assert.strictEqual(JobRecommendationService.evaluateProfileState(emptyProfile), 'EMPTY');

    const emptyObj: any = { skills: [], experiences: [], resumes: [], preferences: {} };
    assert.strictEqual(JobRecommendationService.evaluateProfileState(emptyObj), 'EMPTY');

    // Partial: has skills or headline only
    const partialProfile: any = { skills: [{ skill: { name: 'Java' } }], experiences: [], resumes: [] };
    assert.strictEqual(JobRecommendationService.evaluateProfileState(partialProfile), 'PARTIAL');

    // Complete: has skills and experiences or target roles
    const completeProfile: any = {
      skills: [{ skill: { name: 'Java' } }],
      experiences: [{ company: 'Acme' }],
      preferences: { targetRoles: ['Java Developer'] }
    };
    assert.strictEqual(JobRecommendationService.evaluateProfileState(completeProfile), 'COMPLETE');
  });

  it('TEST 8: Score dynamic calculation ensures three different jobs receive distinct scores', () => {
    const candidateSkillsLower = new Set<string>(javaCandidate.skills.map((s: any) => s.skill.name.toLowerCase()));
    const context = {
      primaryRole: javaCandidate.preferences.targetRoles[0],
      secondaryRoles: javaCandidate.preferences.targetRoles.slice(1),
      candidateSkillsLower,
      candidateExpYears: javaCandidate.yearsOfExperience,
      candidateLocation: javaCandidate.location,
      preferredLocations: javaCandidate.preferences.preferredLocations.map((l: string) => l.toLowerCase()),
      remotePref: javaCandidate.preferences.remotePreference
    };

    const scoreA = JobRecommendationService.evaluateJobRecommendation(jobJava, context).score;
    const scoreB = JobRecommendationService.evaluateJobRecommendation(jobDataAnalyst, context).score;
    const scoreC = JobRecommendationService.evaluateJobRecommendation(jobGraphicDesigner, context).score;

    assert.notStrictEqual(scoreA, scoreB, 'Job A and Job B scores must not be identical');
    assert.notStrictEqual(scoreB, scoreC, 'Job B and Job C scores must not be identical');
    assert.notStrictEqual(scoreA, scoreC, 'Job A and Job C scores must not be identical');
    assert.notStrictEqual(scoreA, 75, 'Score A must not be a hardcoded 75');
    assert.notStrictEqual(scoreB, 75, 'Score B must not be a hardcoded 75');
  });
});
