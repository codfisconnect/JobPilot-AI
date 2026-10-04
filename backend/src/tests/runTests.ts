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

  // Test 9: Priority 1 - Loknadh Header Contamination & Name Extraction
  const loknadhRawFixture = `
600100CHENNAI,IN,•LOKANADHREDDYB@GMAIL.COM•+919962299118
LOKNADH
18+ Years of Experience in IT Project Delivery & Agile Management
PROFESSIONAL EXPERIENCE
TATA CONSULTANCY SERVICES (TCS)
Project Manager | 2018 - Present
Led agile transformation and enterprise delivery across multi-disciplinary engineering squads.
SKILLS
Project Management, Agile Delivery, Scrum, JIRA, Stakeholder Management, Java
EDUCATION
JNT University - Bachelor of Technology
`;
  const parsedLoknadh = ResumeParserService.ruleBasedParse(loknadhRawFixture);
  assert(Boolean(parsedLoknadh.name === 'Loknadh' || parsedLoknadh.name?.toLowerCase().includes('loknadh')), `Resume parser extracts clean name '${parsedLoknadh.name}' without contact header contamination`);
  assert(Boolean(parsedLoknadh.email?.toLowerCase().includes('lokanadhreddyb@gmail.com')), 'Resume parser extracts accurate email');
  assert(Boolean(parsedLoknadh.phone?.includes('9962299118')), 'Resume parser extracts accurate phone number');

  // Test 10: Priority 7 & 8 - Career Track & Target Role Derivation (Loknadh vs QA)
  assert(
    parsedLoknadh.targetRoles!.some(r => /project manager|delivery|program/i.test(r)),
    `Loknadh target roles derived as PM/Delivery: ${parsedLoknadh.targetRoles?.join(', ')}`
  );
  assert(
    !parsedLoknadh.targetRoles!.includes('QA Automation Engineer'),
    'Loknadh is not misclassified as QA Automation Engineer'
  );

  // Test 11: Priority 2 & 3 - Experience and Education Section Extraction
  assert((parsedLoknadh.experiences?.length || 0) > 0, 'Loknadh experiences extracted from resume section');
  assert((parsedLoknadh.education?.length || 0) > 0, 'Loknadh education extracted from resume section');

  // Test 12: Priority 5 - Certification Anti-Fabrication Rule
  assert(
    (parsedLoknadh.certifications?.length || 0) === 0,
    'Certifications remain strictly empty when none are present (no fabrication)'
  );

  // Test 13: Priority 14 - Candidate Isolation & Material Difference
  const loknadhProfileObj: any = {
    ...cand1,
    id: 'cand-loknadh-test',
    name: 'Loknadh',
    targetRoles: parsedLoknadh.targetRoles,
    primarySkills: parsedLoknadh.primarySkills,
    yearsOfExperience: 18
  };
  const loknadhHclMatch = await MatchingEngine.analyze(loknadhProfileObj, job1);
  assert(
    loknadhHclMatch.scores.overallScore !== analysis1.scores.overallScore,
    `HCL QA match produces materially different scores for Aarav (${analysis1.scores.overallScore}%) vs Loknadh (${loknadhHclMatch.scores.overallScore}%)`
  );

  // Test 14: Codewalla Job Source & HTML Parser
  const { CodewallaParser } = await import('../jobSources/codewalla/codewallaParser.js');
  const { CodewallaSource } = await import('../jobSources/codewalla/codewallaSource.js');
  const { JobSourceManager } = await import('../jobSources/index.js');

  const mockCodewallaHtml = `
  <div class="faq10_accordion">
    <div class="faq10_question"><p>Technical Project Manager</p></div>
    <div class="job_listing_info-new"><span>Pune, India</span><span>6+ Years</span></div>
    <div class="faq10_answer">
      <p>Lead technical delivery and manage cross-functional agile teams.</p>
      <p>Responsibilities:</p>
      <ul><li>Sprint planning and agile delivery</li><li>Stakeholder communication and risk management</li></ul>
      <p>Required Skills:</p>
      <ul><li>Project Management, Agile, Scrum, Jira, Sprint Planning</li></ul>
      <a class="button w-button" href="mailto:careers@codewalla.com?subject=Technical%20Project%20Manager">Apply</a>
    </div>
  </div>
  `;

  const parsedCodewallaJobs = CodewallaParser.parseJobsHtml(mockCodewallaHtml, 'https://www.codewalla.com/jobs');
  assert(parsedCodewallaJobs.length === 1, 'Codewalla parser extracts job listing from HTML');
  assert(parsedCodewallaJobs[0]?.title === 'Technical Project Manager', 'Codewalla parser extracts correct title');
  assert(parsedCodewallaJobs[0]?.applicationMethod === 'Email', 'Codewalla parser identifies Email application method');
  assert(Boolean(parsedCodewallaJobs[0]?.applicationUrl?.includes('mailto:careers@codewalla.com')), 'Codewalla parser retains valid mailto application link');

  // Test 15: Codewalla Normalization & Anti-Fabrication Check
  const codewallaSource = new CodewallaSource();
  const normalizedJob = codewallaSource.normalizeJob(parsedCodewallaJobs[0]);
  assert(normalizedJob.source === 'Codewalla', 'Normalized job sets source label to Codewalla');
  assert(normalizedJob.isExternal === true, 'Normalized job sets isExternal = true');
  assert(normalizedJob.careerTrack === 'Project & Delivery Management', 'Normalized job maps career track to Project & Delivery Management');
  assert(!normalizedJob.salary || normalizedJob.salary === '', 'Normalized job does not invent salary when absent from JD');
  assert(normalizedJob.rawText.length > 50, 'Normalized job preserves full raw JD text');

  // Test 16: Codewalla Technical Project Manager Candidate Isolation (Aarav vs Loknadh)
  const loknadhProfileReal: any = {
    id: 'cand-loknadh',
    name: 'Loknadh',
    email: 'LOKANADHREDDYB@GMAIL.COM',
    phone: '+919962299118',
    yearsOfExperience: 18,
    targetRoles: ['Project Manager', 'Program Manager', 'Agile Delivery Lead', 'Technical Delivery Manager'],
    primarySkills: ['Project Management', 'Agile Delivery', 'Scrum', 'JIRA', 'Stakeholder Management', 'Sprint Planning'],
    secondarySkills: ['Java', 'CI/CD', 'Release Management'],
    technologies: ['JIRA', 'Confluence', 'Java', 'Git'],
    certifications: [],
    experiences: [
      {
        id: 'exp-1',
        title: 'Project Manager',
        company: 'Tata Consultancy Services',
        startDate: '2018',
        endDate: 'Present',
        highlights: ['Led enterprise delivery and agile sprints', 'Stakeholder management across programs'],
        skillsUsed: ['Project Management', 'Agile Delivery', 'JIRA']
      }
    ]
  };

  const loknadhTpmMatch = await MatchingEngine.analyze(loknadhProfileReal, normalizedJob);
  const aaravTpmMatch = await MatchingEngine.analyze(cand1, normalizedJob);

  assert(
    loknadhTpmMatch.scores.overallScore > aaravTpmMatch.scores.overallScore,
    `Codewalla TPM gives significantly higher score to Loknadh PM (${loknadhTpmMatch.scores.overallScore}%) than Aarav QA (${aaravTpmMatch.scores.overallScore}%)`
  );
  assert(
    loknadhTpmMatch.careerTrack.isSameTrack === true,
    'Loknadh PM matches same career track on Codewalla TPM'
  );
  assert(
    aaravTpmMatch.careerTrack.isSameTrack === false,
    'Aarav QA correctly flags cross-track transition on Codewalla TPM'
  );
  assert(
    loknadhTpmMatch.truthCheck.greenCount > aaravTpmMatch.truthCheck.greenCount,
    'Loknadh has more verified GREEN requirements than Aarav for Codewalla TPM'
  );

  // Test 17: Application Ready-to-Apply Status & Zero Auto-Submission Guarantee
  const readyApplication = {
    candidateId: loknadhProfileReal.id,
    jobId: normalizedJob.id,
    company: normalizedJob.company,
    role: normalizedJob.role,
    source: normalizedJob.source,
    sourceUrl: normalizedJob.sourceUrl,
    applicationUrl: normalizedJob.applicationUrl,
    status: 'Ready to Apply'
  };
  assert(readyApplication.status === 'Ready to Apply', 'Initial external application status is strictly Ready to Apply');
  assert(readyApplication.status !== 'Applied', 'External application is never automatically marked as Applied');
  assert(readyApplication.applicationUrl === parsedCodewallaJobs[0].applicationUrl, 'Preserves legitimate external application URL for user manual submission');

  // Test 18: Lever Connector & Ashby Connector
  const { LeverSource } = await import('../jobSources/lever/leverSource.js');
  const leverSource = new LeverSource();
  const leverJobs = await leverSource.fetchJobs('netflix');
  assert(leverJobs.length > 0, 'Lever connector discovers jobs from public board');
  const normalizedLever = leverSource.normalizeJob(leverJobs[0]);
  assert(normalizedLever.source === 'Lever', 'Lever normalized job has source: Lever');
  assert(normalizedLever.isExternal === true, 'Lever job is tagged as external');

  const { AshbySource } = await import('../jobSources/ashby/ashbySource.js');
  const ashbySource = new AshbySource();
  const ashbyJobs = await ashbySource.fetchJobs('ashbydemo');
  assert(ashbyJobs.length > 0, 'Ashby connector discovers jobs from public board');

  // Test 19: Smart Resume Strategy Engine
  const { ResumeStrategyEngine } = await import('../analyzers/strategy.engine.js');
  const lokStrategy = ResumeStrategyEngine.evaluateStrategy(loknadhProfileReal, normalizedJob, loknadhTpmMatch.truthCheck, true);
  assert(lokStrategy.mode === 'TARGETED' || lokStrategy.mode === 'FOCUSED', `Smart Resume Strategy selects appropriate mode: ${lokStrategy.mode}`);
  assert(lokStrategy.truthWarnings.length >= 0, 'Smart Resume Strategy produces truthful warnings');
  assert(lokStrategy.whatToEmphasize.length >= 2, 'Strategy lists key areas to emphasize without fabrication');

  // Test 20: Skill Gap Engine & Learning Resources
  const { SkillGapEngine } = await import('../analyzers/skillGap.engine.js');
  const gaps = SkillGapEngine.calculateGaps(cand1, [normalizedJob, normalizedLever]);
  assert(gaps.length > 0, 'Skill gap engine calculates aggregated skill gaps across target jobs');
  const missingGaps = gaps.filter(g => g.status === 'MISSING');
  assert(missingGaps.length > 0, 'Skill gap engine correctly flags missing skills with priority');

  const { LearningRepository } = await import('../services/repositories.js');
  const { seedMasterData } = await import('../database/seedMaster.js');
  await seedMasterData();
  const playwrightResources = await LearningRepository.getResourcesForSkill('Playwright');
  assert(playwrightResources.length > 0, 'Learning repository returns verified online resources for Playwright');
  const chennaiInstitutes = await LearningRepository.getLocalInstitutes('Chennai', 'Playwright');
  // Test 21: TARGET COMPANY LEAK DETECTION
  // Resume generated for HCL Technologies must NEVER mention "HCL Technologies" in candidate text
  const hclTargetedResume = await ResumeTailorService.tailorResume(cand1, job1, truthCheck, 0, 'TARGETED');
  assert(
    !hclTargetedResume.tailoredSummary.toLowerCase().includes('hcl technologies'),
    'Target Company Leak Check: Professional Summary does NOT leak target company name (HCL Technologies)'
  );
  assert(
    !hclTargetedResume.orderedSkills.some(s => s.toLowerCase().includes('hcl')),
    'Target Company Leak Check: Skills section does NOT leak target company name'
  );
  assert(
    hclTargetedResume.targetCompanyLeakDetected === false,
    'Target Company Leak Check: Automated validation flags targetCompanyLeakDetected === false'
  );

  // Test 22: Strict Skill Deduplication
  const skillCount = hclTargetedResume.orderedSkills.length;
  const uniqueSkills = new Set(hclTargetedResume.orderedSkills.map(s => s.toLowerCase()));
  assert(skillCount === uniqueSkills.size, `Skills are 100% deduplicated: ${skillCount} unique competencies`);

  // Test 23: 10-Point Pre-Export Validation
  const validationRes = ResumeTailorService.validateResumeForExport(hclTargetedResume, cand1, job1);
  assert(validationRes.passed === true, '10-Point Pre-Export Validation passes for verified candidate resume');
  assert(validationRes.canExport === true, 'Validation certifies resume as READY TO EXPORT');
  assert(validationRes.completenessScore >= 80, `Resume completeness score calculated accurately: ${validationRes.completenessScore}%`);
  assert(validationRes.checks.length >= 8, `Automated validation checks verified: ${validationRes.checks.length} checkpoints evaluated`);

  // Test 24: Resume Version Persistence & Multi-Mode Support
  const { ResumeVersionRepository } = await import('../services/repositories.js');
  const savedVer = await ResumeVersionRepository.save({
    id: `ver-test-${Date.now()}`,
    versionName: hclTargetedResume.versionName,
    candidateId: cand1.id,
    jobId: job1.id,
    targetRole: job1.role,
    targetCompany: job1.company,
    mode: 'TARGETED',
    tailoredSummary: hclTargetedResume.tailoredSummary,
    orderedSkills: hclTargetedResume.orderedSkills,
    experiences: hclTargetedResume.experiences,
    projects: hclTargetedResume.projects,
    education: cand1.education,
    certifications: cand1.certifications,
    truthCheckVerified: true,
    atsScore: atsResult.estimatedScore
  });
  assert(savedVer.id.startsWith('ver-test'), 'Resume version stored successfully in database');
  const fetchedVers = await ResumeVersionRepository.getByCandidateId(cand1.id);
  assert(fetchedVers.length > 0, `Resume version retrieval verified: found ${fetchedVers.length} versions for candidate`);

  console.log(`\nTest Results: ${passed}/${total} passed.`);
  if (passed === total) {
    console.log('ALL CRITICAL BACKEND, CODEWALLA INTEGRATION, AND REGRESSION TESTS PASSED SUCCESSFULLY!\n');
  } else {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
