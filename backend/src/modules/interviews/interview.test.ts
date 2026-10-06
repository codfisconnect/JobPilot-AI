import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { app } from '../../server.js';
import { prisma } from '../../database/prisma.js';
import { signAccessToken } from '../../utils/jwt.js';
import { UserRole } from '@prisma/client';
import { InterviewService } from './interview.service.js';

describe('Sprint 6: Interview Intelligence Backend Test Suite', () => {
  let userA: any;
  let userB: any;
  let tokenA: string;
  let tokenB: string;
  let testJob: any;
  let testCompany: any;
  let testResumeVersion: any;

  before(async () => {
    // Clean up test users
    await prisma.user.deleteMany({
      where: { email: { in: ['cand.interview.a@pilotmama.com', 'cand.interview.b@pilotmama.com'] } }
    });
    await prisma.company.deleteMany({
      where: { name: 'Interview Test Cloud Corp' }
    });

    // 1. Create Candidate A with verified skills (Java, Selenium)
    userA = await prisma.user.create({
      data: {
        email: 'cand.interview.a@pilotmama.com',
        passwordHash: '$argon2id$mockhashforSprint6',
        role: UserRole.CANDIDATE,
        candidateProfile: {
          create: {
            fullName: 'Aarav Patel',
            headline: 'Senior Automation Engineer',
            location: 'Austin, TX',
            experiences: {
              create: [
                {
                  company: 'QualityTech Solutions',
                  jobTitle: 'Senior SDET',
                  startDate: new Date('2021-01-01'),
                  isCurrent: true,
                  responsibilities: ['Engineered Java test framework with Selenium WebDriver.'],
                  technologies: ['Java', 'Selenium', 'TestNG']
                }
              ]
            },
            skills: {
              create: [
                {
                  skill: {
                    connectOrCreate: {
                      where: { name: 'Java' },
                      create: { name: 'Java', category: 'TECHNICAL' }
                    }
                  },
                  proficiency: 'Expert',
                  yearsOfExperience: 5
                },
                {
                  skill: {
                    connectOrCreate: {
                      where: { name: 'Selenium' },
                      create: { name: 'Selenium', category: 'TECHNICAL' }
                    }
                  },
                  proficiency: 'Advanced',
                  yearsOfExperience: 4
                }
              ]
            },
            resumes: {
              create: {
                title: 'Master Automation Resume',
                isMaster: true,
                status: 'PARSED',
                versions: {
                  create: {
                    versionName: 'QualityTech_SDET_v1',
                    versionNumber: 1,
                    structuredContent: {
                      skills: ['Java', 'Selenium', 'TestNG']
                    }
                  }
                }
              }
            }
          }
        }
      },
      include: {
        candidateProfile: {
          include: { resumes: { include: { versions: true } } }
        }
      }
    });

    tokenA = signAccessToken({
      userId: userA.id,
      email: userA.email,
      role: userA.role
    });

    const resumeRecord = userA.candidateProfile.resumes[0];
    testResumeVersion = resumeRecord.versions[0];

    // 2. Create Candidate B (for cross-candidate IDOR checks)
    userB = await prisma.user.create({
      data: {
        email: 'cand.interview.b@pilotmama.com',
        passwordHash: '$argon2id$mockhashforSprint6',
        role: UserRole.CANDIDATE,
        candidateProfile: {
          create: {
            fullName: 'Elena Rostova',
            headline: 'Product Designer',
            location: 'New York, NY'
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

    // 3. Create Target Job requiring Java and Playwright
    testCompany = await prisma.company.create({
      data: {
        name: 'Interview Test Cloud Corp'
      }
    });

    testJob = await prisma.job.create({
      data: {
        companyId: testCompany.id,
        title: 'Lead QA Automation Specialist',
        description: 'Build enterprise E2E test suites with Java, Playwright, and CI/CD pipelines.',
        requirements: ['Java', 'Playwright', 'CI/CD'],
        responsibilities: ['Own automated test architecture', 'Collaborate with backend teams'],
        sourceType: 'DIRECT',
        sourceName: 'Career Board',
        sourceUrl: 'https://cloudcorp.test/careers/lead-qa',
        contentHash: 'hash-sprint6-interview-001'
      }
    });
  });

  after(async () => {
    await prisma.user.deleteMany({
      where: { email: { in: ['cand.interview.a@pilotmama.com', 'cand.interview.b@pilotmama.com'] } }
    });
    await prisma.company.deleteMany({
      where: { name: 'Interview Test Cloud Corp' }
    });
  });

  describe('1. Interview Session Creation & Question Grounding', () => {
    let createdSessionId: string;

    it('POST /api/v1/jobs/:id/interview/sessions creates session with grounded questions', async () => {
      const res = await request(app)
        .post(`/api/v1/jobs/${testJob.id}/interview/sessions`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ resumeVersionId: testResumeVersion.id });

      if (res.status !== 201) {
        console.error('FAILED POST SESSIONS:', res.status, res.body);
      }
      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.success, true);
      assert.ok(res.body.data.id);
      assert.strictEqual(res.body.data.jobId, testJob.id);
      assert.ok(res.body.data.questions.length >= 3);

      createdSessionId = res.body.data.id;

      // Question grounding verification
      const questions = res.body.data.questions;
      console.log('DEBUG GENERATED QUESTIONS:', JSON.stringify(questions, null, 2));
      // Should feature verified skill Java
      const mentionsJava = questions.some((q: any) =>
        q.question.toLowerCase().includes('java') || q.sourceSkill?.toLowerCase().includes('java')
      );
      assert.ok(mentionsJava, 'Session questions should be grounded in verified candidate skill Java');

      // Should explore missing or partial skill gaps (e.g. Playwright, CI/CD) without claiming candidate already led 50-person migration
      const mentionsSkillGap = questions.some((q: any) =>
        q.type === 'SKILL_GAP' ||
        q.question.toLowerCase().includes('playwright') ||
        q.sourceSkill?.toLowerCase().includes('playwright') ||
        q.question.toLowerCase().includes('ci/cd') ||
        q.sourceSkill?.toLowerCase().includes('ci/cd')
      );
      assert.ok(mentionsSkillGap, 'Session questions should address identified skill gap');
    });

    it('GET /api/v1/interview/sessions lists candidate sessions', async () => {
      const res = await request(app)
        .get('/api/v1/interview/sessions')
        .set('Authorization', `Bearer ${tokenA}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(Array.isArray(res.body.data));
      assert.ok(res.body.data.some((s: any) => s.id === createdSessionId));
    });

    it('GET /api/v1/interview/sessions/:id retrieves session with full details', async () => {
      const res = await request(app)
        .get(`/api/v1/interview/sessions/${createdSessionId}`)
        .set('Authorization', `Bearer ${tokenA}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.id, createdSessionId);
      assert.ok(res.body.data.questions.length > 0);
    });

    it('IDOR Check: Cross-candidate interview session access is strictly denied (403)', async () => {
      const res = await request(app)
        .get(`/api/v1/interview/sessions/${createdSessionId}`)
        .set('Authorization', `Bearer ${tokenB}`);

      assert.strictEqual(res.status, 403);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.error.code, 'FORBIDDEN');
    });
  });

  describe('2. Truthful Grounding & Anti-Fabrication Rule', () => {
    it('Never invents fabricated experience in interview questions', async () => {
      const profileA = userA.candidateProfile;
      const questions = await InterviewService.generateQuestionsForSession(
        profileA.id,
        (await prisma.interviewPreparationSession.findFirst({ where: { candidateProfileId: profileA.id } }))!.id,
        { count: 5 }
      );

      // Verify that none of the questions fabricate unverified facts
      for (const q of questions) {
        assert.doesNotMatch(q.question, /50-person migration/i, 'Must not hallucinate 50-person migration');
        assert.doesNotMatch(q.question, /Google Cloud Platform/i, 'Must not hallucinate unverified cloud providers');
      }
    });

    it('Rejects unauthorized resume version during session creation', async () => {
      // Create a foreign resume for Candidate B
      const fakeResume = await prisma.resume.create({
        data: {
          candidateProfileId: userB.candidateProfile.id,
          title: 'Elena Foreign Resume',
          versions: {
            create: {
              versionName: 'Foreign_v1',
              structuredContent: {}
            }
          }
        },
        include: { versions: true }
      });

      const foreignVersionId = fakeResume.versions[0].id;

      const res = await request(app)
        .post(`/api/v1/jobs/${testJob.id}/interview/sessions`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ resumeVersionId: foreignVersionId });

      assert.strictEqual(res.status, 403);
      assert.strictEqual(res.body.success, false);
    });
  });

  describe('3. Answer Submission & Truthful Evaluation', () => {
    let testQuestionId: string;
    let submittedAnswerId: string;

    before(async () => {
      const session = await prisma.interviewPreparationSession.findFirst({
        where: { candidateProfileId: userA.candidateProfile.id },
        include: { questions: true }
      });
      testQuestionId = session!.questions[0].id;
    });

    it('POST /api/v1/interview/questions/:id/answer submits answer safely', async () => {
      const res = await request(app)
        .post(`/api/v1/interview/questions/${testQuestionId}/answer`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          answerText: 'At QualityTech Solutions, I structured the test framework using Java and Page Object Model, isolating locators to reduce maintenance costs by 35%.'
        });

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.success, true);
      assert.ok(res.body.data.id);
      assert.strictEqual(res.body.data.questionId, testQuestionId);
      submittedAnswerId = res.body.data.id;
    });

    it('POST /api/v1/interview/questions/:id/evaluate evaluates answer objectively', async () => {
      const res = await request(app)
        .post(`/api/v1/interview/questions/${testQuestionId}/evaluate`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ answerId: submittedAnswerId });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(res.body.data.clarityScore >= 0 && res.body.data.clarityScore <= 100);
      assert.ok(res.body.data.overallScore >= 0 && res.body.data.overallScore <= 100);
      assert.ok(Array.isArray(res.body.data.strengths));
      assert.ok(Array.isArray(res.body.data.suggestions));
      assert.ok(res.body.data.feedback.length > 5);
    });

    it('IDOR Check: Candidate B cannot evaluate Candidate A answer', async () => {
      const res = await request(app)
        .post(`/api/v1/interview/questions/${testQuestionId}/evaluate`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ answerId: submittedAnswerId });

      assert.strictEqual(res.status, 403);
      assert.strictEqual(res.body.success, false);
    });
  });
});
