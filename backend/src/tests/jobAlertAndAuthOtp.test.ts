import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { prisma } from '../database/prisma.js';
import { OtpService } from '../services/otp.service.js';
import { JobAlertService } from '../services/jobAlert.service.js';
import { authService } from '../services/auth.service.js';
import { EmailService } from '../services/email/email.service.js';
import { OtpPurpose, UserRole, JobAlertStatus, JobAlertTier } from '@prisma/client';
import { hashPassword } from '../utils/password.js';

describe('Job Alert Outbox, Email OTP & Social Auth Suite', () => {
  const timestamp = Date.now();
  const testCandidateEmail = `qa.candidate.${timestamp}@testpilotmama.com`;
  const unverifiedCandidateEmail = `unverified.${timestamp}@testpilotmama.com`;
  const disabledCandidateEmail = `disabled.alerts.${timestamp}@testpilotmama.com`;

  let testCandidateUser: any = null;
  let testCandidateProfile: any = null;
  let unverifiedCandidateUser: any = null;
  let disabledCandidateUser: any = null;

  let qaJob: any = null;
  let securityJob: any = null;
  let secondQaJob: any = null;

  before(async () => {
    // 1. Clean existing test artifacts if any
    await prisma.jobAlertOutbox.deleteMany({});
    await prisma.emailOtp.deleteMany({
      where: { email: { contains: 'testpilotmama.com' } }
    });

    const passwordHash = await hashPassword('SecureTestPass123!');

    // 2. Create QA Candidate (verified, alerts enabled, QA skills)
    testCandidateUser = await prisma.user.create({
      data: {
        email: testCandidateEmail,
        passwordHash,
        role: UserRole.CANDIDATE,
        isActive: true,
        emailVerified: true,
        candidateProfile: {
          create: {
            fullName: 'QA Automation Engineer Candidate',
            headline: 'Senior QA Automation Engineer | Cypress | Selenium | Playwright',
            preferences: {
              create: {
                targetRoles: ['QA Automation Engineer', 'SDET', 'Senior Quality Engineer'],
                preferredLocations: ['Remote', 'Bangalore', 'Chennai'],
                jobAlertsEnabled: true
              }
            },
            skills: {
              create: [
                { skill: { connectOrCreate: { where: { name: 'Selenium' }, create: { name: 'Selenium' } } } },
                { skill: { connectOrCreate: { where: { name: 'Cypress' }, create: { name: 'Cypress' } } } },
                { skill: { connectOrCreate: { where: { name: 'Playwright' }, create: { name: 'Playwright' } } } },
                { skill: { connectOrCreate: { where: { name: 'TypeScript' }, create: { name: 'TypeScript' } } } },
                { skill: { connectOrCreate: { where: { name: 'Test Automation' }, create: { name: 'Test Automation' } } } }
              ]
            },
            experiences: {
              create: [
                {
                  company: 'TechCorp Solutions',
                  jobTitle: 'Senior QA Automation Engineer',
                  startDate: new Date('2021-01-01'),
                  endDate: new Date('2026-01-01'),
                  isCurrent: true,
                  description: 'Architected automated test suites with Cypress and Playwright in TypeScript.'
                }
              ]
            }
          }
        }
      },
      include: {
        candidateProfile: {
          include: { preferences: true, skills: true }
        }
      }
    });
    testCandidateProfile = testCandidateUser.candidateProfile;

    // 3. Create Unverified Candidate
    unverifiedCandidateUser = await prisma.user.create({
      data: {
        email: unverifiedCandidateEmail,
        passwordHash,
        role: UserRole.CANDIDATE,
        isActive: true,
        emailVerified: false,
        candidateProfile: {
          create: {
            fullName: 'Unverified Candidate',
            headline: 'Senior QA Automation Engineer',
            preferences: {
              create: {
                targetRoles: ['QA Automation Engineer'],
                jobAlertsEnabled: true
              }
            }
          }
        }
      }
    });

    // 4. Create Candidate with Alerts Disabled
    disabledCandidateUser = await prisma.user.create({
      data: {
        email: disabledCandidateEmail,
        passwordHash,
        role: UserRole.CANDIDATE,
        isActive: true,
        emailVerified: true,
        candidateProfile: {
          create: {
            fullName: 'Disabled Alerts Candidate',
            headline: 'Senior QA Automation Engineer',
            preferences: {
              create: {
                targetRoles: ['QA Automation Engineer'],
                jobAlertsEnabled: false
              }
            }
          }
        }
      }
    });

    // 5. Create Test Company and Jobs
    const company = await prisma.company.upsert({
      where: { officialDomain: 'qa-alert-testcorp.com' },
      update: {},
      create: {
        name: 'QA Alert TestCorp',
        officialDomain: 'qa-alert-testcorp.com',
        careersUrl: 'https://qa-alert-testcorp.com/careers'
      }
    });

    qaJob = await prisma.job.create({
      data: {
        companyId: company.id,
        externalJobId: `ext_qa_job_${timestamp}`,
        contentHash: `hash_qa_${timestamp}`,
        title: 'Senior QA Automation Engineer',
        description: 'We are seeking a Senior QA Automation Engineer proficient in Cypress, Selenium, Playwright, and TypeScript. Experience designing CI/CD automated test pipelines required.',
        location: 'Remote',
        sourceType: 'DIRECT',
        sourceName: 'Career Page',
        sourceUrl: 'https://qa-alert-testcorp.com/careers/senior-qa-automation',
        applicationUrl: 'https://qa-alert-testcorp.com/apply/senior-qa-automation',
        status: 'ACTIVE'
      }
    });

    securityJob = await prisma.job.create({
      data: {
        companyId: company.id,
        externalJobId: `ext_sec_job_${timestamp}`,
        contentHash: `hash_sec_${timestamp}`,
        title: 'Principal Cloud Cyber Security Architect',
        description: 'Lead incident response, zero trust architecture, SIEM threat hunting, Splunk administration, and SOC compliance. CISSP required.',
        location: 'Remote',
        sourceType: 'DIRECT',
        sourceName: 'Career Page',
        sourceUrl: 'https://qa-alert-testcorp.com/careers/cyber-security-architect',
        applicationUrl: 'https://qa-alert-testcorp.com/apply/cyber-security-architect',
        status: 'ACTIVE'
      }
    });

    secondQaJob = await prisma.job.create({
      data: {
        companyId: company.id,
        externalJobId: `ext_qa_job_2_${timestamp}`,
        contentHash: `hash_qa_2_${timestamp}`,
        title: 'Lead Software Development Engineer in Test (SDET)',
        description: 'Looking for a Lead SDET with Cypress, Playwright, TypeScript, and automated testing framework design experience.',
        location: 'Remote',
        sourceType: 'DIRECT',
        sourceName: 'Career Page',
        sourceUrl: 'https://qa-alert-testcorp.com/careers/lead-sdet',
        applicationUrl: 'https://qa-alert-testcorp.com/apply/lead-sdet',
        status: 'ACTIVE'
      }
    });
  });

  after(async () => {
    // Cleanup created test records
    await prisma.jobAlertOutbox.deleteMany({
      where: { email: { contains: 'testpilotmama.com' } }
    });
    await prisma.emailOtp.deleteMany({
      where: { email: { contains: 'testpilotmama.com' } }
    });

    if (qaJob) await prisma.job.delete({ where: { id: qaJob.id } }).catch(() => {});
    if (securityJob) await prisma.job.delete({ where: { id: securityJob.id } }).catch(() => {});
    if (secondQaJob) await prisma.job.delete({ where: { id: secondQaJob.id } }).catch(() => {});

    if (testCandidateUser) {
      await prisma.user.delete({ where: { id: testCandidateUser.id } }).catch(() => {});
    }
    if (unverifiedCandidateUser) {
      await prisma.user.delete({ where: { id: unverifiedCandidateUser.id } }).catch(() => {});
    }
    if (disabledCandidateUser) {
      await prisma.user.delete({ where: { id: disabledCandidateUser.id } }).catch(() => {});
    }
  });

  describe('Part 1: Relevant New-Job Email Alerts & Outbox Engine', () => {
    it('should evaluate and enqueue an alert for a genuinely relevant job (QA Candidate vs QA Role)', async () => {
      const result = await JobAlertService.evaluateAndEnqueue(qaJob);

      assert.ok(result.evaluated >= 1, 'Should evaluate candidates');
      assert.ok(result.enqueued >= 1, 'Should enqueue at least 1 alert for the matching candidate');

      // Check DB outbox record
      const outboxEntry = await prisma.jobAlertOutbox.findUnique({
        where: {
          candidateId_jobId: {
            candidateId: testCandidateProfile.id,
            jobId: qaJob.id
          }
        }
      });

      assert.ok(outboxEntry, 'Outbox entry should exist in DB');
      assert.strictEqual(outboxEntry.status, JobAlertStatus.PENDING);
      assert.strictEqual(outboxEntry.email, testCandidateEmail);
      assert.ok(Number(outboxEntry.relevanceScore) >= 55, `Relevance score (${outboxEntry.relevanceScore}) should meet threshold`);
      assert.ok(
        outboxEntry.relevanceTier === JobAlertTier.HIGHLY_RELEVANT || outboxEntry.relevanceTier === JobAlertTier.RELEVANT,
        `Tier should be HIGHLY_RELEVANT or RELEVANT, got ${outboxEntry.relevanceTier}`
      );
    });

    it('should NOT enqueue an alert for an irrelevant job (QA Candidate vs Cyber Security Role)', async () => {
      const result = await JobAlertService.evaluateAndEnqueue(securityJob);

      // Verify no outbox entry was created for our test candidate
      const outboxEntry = await prisma.jobAlertOutbox.findUnique({
        where: {
          candidateId_jobId: {
            candidateId: testCandidateProfile.id,
            jobId: securityJob.id
          }
        }
      });

      assert.strictEqual(outboxEntry, null, 'No alert should be enqueued for irrelevant cyber security role');
    });

    it('should NOT enqueue alert for unverified candidate or candidate with alerts disabled', async () => {
      // Check unverified candidate
      const unverifiedEntry = await prisma.jobAlertOutbox.findFirst({
        where: { email: unverifiedCandidateEmail }
      });
      assert.strictEqual(unverifiedEntry, null, 'Unverified candidate must not receive job alerts');

      // Check disabled candidate
      const disabledEntry = await prisma.jobAlertOutbox.findFirst({
        where: { email: disabledCandidateEmail }
      });
      assert.strictEqual(disabledEntry, null, 'Candidate with jobAlertsEnabled=false must not receive job alerts');
    });

    it('should be idempotent and prevent duplicate alerts on repeated sync or evaluation', async () => {
      // Re-evaluating the same job
      const result = await JobAlertService.evaluateAndEnqueue(qaJob);
      assert.strictEqual(result.enqueued, 0, 'Re-evaluating existing job should enqueue 0 new alerts');

      const count = await prisma.jobAlertOutbox.count({
        where: {
          candidateId: testCandidateProfile.id,
          jobId: qaJob.id
        }
      });
      assert.strictEqual(count, 1, 'Only exactly 1 outbox entry should exist for candidate + job');
    });

    it('should batch multiple relevant jobs for the same candidate into a single email', async () => {
      // Clear email sent memory
      EmailService.getSentEmails();

      // Enqueue a second relevant job for the candidate
      await JobAlertService.evaluateAndEnqueue(secondQaJob);

      // Verify both entries are PENDING in the outbox
      const pendingEntries = await prisma.jobAlertOutbox.findMany({
        where: {
          candidateId: testCandidateProfile.id,
          status: JobAlertStatus.PENDING
        }
      });
      assert.strictEqual(pendingEntries.length, 2, 'Should have 2 pending alerts for the candidate');

      // Process the outbox batch
      const processResult = await JobAlertService.processOutboxBatch(100);
      assert.ok(processResult.sent >= 2, 'Should mark outbox entries as sent');

      const candidateSentEntries = await prisma.jobAlertOutbox.findMany({
        where: {
          candidateId: testCandidateProfile.id,
          status: JobAlertStatus.SENT
        }
      });
      assert.strictEqual(candidateSentEntries.length, 2, 'Should mark exactly 2 outbox entries as sent for this candidate');

      // Inspect sent emails
      const sentEmails = EmailService.getSentEmails().filter(e => e.to === testCandidateEmail);
      assert.strictEqual(sentEmails.length, 1, 'Multiple pending jobs should be batched into 1 email');
      assert.ok(sentEmails[0].subject.includes('new jobs match your Pilot Mama profile'), 'Subject should indicate batched jobs');
      assert.ok(sentEmails[0].html.includes('Senior QA Automation Engineer'));
      assert.ok(sentEmails[0].html.includes('Lead Software Development Engineer in Test'));
      assert.ok(sentEmails[0].html.includes('Unsubscribe'), 'Email must include unsubscribe link');

      // Verify outbox status updated to SENT
      const updatedEntries = await prisma.jobAlertOutbox.findMany({
        where: {
          candidateId: testCandidateProfile.id
        }
      });
      for (const entry of updatedEntries) {
        assert.strictEqual(entry.status, JobAlertStatus.SENT);
        assert.ok(entry.sentAt !== null);
        assert.ok(entry.providerMessageId !== null);
      }
    });

    it('should generate secure HMAC-SHA256 unsubscribe token and process candidate unsubscribe', async () => {
      const token = JobAlertService.generateUnsubscribeToken(testCandidateProfile.id);
      assert.ok(token.length > 20, 'Unsubscribe token should be non-trivial');

      // Tampered token test
      const tampered = token.slice(0, -4) + 'abcd';
      const verifyTampered = JobAlertService.verifyUnsubscribeToken(tampered);
      assert.strictEqual(verifyTampered.valid, false, 'Tampered token must fail verification');

      // Valid token test
      const verifyValid = JobAlertService.verifyUnsubscribeToken(token);
      assert.strictEqual(verifyValid.valid, true, 'Valid token must succeed');
      assert.strictEqual(verifyValid.candidateId, testCandidateProfile.id);

      // Perform unsubscribe action
      const unsubResult = await JobAlertService.unsubscribeByToken(token);
      assert.strictEqual(unsubResult.success, true);

      // Verify preference updated
      const pref = await prisma.candidatePreference.findUnique({
        where: { candidateProfileId: testCandidateProfile.id }
      });
      assert.strictEqual(pref?.jobAlertsEnabled, false, 'Candidate jobAlertsEnabled should now be false');

      // Candidate login and password remain completely functional and unaffected
      const user = await prisma.user.findUnique({ where: { id: testCandidateUser.id } });
      assert.strictEqual(user?.isActive, true, 'Candidate user must remain active');
    });
  });

  describe('Part 2: Email OTP Authentication & Security Controls', () => {
    const otpTestEmail = `otp.test.${timestamp}@testpilotmama.com`;

    it('should generate cryptographically secure 6-digit OTP', () => {
      for (let i = 0; i < 20; i++) {
        const otp = OtpService.generateSecureCode();
        assert.match(otp, /^\d{6}$/, 'OTP must be exactly 6 numeric digits');
        const num = parseInt(otp, 10);
        assert.ok(num >= 100000 && num <= 999999, 'OTP must be in range 100000-999999');
      }
    });

    it('should hash OTP with SHA-256 and never store raw plaintext', () => {
      const rawOtp = '482915';
      const hash1 = OtpService.hashOtp(rawOtp);
      const hash2 = OtpService.hashOtp(rawOtp);

      assert.strictEqual(hash1, hash2, 'Hash must be deterministic');
      assert.strictEqual(hash1.length, 64, 'SHA-256 hex string should be 64 characters');
      assert.notStrictEqual(hash1, rawOtp, 'Hash must not equal plaintext');
    });

    it('should enforce 60s cooldown on OTP resend', async () => {
      // 1st request succeeds
      await OtpService.generateAndSendOtp(otpTestEmail, OtpPurpose.LOGIN);

      // Immediate 2nd request should fail due to cooldown
      await assert.rejects(
        async () => {
          await OtpService.generateAndSendOtp(otpTestEmail, OtpPurpose.LOGIN);
        },
        /Please wait \d+ seconds before requesting a new code/
      );
    });

    it('should register a candidate as unverified and challenge login before OTP verification', async () => {
      const regEmail = `signup.unverified.${timestamp}@testpilotmama.com`;
      const regPass = 'ValidSecretPass123!';

      // Register candidate
      const regResult = await authService.register({
        email: regEmail,
        password: regPass,
        fullName: 'New Candidate'
      });

      assert.strictEqual(regResult.email, regEmail);
      assert.strictEqual(regResult.requiresVerification, true);

      // Attempt login with password before OTP verification -> Must challenge with requiresOtp
      const loginChallenge = await authService.login({ email: regEmail, password: regPass });
      assert.strictEqual((loginChallenge as any).requiresOtp, true);
      assert.ok((loginChallenge as any).cooldownSeconds >= 0);

      // Retrieve the generated OTP from mock sent emails
      const sent = EmailService.getSentEmails().find(e => e.to === regEmail && e.subject.includes('Verification Code'));
      assert.ok(sent, 'Verification email should be dispatched');
      const otpMatch = (sent.text || '').match(/\b(\d{6})\b/) || sent.html.match(/>\s*(\d{6})\s*</);
      assert.ok(otpMatch, 'Verification code should be present in email HTML or text');
      const validCode = otpMatch[1];

      // Wrong OTP fails
      await assert.rejects(
        async () => {
          await authService.verifyRegistrationOtp({ email: regEmail, code: '000000' });
        },
        /Incorrect code/
      );

      // Correct OTP activates account and returns session
      const verifyResult = await authService.verifyRegistrationOtp({ email: regEmail, code: validCode });
      assert.strictEqual(verifyResult.user.email, regEmail);
      assert.strictEqual(verifyResult.user.emailVerified, true);
      assert.ok(verifyResult.accessToken.length > 20);
      assert.ok(verifyResult.refreshToken.length > 20);

      // Now regular login succeeds without requiresOtp challenge
      const loginResult = await authService.login({ email: regEmail, password: regPass });
      assert.strictEqual((loginResult as any).user.email, regEmail);
      assert.ok((loginResult as any).accessToken.length > 20);
    });

    it('should support passwordless Email OTP login', async () => {
      const pwlessEmail = `passwordless.${timestamp}@testpilotmama.com`;

      // Create verified user
      await prisma.user.create({
        data: {
          email: pwlessEmail,
          passwordHash: await hashPassword('TemporaryPassword123!'),
          role: UserRole.CANDIDATE,
          isActive: true,
          emailVerified: true
        }
      });

      // Request login OTP
      const reqResult = await authService.requestOtp(pwlessEmail, OtpPurpose.LOGIN);
      assert.ok(reqResult.cooldownSeconds > 0);

      // Find sent OTP
      const sent = EmailService.getLastEmail(pwlessEmail);
      assert.ok(sent, 'Login code email dispatched');
      assert.ok(sent.subject.includes('Login Code'));
      const otpMatch = ((sent && sent.text) || '').match(/\b(\d{6})\b/) || (sent ? sent.html.match(/>\s*(\d{6})\s*</) : null);
      assert.ok(otpMatch, 'OTP code should be found in email text or html');
      const code = otpMatch[1];

      // Login with OTP
      const session = await authService.loginWithOtp({ email: pwlessEmail, code });
      assert.strictEqual(session.user.email, pwlessEmail);
      assert.ok(session.accessToken.length > 20);
    });

    it('should lock out after 5 invalid OTP attempts', async () => {
      const lockEmail = `lockout.${timestamp}@testpilotmama.com`;

      await prisma.emailOtp.deleteMany({ where: { email: lockEmail } });
      await OtpService.generateAndSendOtp(lockEmail, OtpPurpose.LOGIN);

      // 4 invalid codes produce attempt warning
      for (let i = 1; i <= 4; i++) {
        await assert.rejects(
          async () => {
            await OtpService.verifyOtp(lockEmail, '111111', OtpPurpose.LOGIN);
          },
          /Incorrect code/
        );
      }

      // 5th failed attempt hits max attempts and deletes/locks OTP
      await assert.rejects(
        async () => {
          await OtpService.verifyOtp(lockEmail, '111111', OtpPurpose.LOGIN);
        },
        /Too many attempts/
      );

      // 6th attempt fails because record is already consumed/locked
      await assert.rejects(
        async () => {
          await OtpService.verifyOtp(lockEmail, '111111', OtpPurpose.LOGIN);
        },
        /expired or was already used/
      );
    });
  });

  describe('Part 3: Social Authentication Fallback & Safe Account Linking', () => {
    it('should return candidate-friendly fallback message when Google credentials are not configured', async () => {
      const origClientId = process.env.GOOGLE_CLIENT_ID;
      const origSecret = process.env.GOOGLE_CLIENT_SECRET;
      delete process.env.GOOGLE_CLIENT_ID;
      delete process.env.GOOGLE_CLIENT_SECRET;

      try {
        await assert.rejects(
          async () => {
            await authService.verifyGoogleCredential({ credential: 'dummy-google-token' });
          },
          (err: any) => {
            assert.strictEqual(err.message, 'Google sign-in is temporarily unavailable. Please use email sign-in.');
            return true;
          }
        );
      } finally {
        if (origClientId) process.env.GOOGLE_CLIENT_ID = origClientId;
        if (origSecret) process.env.GOOGLE_CLIENT_SECRET = origSecret;
      }
    });

    it('should return candidate-friendly fallback message when LinkedIn credentials are not configured', async () => {
      const origClientId = process.env.LINKEDIN_CLIENT_ID;
      const origSecret = process.env.LINKEDIN_CLIENT_SECRET;
      delete process.env.LINKEDIN_CLIENT_ID;
      delete process.env.LINKEDIN_CLIENT_SECRET;

      try {
        await assert.rejects(
          async () => {
            await authService.verifyLinkedInToken({ token: 'dummy-linkedin-token' });
          },
          (err: any) => {
            assert.strictEqual(err.message, 'LinkedIn sign-in is temporarily unavailable. Please use email sign-in.');
            return true;
          }
        );
      } finally {
        if (origClientId) process.env.LINKEDIN_CLIENT_ID = origClientId;
        if (origSecret) process.env.LINKEDIN_CLIENT_SECRET = origSecret;
      }
    });

    it('should link social provider account safely to existing verified email without duplicating user', async () => {
      const existingEmail = `social.link.${timestamp}@testpilotmama.com`;

      const user = await prisma.user.create({
        data: {
          email: existingEmail,
          passwordHash: await hashPassword('ExistingPassword123!'),
          role: UserRole.CANDIDATE,
          isActive: true,
          emailVerified: true
        }
      });

      // Simulate social auth payload for verified Google account with matching email
      const result = await authService.authenticateSocialUser({
        provider: 'GOOGLE' as any,
        providerSubjectId: `google_sub_${timestamp}`,
        email: existingEmail,
        fullName: 'Social Linked User',
        emailVerified: true
      });

      assert.strictEqual(result.user.id, user.id, 'Must link to existing user ID');
      assert.strictEqual(result.user.email, existingEmail);

      const totalUsers = await prisma.user.count({ where: { email: existingEmail } });
      assert.strictEqual(totalUsers, 1, 'Must not duplicate user row in database');
    });
  });
});
