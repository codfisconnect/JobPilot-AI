import { ResumeParserService } from '../parsers/resume.parser.js';
import { JobParserService } from '../parsers/job.parser.js';
import { MatchingEngine } from '../analyzers/matching.engine.js';
import { ResumeTailorService } from '../generators/resume.generator.js';
import { demoCandidates, demoJobs } from '../database/seed.js';

async function runTestSuite() {
  console.log('--- Running JobPilot AI Critical Backend Test Suite ---\n');
  let passed = 0;
  let total = 0;

  function assert(condition: boolean, desc: string) {
    total++;
    if (condition) {
      console.log(`[PASS] ${desc}`);
      passed++;
    } else {
      console.error(`[FAIL] ${desc}`);
    }
  }

  // Test 1: Resume deterministic rule-based parsing
  const rawResumeText = `
Aarav Sharma
aarav@example.com | +91 9876543210
5.5 years of experience in QA Automation and SDET.
Skills: Java, Selenium, Playwright, Jenkins, SQL, API Testing.
Previous Company: Infosys Technologies.
`;
  const parsedResume = ResumeParserService.ruleBasedParse(rawResumeText);
  assert(parsedResume.name === 'Aarav Sharma', 'Resume Parser extracts candidate name');
  assert(parsedResume.yearsOfExperience === 5.5, 'Resume Parser extracts years of experience');
  assert(parsedResume.primarySkills!.includes('Java'), 'Resume Parser extracts primary skills (Java)');

  // Test 2: Job Description parsing
  const rawJobText = `
Senior QA Automation Engineer at HCL Technologies.
Experience: 5+ years.
Requirements: Java, Selenium, Playwright, Jenkins, SQL.
Responsibilities: Lead automation testing and integrate CI/CD pipelines.
`;
  const parsedJob = JobParserService.ruleBasedParse(rawJobText, 'pasted');
  assert(parsedJob.role.includes('QA Automation'), 'Job Parser identifies correct role');
  assert(parsedJob.mustHaveSkills.includes('Java'), 'Job Parser identifies must-have skill Java');
  assert(parsedJob.mustHaveSkills.includes('Playwright'), 'Job Parser identifies must-have skill Playwright');

  // Test 3: Truth Check (Candidate 1 vs HCL Job)
  const cand1 = demoCandidates[0]; // Aarav Sharma (QA Automation)
  const job1 = demoJobs[0]; // HCL Senior QA Automation Engineer
  const truthCheck = MatchingEngine.performTruthCheck(cand1, job1);
  assert(truthCheck.greenCount >= 4, 'Truth Check correctly marks matching skills as GREEN');
  assert(truthCheck.passed === true, 'Truth Check passes for strong match candidate');

  // Test 4: Truth Check Red Detection (Candidate 1 vs Data Analyst Job)
  const job6 = demoJobs[5]; // Flipkart Senior Data Analyst (SQL, Power BI, Python, Excel, Tableau)
  const truthCheckCross = MatchingEngine.performTruthCheck(cand1, job6);
  assert(truthCheckCross.redCount >= 2, 'Truth Check detects missing unverified skills as RED');

  // Test 5: Career Track Detection
  const sameTrack = MatchingEngine.detectCareerTrack(cand1, job1);
  assert(sameTrack.isSameTrack === true, 'Career track detector confirms same track for QA -> QA');

  const diffTrack = MatchingEngine.detectCareerTrack(cand1, job6);
  assert(diffTrack.isSameTrack === false, 'Career track detector detects cross-track for QA -> Data Analytics');

  // Test 6: Match Scoring Engine
  const analysis1 = await MatchingEngine.analyze(cand1, job1);
  assert(analysis1.scores.overallScore >= 80, 'Match Engine gives high score for aligned QA job (>80%)');
  assert(analysis1.recommendation.level === 'Strongly Recommended' || analysis1.recommendation.level === 'Recommended', 'Match Engine provides Recommended or Strongly Recommended');

  // Test 7: Resume Tailoring & Versioning
  const tailoredResume = await ResumeTailorService.tailorResume(cand1, job1, truthCheck, 0);
  assert(tailoredResume.versionName === 'HCLTechnologies_SeniorQA_v1', `Resume generator formats version name correctly: ${tailoredResume.versionName}`);
  assert(tailoredResume.truthCheckVerified === true, 'Tailored resume verifies truth check flag');
  assert(tailoredResume.modifications.length >= 2, 'Tailored resume documents transparent modifications with rationale');

  // Test 8: ATS Analysis Simulation
  const atsResult = analysis1.atsAnalysis;
  assert(atsResult.estimatedScore > 70, 'ATS Analyzer computes estimated score');
  assert(atsResult.disclaimer.includes('Estimated ATS Match'), 'ATS Analyzer includes required disclaimer');

  console.log(`\nTest Results: ${passed}/${total} passed.`);
  if (passed === total) {
    console.log('ALL CRITICAL BACKEND TESTS PASSED SUCCESSFULLY!\n');
  } else {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
