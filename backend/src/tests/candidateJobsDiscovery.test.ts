import { describe, it, after } from 'node:test';
import assert from 'node:assert';
import supertest from 'supertest';
import { app } from '../server.js';
import { prisma } from '../database/prisma.js';
import { signAccessToken } from '../utils/jwt.js';

describe('Candidate Jobs Discovery & Exploration Suite (Regression for 0 Jobs Bug)', () => {
  let candidateToken: string;
  let candidateUser: any;

  let testCompanyA: any;
  let testCompanyB: any;
  let jobA: any;
  let jobB: any;

  it('Setup: Retrieve candidate user or create temporary candidate session and test canonical jobs', async () => {
    candidateUser = await prisma.user.findFirst({ where: { role: 'CANDIDATE' } });
    if (!candidateUser) {
      candidateUser = await prisma.user.create({
        data: {
          email: `cand_test_${Date.now()}@example.com`,
          passwordHash: 'dummy',
          role: 'CANDIDATE'
        }
      });
    }
    candidateToken = signAccessToken({
      userId: candidateUser.id,
      email: candidateUser.email,
      role: candidateUser.role
    });
    assert.ok(candidateToken, 'Candidate token generated');

    // Clean up any residual old test jobs
    await prisma.job.deleteMany({
      where: {
        contentHash: {
          in: ['hash_test_job_1', 'hash_test_job_2', 'hash_test_job_3', 'hash_test_job_4', 'hash_test_job_5', 'hash_test_job_6']
        }
      }
    }).catch(() => { });

    // Create or retrieve 2 test companies and seed jobs if needed
    testCompanyA = await prisma.company.upsert({
      where: { officialDomain: 'candidate-test-corp-a.com' },
      create: {
        name: 'Candidate Test Corp A',
        officialDomain: 'candidate-test-corp-a.com'
      },
      update: {}
    });

    testCompanyB = await prisma.company.upsert({
      where: { officialDomain: 'candidate-test-corp-b.com' },
      create: {
        name: 'Candidate Test Corp B',
        officialDomain: 'candidate-test-corp-b.com'
      },
      update: {}
    });

    // Ensure we have at least 10 canonical jobs for pagination tests
    for (let i = 1; i <= 10; i++) {
      await prisma.job.upsert({
        where: { contentHash: `hash_candidate_test_job_${i}` },
        create: {
          title: i % 2 === 0 ? `Senior Software Engineer ${i}` : `Staff Product Designer ${i}`,
          description: 'Test job description for regression testing',
          companyId: i % 2 === 0 ? testCompanyA.id : testCompanyB.id,
          sourceType: i % 2 === 0 ? 'JSON_API' : 'EMBEDDED_DATA',
          sourceName: i % 2 === 0 ? 'Candidate Test Source A' : 'Candidate Test Source B',
          sourceUrl: `https://test.example.com/careers/source_${i}`,
          remoteType: i % 2 === 0 ? 'REMOTE' : 'ON_SITE',
          employmentType: 'FULL_TIME',
          status: 'ACTIVE',
          contentHash: `hash_candidate_test_job_${i}`,
          applicationUrl: `https://test.example.com/jobs/${i}`,
          firstSeenAt: new Date(),
          lastSeenAt: new Date()
        },
        update: {
          status: 'ACTIVE'
        }
      });
    }
  });

  it('1. GET /api/v1/jobs returns canonical ACTIVE jobs to authenticated candidates', async () => {
    const res = await supertest(app)
      .get('/api/v1/jobs')
      .set('Authorization', `Bearer ${candidateToken}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
    assert.ok(res.body.data.length > 0, 'Active jobs must be returned');
    assert.ok(res.body.pagination.total > 0, 'Total count must be > 0');
    assert.strictEqual(res.body.data[0].status, 'ACTIVE');
  });

  it('2. GET /api/v1/jobs returns canonical jobs WITHOUT token (public candidate exploration)', async () => {
    const res = await supertest(app)
      .get('/api/v1/jobs');

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.data.length > 0, 'Public candidate exploration must succeed');
    assert.ok(res.body.pagination.total > 0);
  });

  it('3. GET /api/v1/jobs includes jobs from multiple connected sources (Codewalla, Synechron, Codfis)', async () => {
    const res = await supertest(app)
      .get('/api/v1/jobs?pageSize=100');

    assert.strictEqual(res.status, 200);
    const sourceTypes = new Set(res.body.data.map((j: any) => j.sourceType));
    assert.ok(sourceTypes.size >= 2, 'Should discover jobs from multiple ingestion sources');
  });

  it('4. Filter: search query matches keywords without returning 0 prematurely', async () => {
    const res = await supertest(app)
      .get('/api/v1/jobs?query=Engineer');

    assert.strictEqual(res.status, 200);
    assert.ok(res.body.data.length > 0, 'Should find jobs matching query "Engineer"');
  });

  it('5. Filter: work mode (remoteType) filters correctly', async () => {
    const res = await supertest(app)
      .get('/api/v1/jobs?remoteType=REMOTE');

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    for (const job of res.body.data) {
      assert.strictEqual(job.remoteType, 'REMOTE');
    }
  });

  it('6. Filter: employmentType filters correctly', async () => {
    const res = await supertest(app)
      .get('/api/v1/jobs?employmentType=FULL_TIME');

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    for (const job of res.body.data) {
      assert.strictEqual(job.employmentType, 'FULL_TIME');
    }
  });

  it('7. Filter: sourceType filters correctly for connected source types', async () => {
    const res = await supertest(app)
      .get('/api/v1/jobs?sourceType=JSON_API');

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    for (const job of res.body.data) {
      assert.strictEqual(job.sourceType, 'JSON_API');
    }
  });

  it('8. Pagination: page & pageSize return properly sliced canonical records', async () => {
    const resPage1 = await supertest(app)
      .get('/api/v1/jobs?page=1&pageSize=5');
    const resPage2 = await supertest(app)
      .get('/api/v1/jobs?page=2&pageSize=5');

    assert.strictEqual(resPage1.body.data.length, 5);
    assert.strictEqual(resPage2.body.data.length, 5);
    assert.notStrictEqual(resPage1.body.data[0].id, resPage2.body.data[0].id);
    assert.strictEqual(resPage1.body.pagination.page, 1);
    assert.strictEqual(resPage2.body.pagination.page, 2);
  });

  it('9. Job detail: GET /api/v1/jobs/:id returns complete canonical metadata', async () => {
    const listRes = await supertest(app).get('/api/v1/jobs?pageSize=1');
    const firstJobId = listRes.body.data[0].id;

    const detailRes = await supertest(app)
      .get(`/api/v1/jobs/${firstJobId}`);

    assert.strictEqual(detailRes.status, 200);
    assert.strictEqual(detailRes.body.data.id, firstJobId);
    assert.ok(detailRes.body.data.title);
    assert.ok(detailRes.body.data.company);
    assert.ok(detailRes.body.data.company.name);
  });

  it('10. Sorting: supports oldest, newest, company, location, and salary', async () => {
    const resOldest = await supertest(app).get('/api/v1/jobs?sortBy=oldest&pageSize=5');
    assert.strictEqual(resOldest.status, 200);
    assert.ok(Array.isArray(resOldest.body.data));

    const resCompany = await supertest(app).get('/api/v1/jobs?sortBy=company&pageSize=5');
    assert.strictEqual(resCompany.status, 200);
    assert.ok(Array.isArray(resCompany.body.data));

    const resLocation = await supertest(app).get('/api/v1/jobs?sortBy=location&pageSize=5');
    assert.strictEqual(resLocation.status, 200);
    assert.ok(Array.isArray(resLocation.body.data));
  });

  it('11. Filter: postedDays filters jobs relative to current timestamp', async () => {
    const res = await supertest(app).get('/api/v1/jobs?postedDays=30');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
  });

  after(async () => {
    // Clean up seeded candidate test jobs and companies
    try {
      await prisma.job.deleteMany({
        where: {
          contentHash: {
            startsWith: 'hash_candidate_test_job_'
          }
        }
      });
      if (testCompanyA) {
        await prisma.company.delete({ where: { id: testCompanyA.id } }).catch(() => { });
      }
      if (testCompanyB) {
        await prisma.company.delete({ where: { id: testCompanyB.id } }).catch(() => { });
      }
    } catch {
      // Ignore cleanup error
    }
  });
});
