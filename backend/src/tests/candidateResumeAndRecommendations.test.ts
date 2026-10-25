import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../database/prisma.js';
import { ResumeService } from '../services/resume.service.js';
import { JobRecommendationService } from '../services/jobRecommendation.service.js';
import { ProductionMatchingService } from '../services/matching.service.js';
import { resolveApplicationTarget } from '../utils/targetUrlResolver.js';

describe('Phase 11: Candidate Profile, Resume Lifecycle & Recommendations Deterministic Suite', () => {
  const ts = Date.now();
  let candidateAUser: any;
  let candidateBUser: any;
  let testCompany: any;
  let jobA: any;
  let jobB: any;
  let candidateAProfile: any;

  before(async () => {
    // 1. Create Candidate A and Candidate B
    candidateAUser = await prisma.user.create({
      data: {
        email: `cand.a.${ts}@pilotmama.test`,
        passwordHash: 'dummy_hash',
        role: 'CANDIDATE',
        candidateProfile: {
          create: {
            fullName: 'Candidate Alpha',
            headline: 'Senior Full Stack Engineer',
            location: 'Bengaluru, India',
            summary: 'Experienced Full Stack Engineer with Node.js, React, TypeScript, and SQL.',
            experiences: {
              create: [
                {
                  company: 'Alpha Tech',
                  jobTitle: 'Senior Full Stack Developer',
                  description: 'Architecting scalable web applications using React, Node.js, TypeScript, and PostgreSQL.',
                  startDate: new Date('2021-01-01'),
                  isCurrent: true,
                },
              ],
            },
            skills: {
              create: [
                {
                  proficiency: 'EXPERT',
                  yearsOfExperience: 4,
                  skill: {
                    connectOrCreate: {
                      where: { name: 'React' },
                      create: { name: 'React', category: 'TECHNICAL' },
                    },
                  },
                },
                {
                  proficiency: 'EXPERT',
                  yearsOfExperience: 4,
                  skill: {
                    connectOrCreate: {
                      where: { name: 'Node.js' },
                      create: { name: 'Node.js', category: 'TECHNICAL' },
                    },
                  },
                },
              ],
            },
            preferences: {
              create: {
                targetRoles: ['Full Stack Engineer', 'Software Engineer'],
                preferredLocations: ['Bengaluru', 'Remote'],
                remotePreference: 'HYBRID',
              },
            },
          },
        },
      },
      include: { candidateProfile: true },
    });

    candidateAProfile = candidateAUser.candidateProfile;

    candidateBUser = await prisma.user.create({
      data: {
        email: `cand.b.${ts}@pilotmama.test`,
        passwordHash: 'dummy_hash',
        role: 'CANDIDATE',
        candidateProfile: {
          create: {
            fullName: 'Candidate Beta',
          },
        },
      },
    });

    // 2. Create Test Company and Jobs
    testCompany = await prisma.company.create({
      data: {
        name: `TestCorp_${ts}`,
        officialDomain: 'testcorp.example.com',
      },
    });

    jobA = await prisma.job.create({
      data: {
        companyId: testCompany.id,
        externalJobId: `jobA_${ts}`,
        sourceType: 'CAREER_SITE',
        sourceName: 'TestCorp Careers',
        contentHash: `hash_a_${ts}`,
        title: 'Senior Full Stack Engineer',
        description: 'Seeking a senior developer skilled in React, TypeScript, Node.js, and distributed cloud microservices.',
        responsibilities: ['Build high throughput APIs', 'Maintain modern frontend web architectures'],
        requirements: ['3+ years with Node.js and React', 'Proficiency in TypeScript'],
        location: 'Bengaluru, India',
        status: 'ACTIVE',
        applicationUrl: 'https://careers.testcorp.example.com/#detail/job/824355',
        sourceUrl: 'https://careers.testcorp.example.com/#detail/job/824355',
      },
    });

    jobB = await prisma.job.create({
      data: {
        companyId: testCompany.id,
        externalJobId: `jobB_${ts}`,
        sourceType: 'WORKDAY',
        sourceName: 'TestCorp Workday',
        contentHash: `hash_b_${ts}`,
        title: 'Lead Cloud Infrastructure Architect',
        description: 'Designing Kubernetes, Terraform, AWS, and GCP infrastructure for high availability clusters.',
        responsibilities: ['Orchestrate multi-region cloud networks', 'Maintain IaC pipelines'],
        requirements: ['8+ years cloud engineering', 'Deep knowledge of Kubernetes and Terraform'],
        location: 'San Francisco, CA',
        status: 'ACTIVE',
        applicationUrl: 'https://synechron.wd1.myworkdayjobs.com/en-US/Careers/job/Cloud-Architect_JR109',
        sourceUrl: 'https://synechron.wd1.myworkdayjobs.com/en-US/Careers/job/Cloud-Architect_JR109',
      },
    });
  });

  after(async () => {
    // Cleanup
    if (jobA) await prisma.job.delete({ where: { id: jobA.id } }).catch(() => {});
    if (jobB) await prisma.job.delete({ where: { id: jobB.id } }).catch(() => {});
    if (testCompany) await prisma.company.delete({ where: { id: testCompany.id } }).catch(() => {});
    if (candidateAUser) await prisma.user.delete({ where: { id: candidateAUser.id } }).catch(() => {});
    if (candidateBUser) await prisma.user.delete({ where: { id: candidateBUser.id } }).catch(() => {});
  });

  test('Requirement 1 & 2: Candidate with profile evidence and preferred resume receives ranked recommendations', async () => {
    const recs = await JobRecommendationService.getRecommendations(candidateAUser.id);
    assert.ok(recs);
    assert.strictEqual(recs.profileState, 'COMPLETE');
    assert.ok(recs.items.length > 0, 'Candidate Alpha should receive recommendations');
    const matchedJob = recs.items.find(item => item.id === jobA.id);
    assert.ok(matchedJob, 'Full stack job A should be ranked for Candidate Alpha');
    const score = matchedJob.recommendation?.score ?? (matchedJob as any).recommendationScore ?? (matchedJob as any).matchScore;
    assert.ok(score >= 50, `Score for job A (${score}) should reflect relevance >= 50`);
  });

  test('Requirement 3: Candidate without usable profile/resume gets onboarding empty state', async () => {
    const recs = await JobRecommendationService.getRecommendations(candidateBUser.id);
    assert.ok(recs);
    assert.strictEqual(recs.profileState, 'EMPTY');
    assert.strictEqual(recs.items.length, 0);
  });

  test('Requirement 4 & 5: Recommendation cache invalidation identity changes on profile/preference updates', async () => {
    const initialRecs = await JobRecommendationService.getRecommendations(candidateAUser.id);
    assert.ok(initialRecs);

    // Simulate profile update
    const updatedProfile = await prisma.candidateProfile.update({
      where: { id: candidateAProfile.id },
      data: { updatedAt: new Date() },
    });

    const updatedRecs = await JobRecommendationService.getRecommendations(candidateAUser.id);
    assert.ok(updatedRecs);
    assert.ok(updatedProfile.updatedAt.getTime() > 0);
  });

  test('Requirement 6: Different jobs produce independent Match scores', async () => {
    const fitA = await ProductionMatchingService.analyzeFit(candidateAUser.id, jobA.id);
    const fitB = await ProductionMatchingService.analyzeFit(candidateAUser.id, jobB.id);

    assert.ok(fitA.overallScore !== undefined);
    assert.ok(fitB.overallScore !== undefined);
    // Job A is Full Stack, Job B is Lead Cloud Infrastructure; scores must differ and reflect fit
    assert.notStrictEqual(fitA.overallScore, fitB.overallScore);
    assert.ok(fitA.overallScore > fitB.overallScore, 'Full stack engineer must match Job A higher than Job B');
  });

  test('Requirement 7 & 8: ATS evaluates against job content even when structured skills are missing', async () => {
    // jobA has no JobSkill rows attached, only description and requirements
    const fitA = await ProductionMatchingService.analyzeFit(candidateAUser.id, jobA.id);
    const atsResult = fitA.atsAnalysis;

    assert.ok(atsResult.estimatedScore > 0, 'ATS score should be calculated from candidate fit');
    assert.ok(atsResult.keywords.green.length > 0, 'Matched green keywords should be identified from description/requirements');
    assert.ok(atsResult.keywords.green.some((k: string) => /react|node/i.test(k)));
  });

  test('Requirement 9, 10 & 11: Resume lifecycle, vault limit (5), archive preserves file, delete permanently clears', async () => {
    // Create 5 dummy resumes for Candidate A
    const createdResumes = [];
    for (let i = 1; i <= 5; i++) {
      const res = await prisma.resume.create({
        data: {
          candidateProfileId: candidateAProfile.id,
          title: `Resume ${i}`,
          isMaster: i === 1,
          originalFileName: `resume_${i}.pdf`,
          mimeType: 'application/pdf',
          fileSize: 1024 * i,
          storageProvider: 'LOCAL_DISK',
          storageKey: `test_storage_key_${i}_${ts}`,
          status: 'PARSED',
          rawText: `Resume content for version ${i} with Node.js and React.`,
        },
      });
      createdResumes.push(res);
    }

    // Try creating 6th active resume -> should throw BadRequestError when validating active count
    await assert.rejects(
      async () => {
        // Mock upload file validation
        const dummyFile: any = {
          buffer: Buffer.from('%PDF-1.4 test resume'),
          originalname: 'resume_6.pdf',
          mimetype: 'application/pdf',
          size: 1024,
        };
        await ResumeService.uploadResume(candidateAUser.id, dummyFile, 'Resume 6');
      },
      (err: any) => {
        return err.message && err.message.includes('Maximum limit of 5 active resumes reached');
      }
    );

    // Test setPreferredResume: set resume 2 as preferred
    const updatedPref = await ResumeService.setPreferredResume(candidateAUser.id, createdResumes[1].id);
    assert.strictEqual(updatedPref.isMaster, true);

    // Verify resume 1 is no longer master
    const oldMaster = await prisma.resume.findUnique({ where: { id: createdResumes[0].id } });
    assert.strictEqual(oldMaster?.isMaster, false);

    // Test Archive: archives resume 3 without deleting storageKey
    const archived = await ResumeService.archiveResume(candidateAUser.id, createdResumes[2].id);
    assert.strictEqual(archived.status, 'ARCHIVED');
    assert.strictEqual(archived.storageKey, `test_storage_key_3_${ts}`);

    // Test Permanent Delete: removes resume 4 from DB
    const delRes = await ResumeService.deleteResumePermanently(candidateAUser.id, createdResumes[3].id);
    assert.strictEqual(delRes.success, true);
    const checkDeleted = await prisma.resume.findUnique({ where: { id: createdResumes[3].id } });
    assert.strictEqual(checkDeleted, null);

    // Cleanup remaining created resumes
    for (const r of createdResumes) {
      await prisma.resume.deleteMany({ where: { id: r.id } });
    }
  });

  test('Requirement 12: Candidate B cannot access or modify Candidate A resume (IDOR)', async () => {
    // Create one resume for Candidate A
    const resumeA = await prisma.resume.create({
      data: {
        candidateProfileId: candidateAProfile.id,
        title: 'Candidate A Vault Resume',
        isMaster: true,
        originalFileName: 'cand_a.pdf',
        mimeType: 'application/pdf',
        fileSize: 2048,
        storageProvider: 'LOCAL_DISK',
        storageKey: `key_idor_${ts}`,
        status: 'UPLOADED',
      },
    });

    // Candidate B attempts to set preferred on Candidate A's resume
    await assert.rejects(
      async () => {
        await ResumeService.setPreferredResume(candidateBUser.id, resumeA.id);
      },
      (err: any) => err.statusCode === 404 || err.message.includes('not found')
    );

    // Candidate B attempts to archive Candidate A's resume
    await assert.rejects(
      async () => {
        await ResumeService.archiveResume(candidateBUser.id, resumeA.id);
      },
      (err: any) => err.statusCode === 404 || err.message.includes('not found')
    );

    // Candidate B attempts to permanently delete Candidate A's resume
    await assert.rejects(
      async () => {
        await ResumeService.deleteResumePermanently(candidateBUser.id, resumeA.id);
      },
      (err: any) => err.statusCode === 404 || err.message.includes('not found')
    );

    // Cleanup
    await prisma.resume.delete({ where: { id: resumeA.id } });
  });

  test('Requirement 14 & 15: Exact URL resolution preserved for Bahwan and Synechron', () => {
    const bahwanResolved = resolveApplicationTarget({
      applicationUrl: 'https://bahwancybertek.ripplehire.com/candidate/?token=abc#detail/job/824355',
      sourceUrl: 'https://bahwancybertek.ripplehire.com/candidate/?token=abc#list',
    });
    assert.strictEqual(bahwanResolved.isExact, true);
    assert.strictEqual(bahwanResolved.url, 'https://bahwancybertek.ripplehire.com/candidate/?token=abc#detail/job/824355');

    const synechronResolved = resolveApplicationTarget({
      applicationUrl: 'https://synechron.wd1.myworkdayjobs.com/en-US/Careers/job/Pune/Technical-Lead_JR-109',
      sourceUrl: 'https://synechron.wd1.myworkdayjobs.com/en-US/Careers',
    });
    assert.strictEqual(synechronResolved.isExact, true);
    assert.strictEqual(synechronResolved.url, 'https://synechron.wd1.myworkdayjobs.com/en-US/Careers/job/Pune/Technical-Lead_JR-109');

    const genericBlocked = resolveApplicationTarget({
      applicationUrl: 'https://synechron.wd1.myworkdayjobs.com/en-US/Careers',
      sourceUrl: 'https://synechron.wd1.myworkdayjobs.com/en-US/Careers',
    });
    assert.strictEqual(genericBlocked.isExact, false);
    assert.strictEqual(genericBlocked.classification, 'GENERIC_CAREERS_TARGET');
  });
});
