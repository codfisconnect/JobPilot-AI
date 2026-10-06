import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { app } from '../server.js';
import { prisma } from '../database/prisma.js';
import { signAccessToken } from '../utils/jwt.js';
import { UserRole } from '@prisma/client';
import { ProductionMatchingService } from '../services/matching.service.js';
import { ResumeTailorService } from '../generators/resume.generator.js';

describe('Sprint 4 Production Job Matching, Skill Gap & AI Tailoring Suite', () => {
  let candidateUser: any;
  let candidateToken: string;
  let testCompany: any;
  let testJob: any;

  before(async () => {
    // Clean up test remnants
    await prisma.user.deleteMany({
      where: { email: 'cand.sprint4@pilotmama.com' }
    });
    await prisma.company.deleteMany({
      where: { name: 'Acme Cloud Engineering' }
    });

    // 1. Create Verified Candidate Profile
    candidateUser = await prisma.user.create({
      data: {
        email: 'cand.sprint4@pilotmama.com',
        passwordHash: '$argon2id$mockhashforSprint4',
        role: UserRole.CANDIDATE,
        candidateProfile: {
          create: {
            fullName: 'Devon Vance',
            headline: 'Senior QA Automation Engineer',
            location: 'San Francisco, CA',
            country: 'USA',
            city: 'San Francisco',
            summary: 'Experienced QA Automation Specialist specializing in Java and Selenium framework architecture.',
            experiences: {
              create: [
                {
                  company: 'Legacy Tech Corp',
                  jobTitle: 'Senior QA Engineer',
                  location: 'San Francisco, CA',
                  startDate: new Date('2021-01-01'),
                  isCurrent: true,
                  responsibilities: ['Architected test automation frameworks in Java and Selenium.'],
                  achievements: ['Decreased test cycle time by 40%.'],
                  technologies: ['Java', 'Selenium', 'JUnit', 'Jenkins']
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
                  proficiency: 'Expert',
                  yearsOfExperience: 4
                },
                {
                  skill: {
                    connectOrCreate: {
                      where: { name: 'SQL' },
                      create: { name: 'SQL', category: 'TECHNICAL' }
                    }
                  },
                  proficiency: 'Intermediate',
                  yearsOfExperience: 3
                }
              ]
            }
          }
        }
      },
      include: { candidateProfile: { include: { skills: { include: { skill: true } }, experiences: true } } }
    });

    candidateToken = signAccessToken({
      userId: candidateUser.id,
      email: candidateUser.email,
      role: UserRole.CANDIDATE
    });

    // 2. Create Canonical Company and Job
    testCompany = await prisma.company.create({
      data: {
        name: 'Acme Cloud Engineering',
        officialDomain: 'acmecloud.example.com',
        country: 'USA',
        sourceType: 'DIRECT'
      }
    });

    testJob = await prisma.job.create({
      data: {
        companyId: testCompany.id,
        title: 'Lead QA Automation Engineer',
        description: 'Lead automated testing suites across distributed microservices.',
        requirements: ['Java', 'Selenium', 'Playwright', 'Jenkins', 'SQL'],
        preferredQualifications: ['Docker', 'AWS'],
        location: 'San Francisco, CA',
        remoteType: 'HYBRID',
        employmentType: 'FULL_TIME',
        experienceMin: 4,
        sourceType: 'DIRECT',
        sourceName: 'Acme Direct',
        sourceUrl: 'https://acmecloud.example.com/careers/lead-qa',
        contentHash: 'hash-sprint4-job-001',
        skills: {
          create: [
            {
              skill: {
                connectOrCreate: {
                  where: { name: 'Java' },
                  create: { name: 'Java', category: 'TECHNICAL' }
                }
              },
              skillType: 'REQUIRED'
            },
            {
              skill: {
                connectOrCreate: {
                  where: { name: 'Selenium' },
                  create: { name: 'Selenium', category: 'TECHNICAL' }
                }
              },
              skillType: 'REQUIRED'
            },
            {
              skill: {
                connectOrCreate: {
                  where: { name: 'Playwright' },
                  create: { name: 'Playwright', category: 'TECHNICAL' }
                }
              },
              skillType: 'REQUIRED'
            }
          ]
        }
      }
    });
  });

  after(async () => {
    await prisma.user.deleteMany({
      where: { email: 'cand.sprint4@pilotmama.com' }
    });
    await prisma.company.deleteMany({
      where: { name: 'Acme Cloud Engineering' }
    });
  });

  describe('1. Deterministic Evidence Mapping & Truth Checks', () => {
    it('should classify verified skills as GREEN and missing as RED/PARTIAL without fabrication', () => {
      const candidateSkills = ['Java', 'Selenium', 'SQL'];
      const required = ['Java', 'Selenium', 'Playwright'];
      const preferred = ['Docker'];

      const result = ProductionMatchingService.evaluateSkillEvidence(candidateSkills, required, preferred);

      // Candidate has Java, Selenium, SQL; Job asks for Java, Selenium, Playwright; Docker
      // Playwright is related to Selenium, so it is classified as PARTIAL (YELLOW)
      assert.strictEqual(result.greenCount, 2, 'Java and Selenium must be verified GREEN');
      assert.strictEqual(result.yellowCount, 1, 'Playwright maps adjacent to Selenium (PARTIAL/YELLOW)');
      assert.strictEqual(result.redCount, 1, 'Docker must be missing RED');

      const playwrightItem = result.items.find(i => i.skill === 'Playwright');
      assert(playwrightItem, 'Playwright item exists');
      assert.strictEqual(playwrightItem?.status, 'PARTIAL');
    });

    it('should identify transferable adjacent ecosystem knowledge', () => {
      // Candidate knows JUnit; job requires TestNG
      const candidateSkills = ['Java', 'JUnit'];
      const required = ['Java', 'TestNG'];

      const result = ProductionMatchingService.evaluateSkillEvidence(candidateSkills, required, []);
      const testngItem = result.items.find(i => i.skill === 'TestNG');
      assert.strictEqual(testngItem?.status, 'PARTIAL', 'TestNG recognized as adjacent to JUnit');
      assert.strictEqual(testngItem?.priority, 'MEDIUM');
    });
  });

  describe('2. Deterministic Career Track Alignment', () => {
    it('should confirm same track alignment for aligned engineering roles', () => {
      const fit = ProductionMatchingService.detectCareerTrack('Senior QA Engineer', 'Lead QA Automation Engineer');
      assert.strictEqual(fit.isSameTrack, true);
      assert.strictEqual(fit.transitionPossible, true);
    });

    it('should flag cross-domain transitions with transparent explanation', () => {
      const fit = ProductionMatchingService.detectCareerTrack('QA Automation Engineer', 'Senior Data Analyst');
      assert.strictEqual(fit.isSameTrack, false);
      assert.strictEqual(fit.transitionPossible, false);
      assert(fit.transitionGapExplanation?.includes('Cross-domain'), 'Explains cross-domain gap');
    });
  });

  describe('3. Production Job Fit API & Persistence', () => {
    it('GET /api/v1/jobs/:id/match should calculate and cache match score in PostgreSQL', async () => {
      const res = await request(app)
        .get(`/api/v1/jobs/${testJob.id}/match`)
        .set('Authorization', `Bearer ${candidateToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert(res.body.data.overallScore >= 70, 'Overall score should reflect strong QA alignment');
      assert(res.body.data.breakdown.skillScore > 0);
      assert(res.body.data.breakdown.experienceScore > 0);
      assert(res.body.data.breakdown.roleScore >= 90);
      assert.strictEqual(res.body.data.isCached, false, 'First run is computed fresh');

      // Second request must hit PostgreSQL cache
      const cachedRes = await request(app)
        .get(`/api/v1/jobs/${testJob.id}/match`)
        .set('Authorization', `Bearer ${candidateToken}`);

      assert.strictEqual(cachedRes.status, 200);
      assert.strictEqual(cachedRes.body.data.isCached, true, 'Subsequent request is retrieved from cache');
    });

    it('POST /api/v1/jobs/:id/match/recalculate should force refresh cached match', async () => {
      const res = await request(app)
        .post(`/api/v1/jobs/${testJob.id}/match/recalculate`)
        .set('Authorization', `Bearer ${candidateToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.isCached, false, 'Forced recalculation refreshes cache');
    });
  });

  describe('4. Deterministic Skill Gap API & Prioritization', () => {
    it('GET /api/v1/jobs/:id/skill-gap should return prioritized gaps with learning resources', async () => {
      const res = await request(app)
        .get(`/api/v1/jobs/${testJob.id}/skill-gap`)
        .set('Authorization', `Bearer ${candidateToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert(res.body.data.gaps.length > 0, 'Found skill gaps');

      const playwrightGap = res.body.data.gaps.find((g: any) => g.skill === 'Playwright');
      assert(playwrightGap, 'Playwright identified as gap with learning resources');
      assert(playwrightGap.learningResources.length > 0, 'Playwright has attached learning resources');
    });
  });

  describe('5. Target Company Leakage Guard & Anti-Fabrication', () => {
    it('should detect and reject target company name leaking into summary or skills', () => {
      const leakingResume = {
        tailoredSummary: 'Senior QA specialist eager to lead test automation at Acme Cloud Engineering.',
        orderedSkills: ['Java', 'Selenium', 'Acme Cloud Engineering'],
        experiences: []
      };

      const check = ResumeTailorService.checkTargetCompanyLeak(
        'Acme Cloud Engineering',
        leakingResume as any,
        ['Legacy Tech Corp']
      );

      assert.strictEqual(check.leaked, true, 'Must detect leakage in summary');
      assert.strictEqual(check.leakSection, 'Professional Summary');
    });

    it('should permit historical employer names when candidate actually worked there', () => {
      const legitimateResume = {
        tailoredSummary: 'Senior QA engineer with 5 years experience.',
        orderedSkills: ['Java', 'Selenium'],
        experiences: [{ company: 'Legacy Tech Corp', responsibilities: ['Automated tests'] }]
      };

      const check = ResumeTailorService.checkTargetCompanyLeak(
        'Legacy Tech Corp',
        legitimateResume as any,
        ['Legacy Tech Corp'] // Genuine past employer
      );

      assert.strictEqual(check.leaked, false, 'Historical employers do not trigger false leakage');
    });
  });

  describe('6. Production Resume Tailoring & Versioning Pipeline', () => {
    it('POST /api/v1/jobs/:id/tailor-resume should create immutable ResumeVersion with clean audit', async () => {
      const res = await request(app)
        .post(`/api/v1/jobs/${testJob.id}/tailor-resume`)
        .set('Authorization', `Bearer ${candidateToken}`)
        .send({ mode: 'TARGETED' });

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.success, true);
      assert(res.body.data.versionId, 'Returns created version ID');
      assert.strictEqual(res.body.data.truthCheckVerified, true, 'Certified truth check verified');
      assert(res.body.data.versionName.startsWith('AcmeCloudEngineering_LeadQA'), `versionName format matches: ${res.body.data.versionName}`);

      // Check DB persistence in resume_versions
      const versionInDb = await prisma.resumeVersion.findUnique({
        where: { id: res.body.data.versionId }
      });
      assert(versionInDb, 'Version persisted in PostgreSQL');
      assert.strictEqual(versionInDb?.jobId, testJob.id);
    });

    it('GET /api/v1/jobs/:id/tailored-resumes should list versions created for job', async () => {
      const res = await request(app)
        .get(`/api/v1/jobs/${testJob.id}/tailored-resumes`)
        .set('Authorization', `Bearer ${candidateToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert(res.body.data.length >= 1, 'Found tailored version for job');
    });

    it('should maintain immutable ResumeVersion snapshot when candidate profile is subsequently edited', async () => {
      // 1. Fetch current tailored version
      const versionsBefore = await request(app)
        .get(`/api/v1/jobs/${testJob.id}/tailored-resumes`)
        .set('Authorization', `Bearer ${candidateToken}`);
      const originalVersion = versionsBefore.body.data[0];

      // 2. Modify candidate profile
      await prisma.candidateProfile.update({
        where: { id: candidateUser.candidateProfile.id },
        data: {
          fullName: 'Devon Vance Updated Name',
          headline: 'VP of Engineering'
        }
      });

      // 3. Verify original ResumeVersion snapshot is completely untouched
      const fetchedVersion = await prisma.resumeVersion.findUnique({
        where: { id: originalVersion.id }
      });
      assert.strictEqual(fetchedVersion?.summary, originalVersion.summary, 'Summary in version snapshot remains unchanged');
      assert.strictEqual(fetchedVersion?.versionName, originalVersion.versionName, 'Version name remains unchanged');
    });
  });

  describe('7. Adversarial Truth Protection & IDOR Isolation', () => {
    it('adversarial: tailoring targeting job requiring Playwright/AWS must NOT fabricate experience', async () => {
      // Create job strictly requiring unverified skills
      const adversarialJob = await prisma.job.create({
        data: {
          companyId: testCompany.id,
          title: 'Cloud SDET Specialist',
          description: 'Requires AWS architecture and Playwright TypeScript.',
          requirements: ['AWS', 'Playwright', 'TypeScript'],
          preferredQualifications: [],
          location: 'Remote',
          remoteType: 'REMOTE',
          employmentType: 'FULL_TIME',
          sourceType: 'DIRECT',
          sourceName: 'Acme Direct',
          sourceUrl: 'https://acmecloud.example.com/sdet',
          contentHash: 'hash-adversarial-001'
        }
      });

      const res = await request(app)
        .post(`/api/v1/jobs/${adversarialJob.id}/tailor-resume`)
        .set('Authorization', `Bearer ${candidateToken}`)
        .send({ mode: 'TARGETED' });

      assert.strictEqual(res.status, 201);
      const tailored = res.body.data.tailoredResume;

      // Candidate has Java & Selenium. Must not claim AWS, Playwright, or TypeScript as verified experiences
      for (const exp of tailored.experiences) {
        for (const resp of exp.responsibilities || []) {
          assert(!resp.toLowerCase().includes('aws architect'), 'Must not fabricate AWS architecture experience');
        }
      }

      await prisma.job.delete({ where: { id: adversarialJob.id } });
    });

    it('IDOR: Candidate B cannot view Candidate A tailored resumes', async () => {
      // Create Candidate B
      const candB = await prisma.user.create({
        data: {
          email: 'cand.b.sprint4@pilotmama.com',
          passwordHash: '$argon2id$mockhashB',
          role: UserRole.CANDIDATE,
          candidateProfile: {
            create: {
              fullName: 'Candidate B',
              headline: 'Full Stack Engineer'
            }
          }
        }
      });
      const tokenB = signAccessToken({
        userId: candB.id,
        email: candB.email,
        role: UserRole.CANDIDATE
      });

      const resB = await request(app)
        .get(`/api/v1/jobs/${testJob.id}/tailored-resumes`)
        .set('Authorization', `Bearer ${tokenB}`);

      assert.strictEqual(resB.status, 200);
      assert.strictEqual(resB.body.data.length, 0, 'Candidate B must receive empty array, not Candidate A versions');

      await prisma.user.delete({ where: { id: candB.id } });
    });
  });
});
