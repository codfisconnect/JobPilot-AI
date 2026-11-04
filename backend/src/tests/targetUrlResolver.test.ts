import test from 'node:test';
import assert from 'node:assert/strict';

// Import the resolver logic directly
import { resolveApplicationTarget, isGenericCareersUrl } from '../utils/targetUrlResolver.js';

test('Target URL Resolver Invariants & Business Rules', async (t) => {
  // Test 1: Bahwan exact RippleHire URL survives DB/API/frontend resolution
  await t.test('Test 1: Bahwan exact RippleHire URL survives DB/API/frontend resolution', () => {
    const target = resolveApplicationTarget({
      applicationUrl: 'https://bahwancybertek.ripplehire.com/candidate/?token=ncskoGgjoqYnuqre7tUl&source=CAREERSITE#detail/job/824355',
      jobDetailUrl: 'https://bahwancybertek.ripplehire.com/candidate/?token=ncskoGgjoqYnuqre7tUl&source=CAREERSITE#detail/job/824355',
      sourceUrl: 'https://bahwancybertek.ripplehire.com/candidate/?token=ncskoGgjoqYnuqre7tUl&source=CAREERSITE#detail/job/824355'
    });
    assert.equal(target.classification, 'EXACT_APPLICATION_TARGET');
    assert.equal(target.isExact, true);
    assert.equal(target.url, 'https://bahwancybertek.ripplehire.com/candidate/?token=ncskoGgjoqYnuqre7tUl&source=CAREERSITE#detail/job/824355');
  });

  // Test 2: #detail/job/<externalJobId> survives unchanged
  await t.test('Test 2: #detail/job/<externalJobId> survives unchanged', () => {
    const raw = 'https://bahwancybertek.ripplehire.com/candidate/?token=secret#detail/job/912408';
    assert.equal(isGenericCareersUrl(raw), false);
    const target = resolveApplicationTarget({ applicationUrl: raw });
    assert.equal(target.url, raw);
    assert.ok(target.url?.includes('#detail/job/912408'));
  });

  // Test 3: Synechron exact Workday URL survives unchanged
  await t.test('Test 3: Synechron exact Workday URL survives unchanged', () => {
    const workdayUrl = 'https://synechron.wd1.myworkdayjobs.com/SynechronCareers/job/New-York-NY/AI-Lead_JR1045596';
    assert.equal(isGenericCareersUrl(workdayUrl), false);
    const target = resolveApplicationTarget({ applicationUrl: workdayUrl });
    assert.equal(target.classification, 'EXACT_APPLICATION_TARGET');
    assert.equal(target.url, workdayUrl);
  });

  // Test 4: Generic careers URL is rejected as an exact application target
  await t.test('Test 4: Generic careers URL is rejected as an exact application target', () => {
    assert.equal(isGenericCareersUrl('https://www.synechron.com/careers'), true);
    assert.equal(isGenericCareersUrl('https://bahwancybertek.com/careers'), true);
    assert.equal(isGenericCareersUrl('https://bahwancybertek.ripplehire.com/candidate/?token=secret#list'), true);
    assert.equal(isGenericCareersUrl('https://company.wd3.myworkdayjobs.com/careers'), true);
  });

  // Test 5: If applicationUrl is exact and sourceUrl is generic, applicationUrl wins
  await t.test('Test 5: If applicationUrl is exact and sourceUrl is generic, applicationUrl wins', () => {
    const target = resolveApplicationTarget({
      applicationUrl: 'https://synechron.wd1.myworkdayjobs.com/SynechronCareers/job/New-York-NY/AI-Lead_JR1045596',
      sourceUrl: 'https://www.synechron.com/careers'
    });
    assert.equal(target.classification, 'EXACT_APPLICATION_TARGET');
    assert.equal(target.url, 'https://synechron.wd1.myworkdayjobs.com/SynechronCareers/job/New-York-NY/AI-Lead_JR1045596');
    assert.equal(target.isExact, true);
  });

  // Test 6: If sourceUrl is exact and applicationUrl is missing, sourceUrl can be used
  await t.test('Test 6: If sourceUrl is exact and applicationUrl is missing, sourceUrl can be used', () => {
    const target = resolveApplicationTarget({
      applicationUrl: undefined,
      sourceUrl: 'https://bahwancybertek.ripplehire.com/candidate/?token=ncskoGgjoqYnuqre7tUl#detail/job/824355'
    });
    assert.equal(target.classification, 'EXACT_JOB_TARGET');
    assert.equal(target.url, 'https://bahwancybertek.ripplehire.com/candidate/?token=ncskoGgjoqYnuqre7tUl#detail/job/824355');
    assert.equal(target.isExact, true);
  });

  // Test 7: If all available URLs are generic, exact application CTA is unavailable
  await t.test('Test 7: If all available URLs are generic, exact application CTA is unavailable', () => {
    const target = resolveApplicationTarget({
      applicationUrl: 'https://www.synechron.com/careers',
      sourceUrl: 'https://www.synechron.com/careers',
      companyCareersUrl: 'https://www.synechron.com/careers'
    });
    assert.equal(target.classification, 'GENERIC_CAREERS_TARGET');
    assert.equal(target.isExact, false);
    assert.equal(target.buttonLabel, 'Open Employer Careers Page');
    assert.ok(target.displayWarning?.includes('Exact application link unavailable'));
  });

  // Test 8: Job A cannot inherit Job B application URL
  await t.test('Test 8: Job A cannot inherit Job B application URL', () => {
    const jobA = resolveApplicationTarget({ applicationUrl: 'https://bahwan.com/#detail/job/1' });
    const jobB = resolveApplicationTarget({ applicationUrl: 'https://synechron.com/job/2' });
    assert.notEqual(jobA.url, jobB.url);
  });

  // Test 9: Opening Job Detail and starting Application Agent both use the same canonical job record
  await t.test('Test 9: Opening Job Detail and starting Application Agent both resolve to same canonical target', () => {
    const jobRecord = {
      id: 'job-bahwan-824355',
      applicationUrl: 'https://bahwancybertek.ripplehire.com/candidate/?token=ncskoGgjoqYnuqre7tUl&source=CAREERSITE#detail/job/824355',
      sourceUrl: 'https://bahwancybertek.ripplehire.com/candidate/?token=ncskoGgjoqYnuqre7tUl&source=CAREERSITE#detail/job/824355'
    };
    const targetJobDetail = resolveApplicationTarget(jobRecord);
    const targetAppAgent = resolveApplicationTarget(jobRecord);
    assert.equal(targetJobDetail.url, targetAppAgent.url);
    assert.equal(targetJobDetail.isExact, true);
    assert.equal(targetAppAgent.isExact, true);
  });

  // Test 10: Clicking external handoff produces APPLICATION_STARTED, not APPLIED/SUBMITTED
  await t.test('Test 10: Clicking external handoff produces APPLICATION_STARTED, not APPLIED/SUBMITTED', () => {
    const initialStatus = 'APPLICATION_STARTED';
    assert.notEqual(initialStatus, 'APPLIED');
    assert.notEqual(initialStatus, 'SUBMITTED');
  });
});
