import test from 'node:test';
import assert from 'node:assert/strict';
import { EmployerRepository } from '../modules/employer/employer.repository.js';
import { EmployerService } from '../modules/employer/employer.service.js';
import { prisma } from '../database/prisma.js';
import {
  EmployerRole,
  EmployerJobStatus,
  EmployerApplicationStage,
  UserRole
} from '@prisma/client';

test('Sprint 8: Employer Platform & Tenant Isolation Test Suite', async (t) => {
  const db = prisma;
  const repo = new EmployerRepository();
  const service = new EmployerService(repo);

  const timestamp = Date.now();
  const orgAEmail = `owner.orga.${timestamp}@pilotmama.test`;
  const orgBEmail = `owner.orgb.${timestamp}@pilotmama.test`;
  const candidateEmail = `applicant.${timestamp}@pilotmama.test`;

  // 1. Setup Users
  const userOrgA = await db.user.create({
    data: {
      email: orgAEmail,
      passwordHash: 'dummy-hash',
      role: UserRole.EMPLOYER
    }
  });

  const userOrgB = await db.user.create({
    data: {
      email: orgBEmail,
      passwordHash: 'dummy-hash',
      role: UserRole.EMPLOYER
    }
  });

  const candidateUser = await db.user.create({
    data: {
      email: candidateEmail,
      passwordHash: 'dummy-hash',
      role: UserRole.CANDIDATE,
      candidateProfile: {
        create: {
          fullName: 'Test Applicant',
          email: candidateEmail,
          headline: 'Senior Full Stack Engineer',
          location: 'Bengaluru, India'
        }
      }
    },
    include: { candidateProfile: true }
  });

  const candidateProfile = candidateUser.candidateProfile!;

  // Create candidate master resume and submitted version
  const resume = await db.resume.create({
    data: {
      candidateProfileId: candidateProfile.id,
      title: 'Master Resume'
    }
  });

  const submittedResumeVersion = await db.resumeVersion.create({
    data: {
      resumeId: resume.id,
      versionName: 'Sprint 8 Tailored Version',
      structuredContent: { summary: 'Experienced full stack developer' },
      summary: 'Experienced full stack developer'
    }
  });

  let orgAId: string;
  let orgBId: string;
  let jobAId: string;
  let jobBId: string;
  let appAId: string;

  await t.test('1. Organization Onboarding creates company, organization, and owner membership', async () => {
    const resA = await service.createOrganization(userOrgA.id, {
      name: `Acme Corp ${timestamp}`,
      domain: `acme-${timestamp}.com`,
      website: `https://acme-${timestamp}.com`,
      industry: 'Software',
      headquarters: 'San Francisco, CA'
    });

    assert.ok(resA.organization.id);
    assert.equal(resA.member.role, EmployerRole.OWNER);
    assert.equal(resA.member.userId, userOrgA.id);
    orgAId = resA.organization.id;

    const resB = await service.createOrganization(userOrgB.id, {
      name: `Beta Labs ${timestamp}`,
      domain: `beta-${timestamp}.com`
    });
    orgBId = resB.organization.id;
  });

  await t.test('2. My Organization retrieves context correctly', async () => {
    const myOrg = await service.getMyOrganization(userOrgA.id);
    assert.equal(myOrg.organization.id, orgAId);
    assert.equal(myOrg.currentMember.role, EmployerRole.OWNER);
  });

  await t.test('3. Job Creation by Organization A assigns ownership and draft status', async () => {
    const jobA = await service.createJob(userOrgA.id, {
      title: 'Principal Distributed Systems Engineer',
      description: 'Lead architecture for Pilot Mama real-time pipeline systems.',
      requirements: ['TypeScript', 'Node.js', 'PostgreSQL'],
      responsibilities: ['Build resilient backend'],
      preferredQualifications: ['Prisma expertise'],
      location: 'Bengaluru',
      skills: ['TypeScript', 'PostgreSQL']
    });

    assert.ok(jobA.id);
    assert.equal(jobA.organizationId, orgAId);
    assert.equal(jobA.organizationJobStatus, EmployerJobStatus.DRAFT);
    jobAId = jobA.id;

    const jobB = await service.createJob(userOrgB.id, {
      title: 'Product Designer',
      description: 'Design UI for Beta Labs.',
      requirements: ['Figma'],
      responsibilities: [],
      preferredQualifications: [],
      skills: ['Figma']
    });
    jobBId = jobB.id;
  });

  await t.test('4. Job Publication Lifecycle: Draft -> Published -> Paused -> Closed', async () => {
    const published = await service.updateJobStatus(userOrgA.id, jobAId, EmployerJobStatus.PUBLISHED);
    assert.equal(published.organizationJobStatus, EmployerJobStatus.PUBLISHED);
    assert.equal(published.status, 'ACTIVE');

    const paused = await service.updateJobStatus(userOrgA.id, jobAId, EmployerJobStatus.PAUSED);
    assert.equal(paused.organizationJobStatus, EmployerJobStatus.PAUSED);

    const reopened = await service.updateJobStatus(userOrgA.id, jobAId, EmployerJobStatus.PUBLISHED);
    assert.equal(reopened.organizationJobStatus, EmployerJobStatus.PUBLISHED);
  });

  await t.test('5. Tenant Isolation: Org A cannot view or modify Org B jobs (IDOR protection)', async () => {
    // Org A attempts to fetch Org B's job
    await assert.rejects(
      async () => service.getJob(userOrgA.id, jobBId),
      { name: 'NotFoundError' }
    );

    // Org A attempts to update Org B's job
    await assert.rejects(
      async () => service.updateJobStatus(userOrgA.id, jobBId, EmployerJobStatus.CLOSED),
      { name: 'NotFoundError' }
    );
  });

  await t.test('6. Candidate Applies to Job A', async () => {
    const app = await db.application.create({
      data: {
        candidateProfileId: candidateProfile.id,
        jobId: jobAId,
        resumeVersionId: submittedResumeVersion.id,
        status: 'APPLIED',
        appliedAt: new Date()
      }
    });

    assert.ok(app.id);
    appAId = app.id;

    // Attach initial review record
    await repo.recordApplicationReview(app.id, userOrgA.id, {
      stage: EmployerApplicationStage.NEW
    });
  });

  await t.test('7. Org A sees applicant in their pipeline with submitted ResumeVersion', async () => {
    const applicants = await service.listJobApplications(userOrgA.id, jobAId);
    assert.equal(applicants.length, 1);
    assert.equal(applicants[0].id, appAId);
    assert.equal(applicants[0].candidateProfile.fullName, 'Test Applicant');
    assert.equal(applicants[0].resumeVersion?.versionName, 'Sprint 8 Tailored Version');

    const appDetail = await service.getApplicationDetail(userOrgA.id, appAId);
    assert.equal(appDetail.id, appAId);
    assert.equal(appDetail.job.id, jobAId);
    assert.equal(appDetail.candidateProfile.email, candidateEmail);
  });

  await t.test('8. Tenant Isolation: Org B CANNOT see applicants or reviews of Org A', async () => {
    await assert.rejects(
      async () => service.getApplicationDetail(userOrgB.id, appAId),
      { name: 'NotFoundError' }
    );

    await assert.rejects(
      async () => service.updateApplicationStage(userOrgB.id, appAId, { stage: EmployerApplicationStage.INTERVIEW }),
      { name: 'NotFoundError' }
    );
  });

  await t.test('9. Org A Recruiter updates application stage & adds internal notes', async () => {
    const updatedStage = await service.updateApplicationStage(userOrgA.id, appAId, {
      stage: EmployerApplicationStage.INTERVIEW,
      rating: 5,
      notes: 'Strong distributed systems background.'
    });

    assert.equal(updatedStage.stage, EmployerApplicationStage.INTERVIEW);
    assert.equal(updatedStage.rating, 5);

    const noteRecord = await service.addApplicationNote(userOrgA.id, appAId, {
      notes: 'Passed technical screen with flying colors.',
      rating: 5
    });

    assert.equal(noteRecord.notes, 'Passed technical screen with flying colors.');
  });

  await t.test('10. Dashboard Metrics aggregate organization metrics accurately', async () => {
    const metrics = await service.getDashboardMetrics(userOrgA.id);
    assert.equal(metrics.jobs.total, 1);
    assert.equal(metrics.jobs.active, 1);
    assert.equal(metrics.applicants.total, 1);
  });
});
