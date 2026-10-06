import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { app } from '../server.js';
import { prisma } from '../database/prisma.js';
import { signAccessToken } from '../utils/jwt.js';
import { UserRole, ApplicationStatus } from '@prisma/client';

describe('Sprint 5 Application Intelligence & Tracking Suite', () => {
  let userA: any;
  let userB: any;
  let tokenA: string;
  let tokenB: string;
  let company: any;
  let jobA: any;
  let jobB: any;
  let resumeVersionA: any;
  let resumeVersionB: any;
  let testAppId: string;

  before(async () => {
    // Clean up test users and companies if existing
    await prisma.user.deleteMany({
      where: {
        email: { in: ['cand.sprint5.a@pilotmama.com', 'cand.sprint5.b@pilotmama.com'] }
      }
    });
    await prisma.company.deleteMany({
      where: { name: 'Sprint 5 Applications Test Corp' }
    });

    // 1. Create Candidate A
    userA = await prisma.user.create({
      data: {
        email: 'cand.sprint5.a@pilotmama.com',
        passwordHash: '$argon2id$mockhashsprint5a',
        role: UserRole.CANDIDATE,
        candidateProfile: {
          create: {
            fullName: 'Alex Vance',
            headline: 'Lead QA Engineer',
            location: 'Austin, TX'
          }
        }
      },
      include: { candidateProfile: true }
    });
    tokenA = signAccessToken({
      userId: userA.id,
      email: userA.email,
      role: userA.role
    });

    // 2. Create Candidate B (for cross-user isolation tests)
    userB = await prisma.user.create({
      data: {
        email: 'cand.sprint5.b@pilotmama.com',
        passwordHash: '$argon2id$mockhashsprint5b',
        role: UserRole.CANDIDATE,
        candidateProfile: {
          create: {
            fullName: 'Jordan Taylor',
            headline: 'Data Scientist',
            location: 'Seattle, WA'
          }
        }
      },
      include: { candidateProfile: true }
    });
    tokenB = signAccessToken({
      userId: userB.id,
      email: userB.email,
      role: userB.role
    });

    // 3. Create Company and Jobs
    company = await prisma.company.create({
      data: {
        name: 'Sprint 5 Applications Test Corp',
        officialDomain: 'sprint5apptest.com'
      }
    });

    jobA = await prisma.job.create({
      data: {
        companyId: company.id,
        title: 'Senior Automation Engineer',
        description: 'Test Automation with TypeScript and Playwright',
        sourceType: 'DIRECT',
        sourceName: 'Career Page',
        sourceUrl: 'https://sprint5apptest.com/jobs/1',
        applicationUrl: 'https://sprint5apptest.com/apply/1',
        contentHash: 'hash-sprint5-job-a'
      }
    });

    jobB = await prisma.job.create({
      data: {
        companyId: company.id,
        title: 'Staff Platform Engineer',
        description: 'Kubernetes and Cloud Infrastructure',
        sourceType: 'DIRECT',
        sourceName: 'Career Page',
        sourceUrl: 'https://sprint5apptest.com/jobs/2',
        applicationUrl: 'https://sprint5apptest.com/apply/2',
        contentHash: 'hash-sprint5-job-b'
      }
    });

    // 4. Create Resume and ResumeVersion for User A
    const resumeA = await prisma.resume.create({
      data: {
        candidateProfileId: userA.candidateProfile!.id,
        title: 'Alex Resume'
      }
    });

    resumeVersionA = await prisma.resumeVersion.create({
      data: {
        resumeId: resumeA.id,
        versionName: 'Alex_Vance_v1',
        structuredContent: { summary: 'Alex Vance Resume' }
      }
    });

    // 5. Create Resume and ResumeVersion for User B
    const resumeB = await prisma.resume.create({
      data: {
        candidateProfileId: userB.candidateProfile!.id,
        title: 'Jordan Resume'
      }
    });

    resumeVersionB = await prisma.resumeVersion.create({
      data: {
        resumeId: resumeB.id,
        versionName: 'Jordan_Taylor_v1',
        structuredContent: { summary: 'Jordan Taylor Resume' }
      }
    });
  });

  after(async () => {
    await prisma.user.deleteMany({
      where: {
        email: { in: ['cand.sprint5.a@pilotmama.com', 'cand.sprint5.b@pilotmama.com'] }
      }
    });
    await prisma.company.deleteMany({
      where: { name: 'Sprint 5 Applications Test Corp' }
    });
  });

  describe('1. Authentication & Security Enforcement', () => {
    it('rejects unauthenticated requests to applications endpoint', async () => {
      const res = await request(app).get('/api/v1/applications');
      assert.strictEqual(res.status, 401);
    });

    it('rejects unauthenticated requests to saved-jobs endpoint', async () => {
      const res = await request(app).get('/api/v1/saved-jobs');
      assert.strictEqual(res.status, 401);
    });
  });

  describe('2. Application Creation & Validation', () => {
    it('rejects creating application for non-existent job', async () => {
      const res = await request(app)
        .post('/api/v1/applications')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          jobId: '00000000-0000-0000-0000-000000000000'
        });
      assert.strictEqual(res.status, 404);
    });

    it('rejects attaching another candidate ResumeVersion (IDOR defense)', async () => {
      const res = await request(app)
        .post('/api/v1/applications')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          jobId: jobA.id,
          resumeVersionId: resumeVersionB.id // Jordan's resume version
        });
      assert.strictEqual(res.status, 403);
      assert.ok(res.body.error.message.includes('another candidate'));
    });

    it('creates an application successfully with exact resume version and initial status history', async () => {
      const res = await request(app)
        .post('/api/v1/applications')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          jobId: jobA.id,
          resumeVersionId: resumeVersionA.id,
          status: 'SAVED',
          notesSummary: 'Applied via company site'
        });

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.jobId, jobA.id);
      assert.strictEqual(res.body.data.status, 'SAVED');
      assert.strictEqual(res.body.data.resumeVersionId, resumeVersionA.id);
      assert.strictEqual(res.body.data.externalUrl, jobA.applicationUrl); // Defaults to job's applicationUrl

      testAppId = res.body.data.id;

      // Verify status history was created
      const historyRes = await request(app)
        .get(`/api/v1/applications/${testAppId}/history`)
        .set('Authorization', `Bearer ${tokenA}`);
      assert.strictEqual(historyRes.status, 200);
      assert.strictEqual(historyRes.body.data.length, 1);
      assert.strictEqual(historyRes.body.data[0].newStatus, 'SAVED');
    });

    it('prevents accidental duplicate applications for the same candidate and job', async () => {
      const res = await request(app)
        .post('/api/v1/applications')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          jobId: jobA.id,
          status: 'READY_TO_APPLY'
        });
      assert.strictEqual(res.status, 409);
      assert.ok(res.body.error.message.includes('already exists'));
    });
  });

  describe('3. Cross-Candidate Isolation & IDOR Protection', () => {
    it('Candidate B cannot view Candidate A application', async () => {
      const res = await request(app)
        .get(`/api/v1/applications/${testAppId}`)
        .set('Authorization', `Bearer ${tokenB}`);
      assert.strictEqual(res.status, 403);
    });

    it('Candidate B cannot update Candidate A application status', async () => {
      const res = await request(app)
        .post(`/api/v1/applications/${testAppId}/status`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ status: 'APPLIED' });
      assert.strictEqual(res.status, 403);
    });

    it('Candidate B cannot add note to Candidate A application', async () => {
      const res = await request(app)
        .post(`/api/v1/applications/${testAppId}/notes`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ content: 'Malicious note injection' });
      assert.strictEqual(res.status, 403);
    });

    it('Candidate B application list does not leak Candidate A applications', async () => {
      const res = await request(app)
        .get('/api/v1/applications')
        .set('Authorization', `Bearer ${tokenB}`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.length, 0);
    });
  });

  describe('4. Status Transitions & History Tracking', () => {
    it('rejects invalid status transitions', async () => {
      // SAVED -> FINAL_ROUND is not permitted directly
      const res = await request(app)
        .post(`/api/v1/applications/${testAppId}/status`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ status: 'FINAL_ROUND' });
      assert.strictEqual(res.status, 400);
      assert.ok(res.body.error.message.includes('Invalid status transition'));
    });

    it('advances status from SAVED to READY_TO_APPLY and records history', async () => {
      const res = await request(app)
        .post(`/api/v1/applications/${testAppId}/status`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          status: 'READY_TO_APPLY',
          reason: 'Resume tailored and cover letter ready'
        });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.status, 'READY_TO_APPLY');

      const historyRes = await request(app)
        .get(`/api/v1/applications/${testAppId}/history`)
        .set('Authorization', `Bearer ${tokenA}`);
      assert.strictEqual(historyRes.body.data.length, 2);
      assert.strictEqual(historyRes.body.data[0].newStatus, 'READY_TO_APPLY');
      assert.strictEqual(historyRes.body.data[0].previousStatus, 'SAVED');
    });

    it('advances status from READY_TO_APPLY to APPLIED and sets appliedAt timestamp', async () => {
      const res = await request(app)
        .post(`/api/v1/applications/${testAppId}/status`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          status: 'APPLIED',
          reason: 'Submitted on company career site'
        });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.status, 'APPLIED');
      assert.ok(res.body.data.appliedAt);
    });

    it('advances status through interview stages: APPLIED -> HR_SCREEN -> TECHNICAL', async () => {
      const hrRes = await request(app)
        .post(`/api/v1/applications/${testAppId}/status`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ status: 'HR_SCREEN', reason: 'Recruiter phone screen scheduled' });
      assert.strictEqual(hrRes.status, 200);
      assert.strictEqual(hrRes.body.data.status, 'HR_SCREEN');

      const techRes = await request(app)
        .post(`/api/v1/applications/${testAppId}/status`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ status: 'TECHNICAL', reason: 'Passed HR screen, coding round scheduled' });
      assert.strictEqual(techRes.status, 200);
      assert.strictEqual(techRes.body.data.status, 'TECHNICAL');
    });
  });

  describe('5. Notes & Reminders Management', () => {
    let createdNoteId: string;
    let createdReminderId: string;

    it('adds candidate note to application', async () => {
      const res = await request(app)
        .post(`/api/v1/applications/${testAppId}/notes`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ content: 'Spoke with hiring manager; team uses Playwright and TypeScript.' });
      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.data.content, 'Spoke with hiring manager; team uses Playwright and TypeScript.');
      createdNoteId = res.body.data.id;
    });

    it('retrieves notes for application', async () => {
      const res = await request(app)
        .get(`/api/v1/applications/${testAppId}/notes`)
        .set('Authorization', `Bearer ${tokenA}`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.length, 1);
    });

    it('deletes candidate note from application', async () => {
      const res = await request(app)
        .delete(`/api/v1/applications/${testAppId}/notes/${createdNoteId}`)
        .set('Authorization', `Bearer ${tokenA}`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.success, true);
    });

    it('creates timezone-safe reminder tied to application', async () => {
      const dueDate = new Date(Date.now() + 86400000).toISOString();
      const res = await request(app)
        .post(`/api/v1/applications/${testAppId}/reminders`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          title: 'Prepare system design answers for technical round',
          dueDate
        });
      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.data.title, 'Prepare system design answers for technical round');
      createdReminderId = res.body.data.id;
    });

    it('retrieves reminders for application', async () => {
      const res = await request(app)
        .get(`/api/v1/applications/${testAppId}/reminders`)
        .set('Authorization', `Bearer ${tokenA}`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.length, 1);
    });

    it('deletes reminder from application', async () => {
      const res = await request(app)
        .delete(`/api/v1/applications/${testAppId}/reminders/${createdReminderId}`)
        .set('Authorization', `Bearer ${tokenA}`);
      assert.strictEqual(res.status, 200);
    });
  });

  describe('6. Saved Jobs Management & Uniqueness', () => {
    it('saves a job for candidate', async () => {
      const res = await request(app)
        .post(`/api/v1/saved-jobs/${jobB.id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ notes: 'Interesting platform role' });
      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.data.jobId, jobB.id);
    });

    it('enforces saved job uniqueness (no duplicate save for same job)', async () => {
      const res = await request(app)
        .post(`/api/v1/saved-jobs/${jobB.id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ notes: 'Duplicate save attempt' });
      assert.strictEqual(res.status, 409);
    });

    it('lists saved jobs for candidate', async () => {
      const res = await request(app)
        .get('/api/v1/saved-jobs')
        .set('Authorization', `Bearer ${tokenA}`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.length, 1);
      assert.strictEqual(res.body.data[0].jobId, jobB.id);
    });

    it('removes saved job', async () => {
      const res = await request(app)
        .delete(`/api/v1/saved-jobs/${jobB.id}`)
        .set('Authorization', `Bearer ${tokenA}`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.success, true);
    });
  });

  describe('7. Application Statistics & Analytics', () => {
    it('calculates accurate persisted statistics without fabrication', async () => {
      const res = await request(app)
        .get('/api/v1/applications/stats')
        .set('Authorization', `Bearer ${tokenA}`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);

      const stats = res.body.data;
      assert.strictEqual(stats.total, 1);
      assert.strictEqual(stats.technical, 1);
      assert.strictEqual(stats.interviewsTotal, 1);
      assert.strictEqual(stats.active, 1);
      assert.strictEqual(stats.offers, 0);
      assert.strictEqual(stats.rejected, 0);
    });
  });
});
