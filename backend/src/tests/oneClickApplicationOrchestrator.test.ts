import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../database/prisma.js';
import { ApplicationOrchestratorService } from '../modules/applications/applicationOrchestrator.service.js';
import { ApplicationProviderRegistry } from '../modules/applications/providers/applicationProvider.registry.js';
import { resolveApplicationTarget } from '../utils/targetUrlResolver.js';
import { ProductionMatchingService } from '../services/matching.service.js';
import { JobRecommendationService } from '../services/jobRecommendation.service.js';

describe('One-Click Application Orchestrator Deterministic Test Suite', () => {
  const ts = Date.now();
  let candidateUserA: any;
  let candidateUserB: any;
  let testCompany: any;
  let ripplehireJob: any;
  let workdayJob: any;
  let standardJob: any;
  let resumeVersionA: any;

  before(async () => {
    // 1. Create Test Company
    testCompany = await prisma.company.create({
      data: {
        name: `Acme Corp ${ts}`
      }
    });

    // 2. Create Candidate A with complete profile
    candidateUserA = await prisma.user.create({
      data: {
        email: `cand.orch.a.${ts}@pilotmama.test`,
        passwordHash: 'dummy_hash',
        role: 'CANDIDATE',
        candidateProfile: {
          create: {
            fullName: 'Jane Doe',
            headline: 'Senior Full Stack Engineer',
            location: 'Bangalore, India',
            phone: '+919876543210',
            linkedinUrl: 'https://linkedin.com/in/janedoe-test',
            portfolioUrl: 'https://github.com/janedoe-test',
            summary: 'Experienced Full Stack Engineer with Node.js, React, TypeScript, and SQL.'
          }
        }
      },
      include: {
        candidateProfile: true
      }
    });

    // 3. Create Candidate B (for ownership isolation tests)
    candidateUserB = await prisma.user.create({
      data: {
        email: `cand.orch.b.${ts}@pilotmama.test`,
        passwordHash: 'dummy_hash',
        role: 'CANDIDATE',
        candidateProfile: {
          create: {
            fullName: 'Bob Smith',
            headline: 'Frontend Engineer',
            location: 'Mumbai, India',
            phone: '+919123456789'
          }
        }
      },
      include: {
        candidateProfile: true
      }
    });

    // 4. Create Master Resume for Candidate A
    resumeVersionA = await prisma.resume.create({
      data: {
        candidateProfileId: candidateUserA.candidateProfile.id,
        title: 'Master Resume - Software Engineering',
        isMaster: true,
        originalFileName: 'resume.pdf',
        mimeType: 'application/pdf',
        fileSize: 1024,
        storageProvider: 'LOCAL_DISK',
        storageKey: `test_key_${ts}`,
        status: 'PARSED',
        rawText: 'Jane Doe. Senior Full Stack Engineer. Skills: Node.js, React, TypeScript, PostgreSQL. 5 years experience.'
      }
    });

    // 5. Create Canonical Jobs
    // 5a. Bahwan RippleHire Job with exact #detail/job/<externalJobId>
    ripplehireJob = await prisma.job.create({
      data: {
        companyId: testCompany.id,
        title: 'Bahwan RippleHire Lead Engineer',
        description: 'Lead developer role at Bahwan CyberTek using RippleHire platform.',
        sourceType: 'RIPPLEHIRE',
        sourceName: 'Bahwan Careers',
        contentHash: `hash_rh_${ts}`,
        sourceUrl: 'https://bahwancybertek.ripplehire.com/candidate/?token=ABC123XYZ#detail/job/98765',
        applicationUrl: 'https://bahwancybertek.ripplehire.com/candidate/?token=ABC123XYZ#detail/job/98765',
        externalJobId: '98765',
        remoteType: 'HYBRID',
        employmentType: 'FULL_TIME',
        location: 'Chennai, India',
        status: 'ACTIVE'
      }
    });

    // 5b. Synechron Workday Job with exact requisition target
    workdayJob = await prisma.job.create({
      data: {
        companyId: testCompany.id,
        title: 'Synechron Workday Specialist',
        description: 'Specialist engineer role at Synechron Workday careers.',
        sourceType: 'WORKDAY',
        sourceName: 'Synechron Workday',
        contentHash: `hash_wd_${ts}`,
        sourceUrl: 'https://synechron.wd1.myworkdayjobs.com/en-US/Careers/job/Bangalore/Senior-Developer_JR-100234',
        applicationUrl: 'https://synechron.wd1.myworkdayjobs.com/en-US/Careers/job/Bangalore/Senior-Developer_JR-100234/apply',
        externalJobId: 'JR-100234',
        remoteType: 'ON_SITE',
        employmentType: 'FULL_TIME',
        location: 'Bangalore, India',
        status: 'ACTIVE'
      }
    });

    // 5c. Standard Greenhouse Job
    standardJob = await prisma.job.create({
      data: {
        companyId: testCompany.id,
        title: 'Full Stack Engineer',
        description: 'Standard Greenhouse job requiring Node.js and React.',
        sourceType: 'GREENHOUSE',
        sourceName: 'Greenhouse Board',
        contentHash: `hash_gh_${ts}`,
        sourceUrl: 'https://boards.greenhouse.io/acmetech/jobs/54321',
        applicationUrl: 'https://boards.greenhouse.io/acmetech/jobs/54321#app',
        externalJobId: '54321',
        remoteType: 'REMOTE',
        employmentType: 'FULL_TIME',
        location: 'Remote',
        status: 'ACTIVE'
      }
    });
  });

  after(async () => {
    // Cleanup created test records
    await prisma.application.deleteMany({
      where: { candidateProfileId: { in: [candidateUserA.candidateProfile.id, candidateUserB.candidateProfile.id] } }
    });
    await prisma.resume.deleteMany({
      where: { candidateProfileId: { in: [candidateUserA.candidateProfile.id, candidateUserB.candidateProfile.id] } }
    });
    await prisma.job.deleteMany({
      where: { id: { in: [ripplehireJob.id, workdayJob.id, standardJob.id] } }
    });
    await prisma.company.deleteMany({
      where: { id: testCompany.id }
    });
    await prisma.user.deleteMany({
      where: { id: { in: [candidateUserA.id, candidateUserB.id] } }
    });
  });

  // TEST 1: Exact target resolver preserves Bahwan CyberTek RippleHire exact target
  test('1. Exact target resolver preserves Bahwan RippleHire #detail/job/<externalJobId>', () => {
    const resolved = resolveApplicationTarget({
      applicationUrl: ripplehireJob.applicationUrl,
      sourceUrl: ripplehireJob.sourceUrl
    });
    assert.ok(resolved.url?.includes('#detail/job/98765'), `Expected #detail/job/98765 in resolved URL: ${resolved.url}`);
    assert.ok(!resolved.url?.includes('#list'), 'Should never fall back to generic #list for RippleHire');
  });

  // TEST 2: Exact target resolver preserves Synechron Workday requisition target
  test('2. Exact target resolver preserves Synechron Workday requisition target', () => {
    const resolved = resolveApplicationTarget({
      applicationUrl: workdayJob.applicationUrl,
      sourceUrl: workdayJob.sourceUrl
    });
    assert.ok(resolved.url?.includes('JR-100234'), `Expected requisition ID JR-100234 in resolved URL: ${resolved.url}`);
    assert.ok(!resolved.url?.includes('/login'), 'Should not redirect to bare login');
  });

  // TEST 3: Registry selects appropriate provider
  test('3. ApplicationProviderRegistry correctly resolves ATS providers', () => {
    const ripplehireRes = ApplicationProviderRegistry.resolveProvider(ripplehireJob.applicationUrl, ripplehireJob);
    assert.equal(ripplehireRes.provider.providerName, 'RIPPLEHIRE');

    const workdayRes = ApplicationProviderRegistry.resolveProvider(workdayJob.applicationUrl, workdayJob);
    assert.equal(workdayRes.provider.providerName, 'WORKDAY');

    const greenhouseRes = ApplicationProviderRegistry.resolveProvider(standardJob.applicationUrl, standardJob);
    assert.equal(greenhouseRes.provider.providerName, 'GREENHOUSE');
  });

  // TEST 4: Apply starts orchestrator, canonical job fetched, default resume is Master Resume
  test('4. Apply starts orchestrator using Master Resume by default without requiring wizard', async () => {
    const attempt = await ApplicationOrchestratorService.startAttempt(
      candidateUserA.id,
      {
        jobId: standardJob.id,
        resumeChoice: 'master'
      }
    );

    assert.ok(attempt.attemptId, 'Attempt ID must be generated');
    assert.equal(attempt.resumeChoice, 'master');
    assert.equal(attempt.selectedResumeId, resumeVersionA.id, 'Must resolve preferred Master Resume');
    assert.equal(attempt.state, 'SUBMITTED', 'Should automatically complete to SUBMITTED');
    assert.ok(attempt.submissionResult, 'Must contain submissionResult');
    assert.ok(attempt.submissionResult?.confirmationNumber, 'Must have confirmationNumber');
    assert.equal(attempt.submissionResult?.role, standardJob.title);
  });

  // TEST 5: Orchestrator is retry-safe (idempotency prevents duplicate application)
  test('5. Retrying application does not duplicate application record', async () => {
    // Attempting to start again for the same job and candidate
    await assert.rejects(
      async () => {
        await ApplicationOrchestratorService.startAttempt(
          candidateUserA.id,
          {
            jobId: standardJob.id,
            resumeChoice: 'master'
          }
        );
      },
      (err: any) => {
        assert.ok(err.message.includes('already applied') || err.message.includes('already submitted'), `Expected duplicate error, got: ${err.message}`);
        return true;
      }
    );
  });

  // TEST 6: Candidate can select Tailored Resume optionally without forcing tailoring
  test('6. Candidate can select Tailored Resume optionally', async () => {
    const attempt = await ApplicationOrchestratorService.startAttempt(
      candidateUserA.id,
      {
        jobId: ripplehireJob.id,
        resumeChoice: 'tailored'
      }
    );

    assert.equal(attempt.resumeChoice, 'tailored');
    assert.equal(attempt.state, 'SUBMITTED');
    assert.ok(attempt.submissionResult?.confirmationNumber);
    assert.equal(attempt.submissionResult?.provider, 'RIPPLEHIRE');
  });

  // TEST 7: Mandatory missing information triggers WAITING_FOR_CANDIDATE without asking for known fields
  test('7. Missing mandatory field triggers WAITING_FOR_CANDIDATE for that specific field only', async () => {
    // Create Candidate C with missing phone number
    const candC = await prisma.user.create({
      data: {
        email: `cand.orch.c.${ts}@pilotmama.test`,
        passwordHash: 'dummy_hash',
        role: 'CANDIDATE',
        candidateProfile: {
          create: {
            fullName: 'Charlie Davis',
            headline: 'DevOps Engineer',
            location: 'Pune, India',
            phone: '' // deliberately empty phone
          }
        }
      },
      include: { candidateProfile: true }
    });

    const resC = await prisma.resume.create({
      data: {
        candidateProfileId: candC.candidateProfile!.id,
        title: 'Charlie Master Resume',
        isMaster: true,
        originalFileName: 'charlie.pdf',
        mimeType: 'application/pdf',
        fileSize: 1024,
        storageProvider: 'LOCAL_DISK',
        storageKey: `test_charlie_${ts}`,
        status: 'PARSED',
        rawText: 'Charlie Davis. DevOps Engineer.'
      }
    });

    const attempt = await ApplicationOrchestratorService.startAttempt(
      candC.id,
      {
        jobId: workdayJob.id,
        resumeChoice: 'master'
      }
    );

    assert.equal(attempt.state, 'WAITING_FOR_CANDIDATE', 'Must pause when mandatory phone is missing');
    assert.ok(attempt.missingField, 'Must include missingField descriptor');
    assert.equal(attempt.missingField?.fieldKey, 'phone', 'Must specifically prompt for missing phone');
    assert.ok(!attempt.submissionResult, 'Must not claim submitted while waiting');

    // TEST 8: Providing missing field resumes application and completes submission
    const resumedAttempt = await ApplicationOrchestratorService.respondMissingField(
      candC.id,
      attempt.attemptId,
      {
        fieldKey: 'phone',
        value: '+919888877777'
      }
    );

    assert.equal(resumedAttempt.state, 'SUBMITTED', 'Must resume and reach SUBMITTED');
    assert.ok(resumedAttempt.submissionResult?.confirmationNumber);

    // Verify phone was persisted to profile
    const updatedProfile = await prisma.candidateProfile.findUnique({
      where: { id: candC.candidateProfile!.id }
    });
    assert.equal(updatedProfile?.phone, '+919888877777', 'Must persist supplied field to profile');

    // TEST 9: Candidate B cannot inspect Candidate C orchestration attempt (IDOR protection)
    assert.throws(
      () => {
        ApplicationOrchestratorService.getAttemptStatus(candidateUserB.id, attempt.attemptId);
      },
      (err: any) => {
        assert.ok(err.message.includes('not found') || err.message.includes('denied') || err.statusCode === 400 || err.statusCode === 404);
        return true;
      }
    );

    // Cleanup Cand C
    await prisma.application.deleteMany({ where: { candidateProfileId: candC.candidateProfile!.id } });
    await prisma.resume.deleteMany({ where: { candidateProfileId: candC.candidateProfile!.id } });
    await prisma.user.delete({ where: { id: candC.id } });
  });

  // TEST 10: Existing Match, ATS, and Recommendation calculations remain intact internally
  test('10. Existing Match and ATS calculations remain operational internally', async () => {
    const match = await ProductionMatchingService.analyzeFit(
      candidateUserA.id,
      standardJob.id
    );
    assert.ok(typeof match.overallScore === 'number');
    assert.ok(match.overallScore >= 0 && match.overallScore <= 100);

    const recs = await JobRecommendationService.getRecommendations(
      candidateUserA.id
    );
    assert.ok(recs);
  });
});
