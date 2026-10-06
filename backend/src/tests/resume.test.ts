import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { app } from '../server.js';
import { prisma } from '../database/prisma.js';
import { signAccessToken } from '../utils/jwt.js';
import { UserRole } from '@prisma/client';
import { FileValidationService } from '../services/fileValidation.service.js';
import { ResumeParsingService } from '../services/resumeParsing.service.js';

describe('Sprint 2 Resume Upload, Parser, Review & Immutability Suite', () => {
  let userA: any;
  let userB: any;
  let tokenA: string;
  let tokenB: string;

  // Real mock PDF buffer starting with %PDF-
  const validPdfBuffer = Buffer.from(
    `%PDF-1.4
John Doe
john.doe@example.com | +1 555-0199 | San Francisco, USA
linkedin.com/in/johndoe | github.com/johndoe

Summary
High-impact software engineering leader specializing in scalable backend services and microservices architecture.

Technical Skills
Java - 6 years
Python
PostgreSQL
Docker
Kubernetes
Playwright
CI/CD

Professional Experience
Senior Software Engineer
Acme Corporation | Jan 2020 - Present
- Spearheaded migration to high-throughput cloud events architecture
- Reduced p99 latency across core API endpoints by 35%

Software Engineer
Startup Labs | Jun 2017 - Dec 2019
- Developed REST APIs and background job processors

Education
Bachelor of Science in Computer Science
University of California, Berkeley | 2017

Certifications
AWS Certified Solutions Architect
`
  );

  // Real mock DOCX buffer starting with PK\x03\x04
  const validDocxBuffer = Buffer.concat([
    Buffer.from([0x50, 0x4b, 0x03, 0x04]),
    Buffer.from('Mock DOCX binary payload representing valid word processing document')
  ]);

  // Invalid file (e.g. executable/fake image)
  const invalidExeBuffer = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03]); // MZ header

  before(async () => {
    await prisma.user.deleteMany({
      where: { email: { in: ['resume.candA@pilotmama.com', 'resume.candB@pilotmama.com'] } }
    });

    userA = await prisma.user.create({
      data: {
        email: 'resume.candA@pilotmama.com',
        passwordHash: '$argon2id$mockCandidateHashA',
        role: UserRole.CANDIDATE,
        candidateProfile: {
          create: {
            fullName: 'Initial Name',
            location: 'Default City'
          }
        }
      },
      include: { candidateProfile: true }
    });

    tokenA = signAccessToken({
      userId: userA.id,
      email: userA.email,
      role: UserRole.CANDIDATE
    });

    userB = await prisma.user.create({
      data: {
        email: 'resume.candB@pilotmama.com',
        passwordHash: '$argon2id$mockCandidateHashB',
        role: UserRole.CANDIDATE,
        candidateProfile: {
          create: {
            fullName: 'Candidate B',
            location: 'London'
          }
        }
      },
      include: { candidateProfile: true }
    });

    tokenB = signAccessToken({
      userId: userB.id,
      email: userB.email,
      role: UserRole.CANDIDATE
    });
  });

  after(async () => {
    await prisma.user.deleteMany({
      where: { email: { in: ['resume.candA@pilotmama.com', 'resume.candB@pilotmama.com'] } }
    });
  });

  describe('File Validation & Security', () => {
    it('should detect valid PDF magic numbers', () => {
      const detected = FileValidationService.validateMagicNumber(validPdfBuffer);
      assert.ok(detected);
      assert.strictEqual(detected?.mime, 'application/pdf');
      assert.strictEqual(detected?.ext, '.pdf');
    });

    it('should detect valid DOCX magic numbers', () => {
      const detected = FileValidationService.validateMagicNumber(validDocxBuffer);
      assert.ok(detected);
      assert.strictEqual(detected?.mime, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      assert.strictEqual(detected?.ext, '.docx');
    });

    it('should reject invalid or executable files based on magic numbers', () => {
      const detected = FileValidationService.validateMagicNumber(invalidExeBuffer);
      assert.strictEqual(detected, null);
    });
  });

  describe('Resume Upload & Privacy', () => {
    let uploadedResumeId: string;

    it('should upload a PDF resume and store it privately', async () => {
      const res = await request(app)
        .post('/api/v1/resumes')
        .set('Authorization', `Bearer ${tokenA}`)
        .attach('resume', validPdfBuffer, 'john_doe_cv.pdf');

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.status, 'UPLOADED');
      assert.strictEqual(res.body.data.storageProvider, 'local');
      assert.ok(res.body.data.storageKey.endsWith('.pdf'));

      uploadedResumeId = res.body.data.id;
    });

    it('should reject unsupported file upload', async () => {
      const res = await request(app)
        .post('/api/v1/resumes')
        .set('Authorization', `Bearer ${tokenA}`)
        .attach('resume', invalidExeBuffer, 'dangerous_payload.exe');

      assert.strictEqual(res.status, 400);
      assert.ok(res.body.error.message.includes('Unsupported or invalid file format'));
    });

    it('should prevent cross-candidate access to uploaded resume (Candidate B cannot view A)', async () => {
      const res = await request(app)
        .get(`/api/v1/resumes/${uploadedResumeId}`)
        .set('Authorization', `Bearer ${tokenB}`);

      assert.strictEqual(res.status, 404);
    });

    it('should allow candidate owner to retrieve uploaded resume metadata', async () => {
      const res = await request(app)
        .get(`/api/v1/resumes/${uploadedResumeId}`)
        .set('Authorization', `Bearer ${tokenA}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.id, uploadedResumeId);
    });
  });

  describe('Resume Parsing & Heading Tolerance', () => {
    it('should parse varied section headings without strict case matching', () => {
      const variedResume = `
JANE DEVELOPER
jane@company.com

CAREER OBJECTIVE
Experienced engineer driving technical transformation.

CORE COMPETENCIES
Java — 6 years
Python
Docker

EMPLOYMENT HISTORY
Senior Engineer
Acme Tech | 2021 — Present
- Led engineering initiatives

ACADEMIC BACKGROUND
Bachelor of Engineering
National Institute of Technology | 2016

LICENSES AND CERTIFICATIONS
Certified Kubernetes Administrator
`;
      const parsed = ResumeParsingService.parse(variedResume);

      assert.strictEqual(parsed.personalInfo.fullName, 'JANE DEVELOPER');
      assert.strictEqual(parsed.personalInfo.email, 'jane@company.com');
      assert.ok(parsed.summary.includes('Experienced engineer'));
      assert.strictEqual(parsed.experience.length, 1);
      assert.strictEqual(parsed.experience[0].jobTitle, 'Senior Engineer');
      assert.strictEqual(parsed.education.length, 1);
      assert.strictEqual(parsed.certifications.length, 1);

      // Verify Truth Protection: Java gets 6 years because explicitly stated, Python does not!
      const javaSkill = parsed.skills.find(s => s.name === 'Java');
      const pythonSkill = parsed.skills.find(s => s.name === 'Python');
      assert.strictEqual(javaSkill?.yearsOfExperience, 6);
      assert.strictEqual(pythonSkill?.yearsOfExperience, null);
    });
  });

  describe('Candidate Review, Confirmation & Master Resume', () => {
    let testResumeId: string;

    before(async () => {
      const res = await request(app)
        .post('/api/v1/resumes')
        .set('Authorization', `Bearer ${tokenA}`)
        .attach('resume', validPdfBuffer, 'test_review.pdf');
      testResumeId = res.body.data.id;
    });

    it('should parse uploaded resume via POST /api/v1/resumes/:id/parse', async () => {
      const res = await request(app)
        .post(`/api/v1/resumes/${testResumeId}/parse`)
        .set('Authorization', `Bearer ${tokenA}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(res.body.data.personalInfo);
    });

    it('should save candidate-confirmed data without silent overwrite', async () => {
      const confirmedData = {
        personalInfo: {
          fullName: 'John Confirmed Doe',
          headline: 'VP of Platform Engineering',
          location: 'San Francisco, CA, USA',
          city: 'San Francisco',
          country: 'USA'
        },
        summary: 'Candidate approved executive summary.',
        experience: [
          {
            company: 'Acme Cloud Platform',
            jobTitle: 'VP of Platform Engineering',
            startDate: '2021-01-01T00:00:00.000Z',
            isCurrent: true,
            responsibilities: ['Architected cloud infrastructure']
          }
        ],
        education: [
          {
            institution: 'UC Berkeley',
            degree: 'B.S. EECS'
          }
        ],
        skills: [
          { name: 'Java', proficiency: 'Expert', yearsOfExperience: 6 },
          { name: 'Playwright', proficiency: 'Advanced' }
        ],
        certifications: [
          { name: 'AWS Certified Solutions Architect' }
        ],
        setAsMaster: true
      };

      const res = await request(app)
        .post(`/api/v1/resumes/${testResumeId}/confirm`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send(confirmedData);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.fullName, 'John Confirmed Doe');
      assert.strictEqual(res.body.data.headline, 'VP of Platform Engineering');
      assert.strictEqual(res.body.data.experiences.length, 1);
      assert.strictEqual(res.body.data.experiences[0].company, 'Acme Cloud Platform');
    });
  });

  describe('Immutable Resume Versions', () => {
    let masterResumeId: string;
    let versionId: string;

    before(async () => {
      const resumesRes = await request(app)
        .get('/api/v1/resumes')
        .set('Authorization', `Bearer ${tokenA}`);
      masterResumeId = resumesRes.body.data[0].id;
    });

    it('should create an immutable Resume Version from master state', async () => {
      const res = await request(app)
        .post(`/api/v1/resumes/${masterResumeId}/versions`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ title: 'Full Stack Staff Snapshot v1' });

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.data.versionNumber, 1);
      assert.strictEqual(res.body.data.title, 'Full Stack Staff Snapshot v1');
      assert.ok(res.body.data.contentSnapshot);
      assert.strictEqual(res.body.data.contentSnapshot.profile.fullName, 'John Confirmed Doe');

      versionId = res.body.data.id;
    });

    it('should preserve historical version snapshot even if candidate master profile mutates', async () => {
      // Mutate the master candidate profile
      await request(app)
        .patch('/api/v1/candidates/me')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ fullName: 'John Mutated Doe', headline: 'Chief Technology Officer' });

      // Retrieve previous snapshot version
      const versionRes = await request(app)
        .get(`/api/v1/resume-versions/${versionId}`)
        .set('Authorization', `Bearer ${tokenA}`);

      assert.strictEqual(versionRes.status, 200);
      // The version snapshot MUST remain unchanged!
      assert.strictEqual(versionRes.body.data.contentSnapshot.profile.fullName, 'John Confirmed Doe');
      assert.strictEqual(versionRes.body.data.contentSnapshot.profile.headline, 'VP of Platform Engineering');
    });

    it('should prevent Candidate B from accessing Candidate A resume versions', async () => {
      const res = await request(app)
        .get(`/api/v1/resume-versions/${versionId}`)
        .set('Authorization', `Bearer ${tokenB}`);

      assert.strictEqual(res.status, 404);
    });
  });
});
