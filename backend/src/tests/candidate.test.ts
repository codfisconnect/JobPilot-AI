import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { app } from '../server.js';
import { prisma } from '../database/prisma.js';
import { signAccessToken } from '../utils/jwt.js';
import { UserRole } from '@prisma/client';

describe('Sprint 2 Candidate Profile & Preferences Integration Suite', () => {
  let candidateUserA: any;
  let candidateUserB: any;
  let tokenA: string;
  let tokenB: string;

  before(async () => {
    // Clean up any remnants
    await prisma.user.deleteMany({
      where: { email: { in: ['cand.alice@pilotmama.com', 'cand.bob@pilotmama.com'] } }
    });

    // Create Candidate A
    candidateUserA = await prisma.user.create({
      data: {
        email: 'cand.alice@pilotmama.com',
        passwordHash: '$argon2id$mockhashforCandidateA',
        role: UserRole.CANDIDATE,
        candidateProfile: {
          create: {
            fullName: 'Alice Developer',
            headline: 'Senior Full Stack Engineer',
            location: 'San Francisco, CA, USA',
            country: 'USA',
            city: 'San Francisco',
            summary: 'Passionate software craftsman building resilient systems.'
          }
        }
      },
      include: { candidateProfile: true }
    });

    tokenA = signAccessToken({
      userId: candidateUserA.id,
      email: candidateUserA.email,
      role: UserRole.CANDIDATE
    });

    // Create Candidate B
    candidateUserB = await prisma.user.create({
      data: {
        email: 'cand.bob@pilotmama.com',
        passwordHash: '$argon2id$mockhashforCandidateB',
        role: UserRole.CANDIDATE,
        candidateProfile: {
          create: {
            fullName: 'Bob Architect',
            headline: 'Cloud Solutions Architect',
            location: 'London, UK',
            country: 'UK',
            city: 'London'
          }
        }
      },
      include: { candidateProfile: true }
    });

    tokenB = signAccessToken({
      userId: candidateUserB.id,
      email: candidateUserB.email,
      role: UserRole.CANDIDATE
    });
  });

  after(async () => {
    await prisma.user.deleteMany({
      where: { email: { in: ['cand.alice@pilotmama.com', 'cand.bob@pilotmama.com'] } }
    });
  });

  describe('Candidate Profile Retrieval & Update', () => {
    it('should retrieve Candidate A profile via GET /api/v1/candidates/me', async () => {
      const res = await request(app)
        .get('/api/v1/candidates/me')
        .set('Authorization', `Bearer ${tokenA}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.fullName, 'Alice Developer');
      assert.strictEqual(res.body.data.country, 'USA');
    });

    it('should update Candidate A profile via PATCH /api/v1/candidates/me', async () => {
      const res = await request(app)
        .patch('/api/v1/candidates/me')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          headline: 'Principal Staff Engineer',
          city: 'New York',
          country: 'USA',
          linkedinUrl: 'https://linkedin.com/in/alicedev'
        });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.headline, 'Principal Staff Engineer');
      assert.strictEqual(res.body.data.city, 'New York');
      assert.strictEqual(res.body.data.linkedinUrl, 'https://linkedin.com/in/alicedev');
    });
  });

  describe('Candidate Preferences', () => {
    it('should update and get preferences via /api/v1/candidates/me/preferences', async () => {
      const updateRes = await request(app)
        .patch('/api/v1/candidates/me/preferences')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          targetRoles: ['Staff Engineer', 'Engineering Lead'],
          preferredLocations: ['New York, NY', 'Remote'],
          preferredCountries: ['USA', 'Canada'],
          remotePreference: 'REMOTE',
          salaryExpectations: '$180,000 - $220,000',
          minSalary: 180000,
          currency: 'USD',
          willingToRelocate: false,
          noticePeriod: '2 weeks'
        });

      assert.strictEqual(updateRes.status, 200);
      assert.strictEqual(updateRes.body.data.remotePreference, 'REMOTE');
      assert.strictEqual(updateRes.body.data.minSalary, 180000);

      const getRes = await request(app)
        .get('/api/v1/candidates/me/preferences')
        .set('Authorization', `Bearer ${tokenA}`);

      assert.strictEqual(getRes.status, 200);
      assert.strictEqual(getRes.body.data.currency, 'USD');
      assert.deepStrictEqual(getRes.body.data.targetRoles, ['Staff Engineer', 'Engineering Lead']);
    });
  });

  describe('Experience CRUD & Date Rules', () => {
    let createdExpId: string;

    it('should create an experience record with valid dates', async () => {
      const res = await request(app)
        .post('/api/v1/candidates/me/experiences')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          company: 'Acme Global Corp',
          jobTitle: 'Senior Software Engineer',
          startDate: '2021-03-01T00:00:00.000Z',
          isCurrent: true,
          responsibilities: ['Architected distributed microservices', 'Mentored 5 junior engineers'],
          technologies: ['TypeScript', 'Node.js', 'PostgreSQL', 'Docker']
        });

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.data.company, 'Acme Global Corp');
      assert.strictEqual(res.body.data.isCurrent, true);
      assert.strictEqual(res.body.data.endDate, null);
      createdExpId = res.body.data.id;
    });

    it('should reject experience where end date precedes start date', async () => {
      const res = await request(app)
        .post('/api/v1/candidates/me/experiences')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          company: 'Invalid Timeline Corp',
          jobTitle: 'Software Engineer',
          startDate: '2023-01-01T00:00:00.000Z',
          endDate: '2021-01-01T00:00:00.000Z',
          isCurrent: false
        });

      assert.strictEqual(res.status, 400);
      assert.ok(res.body.error.message.includes('End date cannot precede start date'));
    });

    it('should reject current experience with an end date provided', async () => {
      const res = await request(app)
        .post('/api/v1/candidates/me/experiences')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          company: 'Contradictory Job Inc',
          jobTitle: 'Lead',
          startDate: '2022-01-01T00:00:00.000Z',
          endDate: '2024-01-01T00:00:00.000Z',
          isCurrent: true
        });

      assert.strictEqual(res.status, 400);
      assert.ok(res.body.error.message.includes('Current jobs cannot have an end date'));
    });

    it('should update experience record', async () => {
      const res = await request(app)
        .patch(`/api/v1/candidates/me/experiences/${createdExpId}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          jobTitle: 'Staff Software Engineer',
          location: 'Remote'
        });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.jobTitle, 'Staff Software Engineer');
      assert.strictEqual(res.body.data.location, 'Remote');
    });

    it('should prevent Candidate B from modifying or deleting Candidate A experience', async () => {
      const patchRes = await request(app)
        .patch(`/api/v1/candidates/me/experiences/${createdExpId}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ jobTitle: 'Hacked Title' });

      assert.strictEqual(patchRes.status, 404);

      const delRes = await request(app)
        .delete(`/api/v1/candidates/me/experiences/${createdExpId}`)
        .set('Authorization', `Bearer ${tokenB}`);

      assert.strictEqual(delRes.status, 404);
    });

    it('should delete experience record', async () => {
      const delRes = await request(app)
        .delete(`/api/v1/candidates/me/experiences/${createdExpId}`)
        .set('Authorization', `Bearer ${tokenA}`);

      assert.strictEqual(delRes.status, 200);
    });
  });

  describe('Education, Skills, Certifications, and Projects CRUD', () => {
    it('should support Education CRUD', async () => {
      const createRes = await request(app)
        .post('/api/v1/candidates/me/educations')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          institution: 'MIT',
          degree: 'Bachelor of Science',
          fieldOfStudy: 'Computer Science',
          gradeGpa: '3.9'
        });

      assert.strictEqual(createRes.status, 201);
      const eduId = createRes.body.data.id;

      const getRes = await request(app)
        .get('/api/v1/candidates/me/educations')
        .set('Authorization', `Bearer ${tokenA}`);

      assert.strictEqual(getRes.status, 200);
      assert.strictEqual(getRes.body.data.length, 1);

      const delRes = await request(app)
        .delete(`/api/v1/candidates/me/educations/${eduId}`)
        .set('Authorization', `Bearer ${tokenA}`);

      assert.strictEqual(delRes.status, 200);
    });

    it('should support Normalized Skills and avoid inventing years of experience', async () => {
      const skillRes = await request(app)
        .post('/api/v1/candidates/me/skills')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          name: 'Playwright',
          proficiency: 'Advanced',
          // No yearsOfExperience provided: Must be stored as null!
          source: 'RESUME'
        });

      assert.strictEqual(skillRes.status, 201);
      assert.strictEqual(skillRes.body.data.yearsOfExperience, null);
      assert.strictEqual(skillRes.body.data.skill.name, 'Playwright');

      const skillId = skillRes.body.data.id;

      // Add skill with explicit years
      const javaRes = await request(app)
        .post('/api/v1/candidates/me/skills')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          name: 'Java',
          yearsOfExperience: 6,
          source: 'MANUAL'
        });

      assert.strictEqual(javaRes.status, 201);
      assert.strictEqual(javaRes.body.data.yearsOfExperience, 6);

      // Clean up
      await request(app).delete(`/api/v1/candidates/me/skills/${skillId}`).set('Authorization', `Bearer ${tokenA}`);
      await request(app).delete(`/api/v1/candidates/me/skills/${javaRes.body.data.id}`).set('Authorization', `Bearer ${tokenA}`);
    });

    it('should support Certifications and Projects CRUD', async () => {
      // Certification
      const certRes = await request(app)
        .post('/api/v1/candidates/me/certifications')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          name: 'AWS Certified Solutions Architect',
          issuingOrganization: 'Amazon Web Services',
          credentialId: 'AWS-123456'
        });

      assert.strictEqual(certRes.status, 201);
      const certId = certRes.body.data.id;

      // Project
      const projRes = await request(app)
        .post('/api/v1/candidates/me/projects')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          name: 'High-Throughput Ingestion Engine',
          role: 'Lead Architect',
          technologies: ['Go', 'Kafka', 'PostgreSQL']
        });

      assert.strictEqual(projRes.status, 201);
      const projId = projRes.body.data.id;

      // Clean up
      await request(app).delete(`/api/v1/candidates/me/certifications/${certId}`).set('Authorization', `Bearer ${tokenA}`);
      await request(app).delete(`/api/v1/candidates/me/projects/${projId}`).set('Authorization', `Bearer ${tokenA}`);
    });
  });
});
