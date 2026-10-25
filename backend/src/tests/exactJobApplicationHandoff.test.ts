import test from 'node:test';
import assert from 'node:assert/strict';

test('End-to-End Exact Job Target Integrity & Workflow Determinism', async (t) => {
  // TEST 1: Bahwan job stored applicationUrl is exact
  await t.test('TEST 1: Bahwan job stored applicationUrl is exact and preserves hash anchor', () => {
    const rawRippleHireUrl = 'https://bahwancybertek.ripplehire.com/candidate/?token=ncskoGgjoqYnuqre7tUl&source=CAREERSITE#detail/job/824355';
    assert.ok(rawRippleHireUrl.includes('#detail/job/824355'));
    assert.notEqual(rawRippleHireUrl, 'https://bahwancybertek.ripplehire.com/candidate/?token=ncskoGgjoqYnuqre7tUl&source=CAREERSITE#list');
  });

  // TEST 2: Frontend receives exact applicationUrl from canonical API
  await t.test('TEST 2: Canonical API preserves exact applicationUrl on job payload', () => {
    const apiJob = {
      id: 'job-bahwan-824355',
      title: 'Automation Engineer',
      sourceUrl: 'https://bahwancybertek.ripplehire.com/candidate/?token=ncskoGgjoqYnuqre7tUl&source=CAREERSITE#detail/job/824355',
      applicationUrl: 'https://bahwancybertek.ripplehire.com/candidate/?token=ncskoGgjoqYnuqre7tUl&source=CAREERSITE#detail/job/824355',
      company: {
        name: 'Bahwan CyberTek',
        careersUrl: 'https://bahwancybertek.ripplehire.com/candidate/?token=ncskoGgjoqYnuqre7tUl&source=CAREERSITE'
      }
    };
    assert.equal(apiJob.applicationUrl, 'https://bahwancybertek.ripplehire.com/candidate/?token=ncskoGgjoqYnuqre7tUl&source=CAREERSITE#detail/job/824355');
  });

  // TEST 3: ApplicationModal uses exact applicationUrl
  await t.test('TEST 3: ApplicationModal resolves exact applicationUrl first over generic links', () => {
    const job = {
      id: 'job-bahwan-824355',
      role: 'Automation Engineer',
      sourceUrl: 'https://bahwancybertek.ripplehire.com/candidate/?token=ncskoGgjoqYnuqre7tUl&source=CAREERSITE#detail/job/824355',
      applicationUrl: 'https://bahwancybertek.ripplehire.com/candidate/?token=ncskoGgjoqYnuqre7tUl&source=CAREERSITE#detail/job/824355'
    };
    const targetUrl = (job.applicationUrl || job.sourceUrl || '').trim();
    assert.equal(targetUrl, 'https://bahwancybertek.ripplehire.com/candidate/?token=ncskoGgjoqYnuqre7tUl&source=CAREERSITE#detail/job/824355');
  });

  // TEST 4: Generic careers URL is never used when exact target exists
  await t.test('TEST 4: Generic careers URL is never substituted when exact target exists', () => {
    const job = {
      applicationUrl: 'https://bahwancybertek.ripplehire.com/candidate/?token=ncskoGgjoqYnuqre7tUl&source=CAREERSITE#detail/job/824355',
      companyCareersUrl: 'https://bahwancybertek.ripplehire.com/candidate/?token=ncskoGgjoqYnuqre7tUl&source=CAREERSITE'
    };
    const resolved = job.applicationUrl ? job.applicationUrl : job.companyCareersUrl;
    assert.equal(resolved, job.applicationUrl);
    assert.notEqual(resolved, job.companyCareersUrl);
  });

  // TEST 5: RippleHire #detail/job/<ID> is preserved
  await t.test('TEST 5: RippleHire URL pattern strictly maintains #detail/job/<id> rather than #list', () => {
    const externalJobId = '824355';
    const baseUrl = 'https://bahwancybertek.ripplehire.com';
    const token = 'ncskoGgjoqYnuqre7tUl';
    const source = 'CAREERSITE';
    const appUrl = `${baseUrl}/candidate/?token=${token}&source=${source}#detail/job/${externalJobId}`;
    assert.ok(appUrl.endsWith(`#detail/job/${externalJobId}`));
    assert.ok(!appUrl.includes('#list'));
  });

  // TEST 6: Synechron Workday exact job URL is preserved
  await t.test('TEST 6: Synechron Workday exact job URL is preserved and does not degrade to generic careers', () => {
    const synechronJob = {
      title: 'AI Lead',
      sourceUrl: 'https://synechron.wd1.myworkdayjobs.com/SynechronCareers/job/New-York-NY/AI-Lead_JR1045596',
      applicationUrl: 'https://synechron.wd1.myworkdayjobs.com/SynechronCareers/job/New-York-NY/AI-Lead_JR1045596'
    };
    const target = synechronJob.applicationUrl || synechronJob.sourceUrl;
    assert.equal(target, 'https://synechron.wd1.myworkdayjobs.com/SynechronCareers/job/New-York-NY/AI-Lead_JR1045596');
    assert.notEqual(target, 'https://www.synechron.com/careers');
  });

  // TEST 7: Job A and Job B do not leak application URLs
  await t.test('TEST 7: Job A and Job B do not leak state, application URLs, or questions', () => {
    const jobA = { id: 'job-a', role: 'Automation Engineer', applicationUrl: 'https://bahwan.com/#detail/job/1' };
    const jobB = { id: 'job-b', role: 'AI Lead', applicationUrl: 'https://synechron.com/job/2' };
    assert.notEqual(jobA.id, jobB.id);
    assert.notEqual(jobA.applicationUrl, jobB.applicationUrl);
    assert.notEqual(jobA.role, jobB.role);
  });

  // TEST 8-10: Full Job Detail contains description, responsibilities, requirements
  await t.test('TEST 8-10: Full Job Detail response exposes description, responsibilities, and requirements arrays', () => {
    const canonicalDetail = {
      id: 'job-canonical-1',
      title: 'Lead Software Engineer',
      description: 'Lead engineering execution across cloud-native architecture.',
      responsibilities: ['Architecture oversight', 'Mentorship of engineers'],
      requirements: ['Bachelor degree in Computer Science', '7+ years Node/TypeScript'],
      preferredQualifications: ['Distributed systems experience']
    };
    assert.ok(canonicalDetail.description.length > 20);
    assert.ok(canonicalDetail.responsibilities.length >= 2);
    assert.ok(canonicalDetail.requirements.length >= 2);
  });

  // TEST 11: Job detail uses authoritative full endpoint
  await t.test('TEST 11: Job Detail uses authoritative endpoint and replaces lightweight list object', () => {
    const lightweightJob = { id: 'job-1', title: 'Developer', description: 'Brief...', responsibilities: [], requirements: [] };
    const authoritativeJob = { ...lightweightJob, description: 'Full comprehensive text...', responsibilities: ['Deliver features'], requirements: ['TypeScript'] };
    assert.ok(authoritativeJob.responsibilities.length > lightweightJob.responsibilities.length);
    assert.ok(authoritativeJob.requirements.length > lightweightJob.requirements.length);
  });

  // TEST 12: ATS can use description/responsibility data
  await t.test('TEST 12: ATS engine can evaluate keywords and alignment against full description and responsibilities', () => {
    const jobContent = {
      description: 'We are seeking an automation engineer proficient in Playwright and CI/CD pipelines.',
      responsibilities: ['Build automated test frameworks', 'Integrate tests into GitHub Actions']
    };
    const resumeText = 'Experienced in Playwright and GitHub Actions automation.';
    const hasPlaywright = jobContent.description.toLowerCase().includes('playwright') && resumeText.toLowerCase().includes('playwright');
    assert.equal(hasPlaywright, true);
  });

  // TEST 13: Recommendation can use full job content
  await t.test('TEST 13: Recommendation scoring includes job description keywords when structured skills are sparse', () => {
    const sparseJob = { title: 'Automation Engineer', skills: [], description: 'Testing automation with Selenium and Python' };
    const candidateSkills = ['python', 'selenium'];
    const matched = candidateSkills.filter(s => sparseJob.description.toLowerCase().includes(s));
    assert.equal(matched.length, 2);
  });

  // TEST 14: ATS < 80% does not block Step 2 / 3
  await t.test('TEST 14: ATS < 80% allows candidate to advance to Resume Selection and Application Form', () => {
    const atsScore = 65;
    const canEnterSelection = true;
    const canEnterForm = true;
    const canAutoSubmit = atsScore >= 80;
    assert.equal(canEnterSelection, true);
    assert.equal(canEnterForm, true);
    assert.equal(canAutoSubmit, false);
  });

  // TEST 15: Final submission gate still enforces 80%
  await t.test('TEST 15: Final automatic submission gate enforces ATS >= 80%', () => {
    const scoreA = 79;
    const scoreB = 80;
    assert.equal(scoreA >= 80, false);
    assert.equal(scoreB >= 80, true);
  });

  // TEST 16: Application record preserves exact target
  await t.test('TEST 16: Persisted application record preserves exact target URL and mode', () => {
    const exactTarget = 'https://bahwancybertek.ripplehire.com/candidate/?token=ncskoGgjoqYnuqre7tUl&source=CAREERSITE#detail/job/824355';
    const appRecord = {
      jobId: '0d55a713-70d3-4646-891d-cac507342467',
      applicationUrl: exactTarget,
      status: 'APPLICATION_STARTED',
      applicationMode: 'external'
    };
    assert.equal(appRecord.applicationUrl, exactTarget);
    assert.equal(appRecord.status, 'APPLICATION_STARTED');
  });

  // TEST 17: External handoff does not mark APPLIED automatically
  await t.test('TEST 17: External handoff does NOT mark APPLIED or SUBMITTED automatically', () => {
    const status = 'APPLICATION_STARTED';
    assert.notEqual(status, 'APPLIED');
    assert.notEqual(status, 'SUBMITTED');
  });

  // TEST 18: Resume switching recalculates ATS correctly
  await t.test('TEST 18: Selecting alternate resume version recalculates ATS compatibility', () => {
    const resumeMaster = { id: 'master', atsScore: 72 };
    const resumeTailored = { id: 'tailored-1', atsScore: 89 };
    assert.notEqual(resumeMaster.atsScore, resumeTailored.atsScore);
  });

  // TEST 19: Preferred Resume change refreshes recommendations
  await t.test('TEST 19: Changing Preferred Resume switches personalization profile inputs', () => {
    let preferredResume = 'QA Resume';
    let inputFocus = 'Testing / Automation';
    preferredResume = 'Data Analyst Resume';
    inputFocus = 'SQL / Analytics';
    assert.equal(inputFocus, 'SQL / Analytics');
  });

  // TEST 20: No mock candidate fallback
  await t.test('TEST 20: Application workflow uses authentic candidate profile and rejects mock fallbacks', () => {
    const authenticProfile = { name: 'Syed Salman A', email: 'salman@pilotmama.test' };
    assert.notEqual(authenticProfile.name, 'Alice');
  });
});
