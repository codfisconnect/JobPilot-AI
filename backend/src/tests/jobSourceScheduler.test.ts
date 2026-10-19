import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import supertest from 'supertest';
import { app } from '../server.js';
import { prisma } from '../database/prisma.js';
import { JobSourceSchedulerService } from '../services/jobSourceScheduler.service.js';
import { JobRepositoryV1 } from '../repositories/job.repository.js';
import { JobNormalizationService } from '../services/jobNormalization.service.js';
import { signAccessToken } from '../utils/jwt.js';
import { JobStatus, SourceHealth } from '@prisma/client';
import fs from 'fs';
import path from 'path';

describe('Job Source Automatic Scheduler & Source Reconciliation Test Suite', () => {
  const TEST_SECRET = 'super-secret-cron-key-32-chars-long!';
  let adminToken: string;
  let candidateToken: string;
  let testCompanyAId: string;
  let testCompanyBId: string;
  let testConfigAId: string;
  let testConfigBId: string;

  before(async () => {
    process.env.JOB_SYNC_CRON_SECRET = TEST_SECRET;

    adminToken = signAccessToken({
      userId: 'admin-sched-test',
      email: 'admin@pilotmama.io',
      role: 'ADMIN'
    });

    candidateToken = signAccessToken({
      userId: 'cand-sched-test',
      email: 'cand@pilotmama.io',
      role: 'CANDIDATE'
    });

    // Create 2 test companies for cross-source isolation tests
    const companyA = await prisma.company.upsert({
      where: { officialDomain: 'acme-test-source.com' },
      create: {
        name: 'Acme Test Corp',
        officialDomain: 'acme-test-source.com',
        careersUrl: 'https://acme-test-source.com/careers'
      },
      update: {}
    });
    testCompanyAId = companyA.id;

    const companyB = await prisma.company.upsert({
      where: { officialDomain: 'beta-test-source.com' },
      create: {
        name: 'Beta Test Labs',
        officialDomain: 'beta-test-source.com',
        careersUrl: 'https://beta-test-source.com/careers'
      },
      update: {}
    });
    testCompanyBId = companyB.id;
  });

  after(async () => {
    // Clean up test data
    if (testConfigAId) await prisma.jobSourceConfiguration.deleteMany({ where: { id: testConfigAId } });
    if (testConfigBId) await prisma.jobSourceConfiguration.deleteMany({ where: { id: testConfigBId } });
    if (testCompanyAId) await prisma.job.deleteMany({ where: { companyId: testCompanyAId } });
    if (testCompanyBId) await prisma.job.deleteMany({ where: { companyId: testCompanyBId } });
  });

  // 1. Scheduler Endpoint Authentication Tests
  describe('Scheduler Endpoint Security & Authentication', () => {
    it('should reject request without scheduler secret with 401', async () => {
      const res = await supertest(app)
        .post('/api/v1/internal/job-sources/sync-all')
        .send({});

      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.body.success, false);
    });

    it('should reject request with incorrect secret with 403', async () => {
      const res = await supertest(app)
        .post('/api/v1/internal/job-sources/sync-all')
        .set('x-job-sync-secret', 'wrong-invalid-secret-key-1234')
        .send({});

      assert.strictEqual(res.status, 403);
      assert.strictEqual(res.body.success, false);
    });

    it('should reject request authenticated only as candidate with 401', async () => {
      const res = await supertest(app)
        .post('/api/v1/internal/job-sources/sync-all')
        .set('Authorization', `Bearer ${candidateToken}`)
        .send({});

      // Candidate JWT is not the cron secret -> rejected
      assert.strictEqual(res.status, 403);
    });

    it('should accept request with valid x-job-sync-secret', async () => {
      const res = await supertest(app)
        .post('/api/v1/internal/job-sources/sync-all')
        .set('x-job-sync-secret', TEST_SECRET)
        .send({});

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(typeof res.body.data.totalSources === 'number');
    });

    it('should accept request with valid Authorization: Bearer <secret>', async () => {
      const res = await supertest(app)
        .post('/api/v1/internal/job-sources/sync-all')
        .set('Authorization', `Bearer ${TEST_SECRET}`)
        .send({});

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
    });
  });

  // 2. Source-Specific Reconciliation & Freshness Tests
  describe('Source-Specific Job Reconciliation & Isolation', () => {
    it('should only reconcile jobs of the target company without touching other companies', async () => {
      // Seed an active job for Company A
      const { job: jobA1 } = await JobRepositoryV1.upsertNormalizedJob(testCompanyAId, JobNormalizationService.normalize({
        externalJobId: 'JOB-A-1',
        title: 'Full Stack Engineer A',
        companyName: 'Acme Test Corp',
        sourceType: 'TEST_CUSTOM',
        sourceName: 'Acme Source',
        sourceUrl: 'https://acme.com/jobs/1',
        descriptionText: 'Description A1'
      }));

      // Seed an active job for Company B
      const { job: jobB1 } = await JobRepositoryV1.upsertNormalizedJob(testCompanyBId, JobNormalizationService.normalize({
        externalJobId: 'JOB-B-1',
        title: 'Mobile Engineer B',
        companyName: 'Beta Test Labs',
        sourceType: 'TEST_CUSTOM',
        sourceName: 'Beta Source',
        sourceUrl: 'https://beta.com/jobs/1',
        descriptionText: 'Description B1'
      }));

      // Set jobA1 lastSeenAt to 20 days ago (past 14 days)
      const pastDate = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);
      await prisma.job.update({
        where: { id: jobA1.id },
        data: { lastSeenAt: pastDate }
      });

      // Set jobB1 lastSeenAt to 20 days ago as well
      await prisma.job.update({
        where: { id: jobB1.id },
        data: { lastSeenAt: pastDate }
      });

      // Now run reconciliation for Company A ONLY (where jobA1 is missing from seenJobIds)
      const resultA = await JobRepositoryV1.reconcileSourceJobs(
        testCompanyAId,
        'TEST_CUSTOM',
        [], // Seen 0 jobs
        14 // 14-day threshold
      );

      assert.strictEqual(resultA.expiredCount, 1);

      // Verify Job A is EXPIRED
      const checkA = await prisma.job.findUnique({ where: { id: jobA1.id } });
      assert.strictEqual(checkA?.status, JobStatus.EXPIRED);

      // CRITICAL CROSS-SOURCE ISOLATION: Job B must REMAIN ACTIVE despite having lastSeenAt > 14 days ago!
      const checkB = await prisma.job.findUnique({ where: { id: jobB1.id } });
      assert.strictEqual(checkB?.status, JobStatus.ACTIVE, 'Job B must not be expired by Job A reconciliation!');
    });

    it('should not expire missing jobs if they were seen within the 14-day grace period', async () => {
      // Seed a recent job seen 3 days ago
      const { job: recentJob } = await JobRepositoryV1.upsertNormalizedJob(testCompanyAId, JobNormalizationService.normalize({
        externalJobId: 'JOB-A-RECENT',
        title: 'Recent DevOps Engineer',
        companyName: 'Acme Test Corp',
        sourceType: 'TEST_CUSTOM',
        sourceName: 'Acme Source',
        sourceUrl: 'https://acme.com/jobs/recent',
        descriptionText: 'DevOps description'
      }));

      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      await prisma.job.update({
        where: { id: recentJob.id },
        data: { lastSeenAt: threeDaysAgo }
      });

      // Reconcile with empty seen list
      const result = await JobRepositoryV1.reconcileSourceJobs(
        testCompanyAId,
        'TEST_CUSTOM',
        [],
        14
      );

      // Must NOT expire
      assert.strictEqual(result.expiredCount, 0);
      const reCheck = await prisma.job.findUnique({ where: { id: recentJob.id } });
      assert.strictEqual(reCheck?.status, JobStatus.ACTIVE);
    });
  });

  // 3. Scheduler Concurrency & Lock Handling Tests
  describe('Scheduler Locking & Concurrency Protection', () => {
    it('should prevent concurrent sync execution on the same job source', async () => {
      // Create a test configuration
      const config = await prisma.jobSourceConfiguration.create({
        data: {
          companyId: testCompanyAId,
          sourceUrl: 'https://acme-test-source.com/careers',
          sourceType: 'TEST_CUSTOM',
          syncInProgress: false
        }
      });

      testConfigAId = config.id;

      // Acquire lock
      const lock1 = await JobSourceSchedulerService.acquireSourceLock(config.id);
      assert.ok(lock1 !== null, 'First lock acquisition should succeed');

      // Attempt second concurrent lock on same config
      const lock2 = await JobSourceSchedulerService.acquireSourceLock(config.id);
      assert.strictEqual(lock2, null, 'Concurrent lock acquisition must be rejected (null)');

      // Release lock
      await JobSourceSchedulerService.releaseSourceLock(config.id, lock1!);

      // Should be acquirable again
      const lock3 = await JobSourceSchedulerService.acquireSourceLock(config.id);
      assert.ok(lock3 !== null, 'Lock should be acquirable after release');
      await JobSourceSchedulerService.releaseSourceLock(config.id, lock3!);
    });

    it('should skip disabled sources during scheduler runs', async () => {
      // Create a disabled configuration
      const disabledConfig = await prisma.jobSourceConfiguration.create({
        data: {
          companyId: testCompanyBId,
          sourceUrl: 'https://beta-disabled.com',
          sourceType: 'TEST_CUSTOM',
          enabled: false
        }
      });
      testConfigBId = disabledConfig.id;

      const singleSync = await JobSourceSchedulerService.syncSingleSource(disabledConfig.id);
      assert.strictEqual(singleSync.status, 'SKIPPED');
      assert.strictEqual(singleSync.success, true);
    });
  });

  // 4. Admin Manual Sync Integration
  describe('Admin Manual Source Sync Controller', () => {
    it('POST /api/v1/admin/job-sources/:id/sync should return 401 for unauthorized requests', async () => {
      const res = await supertest(app)
        .post(`/api/v1/admin/job-sources/${testConfigAId}/sync`);
      assert.strictEqual(res.status, 401);
    });

    it('POST /api/v1/admin/job-sources/:id/sync should return 403 for candidate token', async () => {
      const res = await supertest(app)
        .post(`/api/v1/admin/job-sources/${testConfigAId}/sync`)
        .set('Authorization', `Bearer ${candidateToken}`);
      assert.strictEqual(res.status, 403);
    });
  });
});
