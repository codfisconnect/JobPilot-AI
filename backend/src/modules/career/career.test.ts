import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { app } from '../../server.js';
import { prisma } from '../../database/prisma.js';
import { signAccessToken } from '../../utils/jwt.js';
import { UserRole } from '@prisma/client';

describe('Sprint 6: Career Intelligence Backend Test Suite', () => {
  let userA: any;
  let userB: any;
  let tokenA: string;
  let tokenB: string;
  let testCompany: any;
  let testJob: any;

  before(async () => {
    // Clean up
    await prisma.user.deleteMany({
      where: { email: { in: ['cand.career.a@pilotmama.com', 'cand.career.b@pilotmama.com'] } }
    });
    await prisma.company.deleteMany({
      where: { name: 'Career Test Corp' }
    });

    // 1. Candidate A: Verified in TypeScript, React; Missing: Kubernetes
    userA = await prisma.user.create({
      data: {
        email: 'cand.career.a@pilotmama.com',
        passwordHash: '$argon2id$mockhashforSprint6',
        role: UserRole.CANDIDATE,
        candidateProfile: {
          create: {
            fullName: 'Sara Chen',
            headline: 'Frontend Engineer',
            location: 'San Francisco, CA',
            experiences: {
              create: [
                {
                  company: 'WebTech Studio',
                  jobTitle: 'Frontend Engineer',
                  startDate: new Date('2021-06-01'),
                  isCurrent: true,
                  responsibilities: ['Architected React component systems with TypeScript.'],
                  technologies: ['TypeScript', 'React', 'CSS']
                }
              ]
            },
            skills: {
              create: [
                {
                  skill: {
                    connectOrCreate: {
                      where: { name: 'TypeScript' },
                      create: { name: 'TypeScript', category: 'TECHNICAL' }
                    }
                  },
                  proficiency: 'Expert',
                  yearsOfExperience: 4
                },
                {
                  skill: {
                    connectOrCreate: {
                      where: { name: 'React' },
                      create: { name: 'React', category: 'TECHNICAL' }
                    }
                  },
                  proficiency: 'Advanced',
                  yearsOfExperience: 3
                }
              ]
            }
          }
        }
      },
      include: {
        candidateProfile: {
          include: { skills: { include: { skill: true } } }
        }
      }
    });

    tokenA = signAccessToken({
      userId: userA.id,
      email: userA.email,
      role: userA.role
    });

    // 2. Candidate B for IDOR tests
    userB = await prisma.user.create({
      data: {
        email: 'cand.career.b@pilotmama.com',
        passwordHash: '$argon2id$mockhashforSprint6',
        role: UserRole.CANDIDATE,
        candidateProfile: {
          create: {
            fullName: 'David Miller',
            headline: 'DevOps Engineer',
            location: 'Seattle, WA'
          }
        }
      },
      include: {
        candidateProfile: true
      }
    });

    tokenB = signAccessToken({
      userId: userB.id,
      email: userB.email,
      role: userB.role
    });

    // 3. Create Company & Job (Full Stack Engineer requiring React, TypeScript, Kubernetes, Go)
    testCompany = await prisma.company.create({
      data: {
        name: 'Career Test Corp'
      }
    });

    testJob = await prisma.job.create({
      data: {
        companyId: testCompany.id,
        title: 'Full Stack Engineer',
        description: 'Modern web platforms with TypeScript, React, Go, and Kubernetes.',
        requirements: ['TypeScript', 'React', 'Kubernetes', 'Go'],
        sourceType: 'DIRECT',
        sourceName: 'Career Portal',
        sourceUrl: 'https://careertest.corp/jobs/fullstack',
        contentHash: 'hash-sprint6-career-001'
      }
    });
  });

  after(async () => {
    await prisma.user.deleteMany({
      where: { email: { in: ['cand.career.a@pilotmama.com', 'cand.career.b@pilotmama.com'] } }
    });
    await prisma.company.deleteMany({
      where: { name: 'Career Test Corp' }
    });
  });

  describe('1. Career Profile Assessment & Track Readiness', () => {
    it('GET /api/v1/career/profile evaluates current track alignment without fabricating facts', async () => {
      const res = await request(app)
        .get('/api/v1/career/profile')
        .set('Authorization', `Bearer ${tokenA}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(res.body.data.currentTrack);
      assert.ok(typeof res.body.data.readinessScore === 'number');
      assert.ok(Array.isArray(res.body.data.evidenceBasis));
      assert.ok(res.body.data.evidenceBasis.length > 0, 'Evidence basis must be provided');

      // Check evidence basis citations
      const evidence = res.body.data.evidenceBasis.join(' ');
      assert.ok(evidence.includes('Sara Chen') || evidence.includes('Frontend Engineer') || evidence.includes('TypeScript'));
    });

    it('GET /api/v1/career/profile?targetJobId= evaluates specific job transition alignment', async () => {
      const res = await request(app)
        .get(`/api/v1/career/profile?targetJobId=${testJob.id}`)
        .set('Authorization', `Bearer ${tokenA}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(res.body.data.careerTrack);
      assert.ok(res.body.data.careerTrack.targetRole.includes('Full Stack Engineer'));
      assert.ok(res.body.data.skillGaps);
    });
  });

  describe('2. Truthful Skill Classification (VERIFIED, PARTIAL, MISSING)', () => {
    it('GET /api/v1/career/skills classifies skills accurately according to verified truth', async () => {
      const res = await request(app)
        .get(`/api/v1/career/skills?targetJobId=${testJob.id}`)
        .set('Authorization', `Bearer ${tokenA}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(Array.isArray(res.body.data.skills));

      const skills = res.body.data.skills;
      const typeScript = skills.find((s: any) => s.skill.toLowerCase() === 'typescript');
      const react = skills.find((s: any) => s.skill.toLowerCase() === 'react');
      const kubernetes = skills.find((s: any) => s.skill.toLowerCase() === 'kubernetes');

      // Truth rule: Verified candidate skills MUST NOT be marked missing
      assert.ok(typeScript, 'TypeScript must be included');
      assert.strictEqual(typeScript.status, 'VERIFIED');
      assert.ok(typeScript.evidence.length > 0, 'Must cite verified profile skill');

      assert.ok(react, 'React must be included');
      assert.strictEqual(react.status, 'VERIFIED');

      // Required by JD but not on profile must be MISSING
      assert.ok(kubernetes, 'Kubernetes must be included in evaluated skills');
      assert.strictEqual(kubernetes.status, 'MISSING');
    });
  });

  describe('3. Learning Plan Creation & Reputable URL Integrity', () => {
    let createdPlanId: string;
    let createdItemId: string;

    it('POST /api/v1/career/learning-plan generates plan prioritized by verified SkillGap', async () => {
      const res = await request(app)
        .post('/api/v1/career/learning-plan')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          title: 'Full Stack Engineering Readiness Plan',
          targetJobId: testJob.id
        });

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.success, true);
      assert.ok(res.body.data.id);
      assert.ok(Array.isArray(res.body.data.items));
      assert.ok(res.body.data.items.length > 0);

      createdPlanId = res.body.data.id;
      createdItemId = res.body.data.items[0].id;

      // Plan should prioritize missing skill Kubernetes or Go
      const hasPrioritizedMissingSkill = res.body.data.items.some(
        (item: any) => item.skillName.toLowerCase() === 'kubernetes' || item.skillName.toLowerCase() === 'go'
      );
      assert.ok(hasPrioritizedMissingSkill, 'Plan must prioritize unverified skill gap');

      // Verify Resource URL integrity: must only use verified official/reputable URLs
      for (const item of res.body.data.items) {
        if (item.resourceUrls && item.resourceUrls.length > 0) {
          for (const url of item.resourceUrls) {
            assert.match(url, /^https:\/\//, 'Resource URLs must be secure HTTPS');
            assert.doesNotMatch(url, /fake-course|invented-academy/i, 'Must not fabricate URLs');
          }
        }
      }
    });

    it('GET /api/v1/career/learning-plan retrieves candidate plans', async () => {
      const res = await request(app)
        .get('/api/v1/career/learning-plan')
        .set('Authorization', `Bearer ${tokenA}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(Array.isArray(res.body.data));
      assert.ok(res.body.data.some((p: any) => p.id === createdPlanId));
    });

    it('PATCH /api/v1/career/learning-plan/items/:id updates item progress and creates learning progress record', async () => {
      const res = await request(app)
        .patch(`/api/v1/career/learning-plan/items/${createdItemId}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          status: 'IN_PROGRESS',
          loggedHours: 3.5,
          notes: 'Completed official Kubernetes core concepts overview.'
        });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.status, 'IN_PROGRESS');

      // Verify item has progress record attached
      assert.ok(res.body.data.progressRecords.length > 0);
      assert.strictEqual(res.body.data.progressRecords[0].hoursSpent, 3.5);
    });

    it('IDOR Check: Candidate B cannot update Candidate A learning plan item (403/404 safe)', async () => {
      const res = await request(app)
        .patch(`/api/v1/career/learning-plan/items/${createdItemId}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({
          status: 'COMPLETED'
        });

      assert.strictEqual(res.status, 403);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.error.code, 'FORBIDDEN');
    });
  });
});
