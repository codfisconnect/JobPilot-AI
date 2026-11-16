import assert from 'assert';
import { ResumeParsingService } from '../services/resumeParsing.service.js';
import { JobAvailabilityService } from '../services/jobAvailability.service.js';
import { ApplicationProviderRegistry } from '../modules/applications/providers/applicationProvider.registry.js';

export async function runAvailabilityAndApplicationTrackingTests() {
  console.log('\n--- Running Availability, Resume Sanitization & Application Tracking Tests ---');
  let passed = 0;
  let total = 0;

  function testAssert(condition: boolean, msg: string) {
    total++;
    if (condition) {
      console.log(`[PASS] ${msg}`);
      passed++;
    } else {
      console.error(`[FAIL] ${msg}`);
      throw new Error(`Assertion failed: ${msg}`);
    }
  }

  // 1. Professional Summary Sanitization
  const candidateName = 'Syed Salman A';
  const email = 'salman@example.com';
  const phone = '+91 9876543210';
  const location = 'Chennai, India';
  const rawSummary = `
    Syed Salman A
    Senior Test Engineer / Business Analyst
    salman@example.com | +91 9876543210
    Chennai, India
    Results-driven QA Automation Engineer with over 6 years of experience specializing in Playwright, Selenium, and API testing.
    Proven track record of designing scalable test automation frameworks and reducing regression cycle times.
  `;

  const sanitized = ResumeParsingService.sanitizeProfessionalSummary(
    rawSummary,
    candidateName,
    email,
    phone,
    location
  );

  testAssert(!sanitized.includes('Syed Salman A'), 'Sanitized summary strips candidate full name');
  testAssert(!sanitized.includes('salman@example.com'), 'Sanitized summary strips email address');
  testAssert(!sanitized.includes('+91 9876543210'), 'Sanitized summary strips phone number');
  testAssert(!sanitized.includes('Senior Test Engineer / Business Analyst'), 'Sanitized summary strips standalone heading titles');
  testAssert(sanitized.includes('Results-driven QA Automation Engineer with over 6 years of experience'), 'Sanitized summary preserves professional experience and domain details');

  // 2. Location extraction from candidate lines / footer
  const resumeSample = `
    John Doe
    john@example.com
    PROFESSIONAL SUMMARY
    Experienced developer building web platforms.
    EXPERIENCE
    Senior Developer - Tech Corp
    Jan 2021 - Present
    SKILLS
    TypeScript, React, Node.js
    EDUCATION
    B.Tech Computer Science
    Chennai, India
  `;

  const parsed = ResumeParsingService.parse(resumeSample);
  testAssert(parsed.personalInfo.fullName === 'John Doe', 'Candidate name is extracted cleanly');
  testAssert(parsed.personalInfo.location === 'Chennai, India', 'Location is extracted from resume without hardcoding');

  // 3. Multi-line experience employer capture
  const expResumeSample = `
    Jane Smith
    jane@example.com
    EXPERIENCE
    Senior Test Engineer
    Machine Vogue Technology Pvt Ltd.
    Jan 2020 - Present
    • Executed automated regression suites across cloud environments.
  `;

  const parsedExp = ResumeParsingService.parse(expResumeSample);
  testAssert(parsedExp.experience.length >= 1, 'Experience entry is extracted');
  testAssert(parsedExp.experience[0].company.includes('Machine Vogue Technology Pvt Ltd.'), 'Employer name on adjacent line is correctly captured');
  testAssert(parsedExp.experience[0].jobTitle === 'Senior Test Engineer', 'Job title is correctly captured');

  // 4. Project grouping without fragmentation
  const projResumeSample = `
    Alex Mercer
    alex@example.com
    PROJECTS
    Project 1: EasyJet Airlines Inc. | Travel Domain
    Role: Senior QA Engineer | Environment: Java, Selenium
    Architected end-to-end booking reservation testing workflow.
    Integrated automated sanity checks with CI/CD deployment pipelines.

    Project 2: Wakampa (Ecommerce)
    Role: Automation Tester
    Implemented product catalog and cart checkout verification tests.
  `;

  const parsedProj = ResumeParsingService.parse(projResumeSample);
  testAssert(parsedProj.projects.length === 2, 'Distinct projects are grouped accurately without fragmentation');
  testAssert(parsedProj.projects[0].name.includes('EasyJet Airlines Inc.'), 'Project 1 name is extracted accurately');
  testAssert(parsedProj.projects[0].description.includes('Architected end-to-end booking reservation'), 'Multi-line project description is preserved');
  testAssert(parsedProj.projects[1].name.includes('Wakampa'), 'Project 2 name is extracted accurately');

  // 5. Job Availability Intelligence
  const closedJob = {
    status: 'CLOSED',
    validThrough: new Date(Date.now() - 86400000).toISOString()
  };
  const closedResult = JobAvailabilityService.detectAvailability(closedJob);
  testAssert(closedResult.status === 'CLOSED', 'Detects confirmed CLOSED job status');
  testAssert(closedResult.confidence === 100, 'Provides 100% confidence for confirmed closed DB status');

  const expiredJob = {
    status: 'ACTIVE',
    validThrough: new Date(Date.now() - 1000000).toISOString()
  };
  const expiredResult = JobAvailabilityService.detectAvailability(expiredJob);
  testAssert(expiredResult.status === 'CLOSED', 'Detects CLOSED job based on expired validThrough date');
  testAssert(expiredResult.confidence >= 90, 'Provides high confidence for expired validThrough');

  const pageHtml = '<html><body><h1>Software Engineer</h1><p>This job is closed and no longer accepting applications.</p></body></html>';
  const htmlResult = JobAvailabilityService.detectAvailability({ status: 'ACTIVE' }, undefined, pageHtml);
  testAssert(htmlResult.status === 'CLOSED', 'Detects CLOSED job from employer closure notice text in page HTML');

  const activeJob = {
    status: 'ACTIVE',
    validThrough: new Date(Date.now() + 86400000 * 30).toISOString()
  };
  const activeResult = JobAvailabilityService.detectAvailability(activeJob);
  testAssert(activeResult.status === 'OPEN', 'Detects OPEN job when active and no closing signals exist');

  // 6. Application Provider Resolution
  const targetUrl = 'https://careers.externalportal.com/apply/12345';
  const resolution = ApplicationProviderRegistry.resolveProvider(targetUrl, {
    applicationUrl: targetUrl,
    sourceUrl: targetUrl
  });
  testAssert(resolution.provider !== undefined, 'Provider resolution returns a valid provider');
  testAssert(resolution.resolvedTargetUrl === targetUrl, 'Target application URL is preserved cleanly');

  console.log(`\n--- Verification Summary: ${passed}/${total} Tests Passed ---\n`);
  return { passed, total };
}

// Allow direct execution
if (process.argv[1]?.endsWith('availabilityAndApplicationTracking.test.ts') || process.argv[1]?.endsWith('availabilityAndApplicationTracking.test.js')) {
  runAvailabilityAndApplicationTrackingTests().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
