import { app } from '../server.js';
import request from 'supertest';
import { signAccessToken } from '../utils/jwt.js';
import { prisma } from '../database/prisma.js';
import { ResumeParsingService } from '../services/resumeParsing.service.js';

async function fullE2ETest() {
  console.log('--- Starting Full End-to-End Pipeline Verification ---');
  
  // 1. Create a clean candidate user
  const email = `e2e.salman.${Date.now()}@pilotmama.local`;
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: 'dummyhash',
      role: 'CANDIDATE',
      candidateProfile: {
        create: {
          fullName: 'SYED SALMAN A',
          email,
          headline: 'Senior Test Engineer'
        }
      }
    },
    include: { candidateProfile: true }
  });
  if (!user.candidateProfile) throw new Error('candidateProfile missing');
  console.log('1. Created test candidate:', user.candidateProfile.id, user.candidateProfile.fullName);
  const token = signAccessToken({ userId: user.id, email: user.email, role: 'CANDIDATE' });

  // 2. Mock upload resume
  const resume = await prisma.resume.create({
    data: {
      candidateProfileId: user.candidateProfile.id,
      title: 'Syed_Salman_A_Resume.pdf',
      originalFileName: 'Syed_Salman_A_Resume.pdf',
      mimeType: 'application/pdf',
      fileSize: 1024,
      storageKey: `mock-key-${Date.now()}.pdf`,
      status: 'UPLOADED'
    }
  });
  console.log('2. Created resume record:', resume.id);

  // 3. Parse resume with Salman fixture text
  const resumeText = `
SYED SALMAN A
Mobile: +91 9876543210
Email: ${email}
Chennai, India

Career Objective
To secure a challenging role where I can utilize my testing and analysis expertise.

Professional Summary
Experienced IT professional with over 6 years of expertise in software testing, quality engineering, and business analysis.

Key Skills
JIRA
Confluence
Power BI
Git
Agile
Scrum

Experience
Senior Test Engineer / Business Analyst
Machine Vogue Technology Pvt Ltd.
6 years

Key Responsibilities:
• Developed and executed test plans, test scenarios, and comprehensive test cases.
• Collaborated closely with product owners, stakeholders, and developers in agile sprints.
• Conducted defect triage, bug tracking, and root cause analysis in JIRA.

Projects
EasyJet Airlines Inc.
Implemented reservation engine automation workflows and validated flight scheduling.

Wakampa
Performed end-to-end user journey validation and checkout payment gateway regression.

Education
B.Tech (Automobile Engineering)
B.S Abdur Rahman University, Chennai | 2018
`;

  const parsed = ResumeParsingService.parse(resumeText);
  console.log('3. Parsed resume entities:');
  console.log('   - Experiences extracted:', parsed.experience.length, parsed.experience[0]?.company, parsed.experience[0]?.jobTitle, parsed.experience[0]?.duration);
  console.log('   - Projects extracted:', parsed.projects.length, parsed.projects.map((p: any) => p.name));
  console.log('   - Education extracted:', parsed.education.length, parsed.education[0]?.degree, parsed.education[0]?.institution);
  console.log('   - Skills extracted:', parsed.skills.length);
  console.log('   - Summary extracted:', parsed.summary.substring(0, 50) + '...');

  // 4. Confirm & Save to Master Profile
  const confirmPayload = {
    personalInfo: parsed.personalInfo,
    summary: parsed.summary,
    experience: parsed.experience,
    education: parsed.education,
    projects: parsed.projects,
    skills: parsed.skills,
    certifications: parsed.certifications,
    setAsMaster: true
  };

  const confirmRes = await request(app)
    .post(`/api/v1/resumes/${resume.id}/confirm`)
    .set('Authorization', `Bearer ${token}`)
    .send(confirmPayload);

  console.log('4. POST /resumes/:id/confirm Status:', confirmRes.status);
  if (confirmRes.status !== 200) {
    console.error('Confirm error:', confirmRes.body);
    process.exit(1);
  }

  // 5. Query DB directly to verify persistence
  const dbProfile = await prisma.candidateProfile.findUnique({
    where: { id: user.candidateProfile.id },
    include: {
      experiences: true,
      educations: true,
      projects: true,
      certifications: true,
      skills: { include: { skill: true } }
    }
  });

  if (!dbProfile) {
    console.error('Profile not found in DB!');
    process.exit(1);
  }

  console.log('5. Direct PostgreSQL Verification:');
  console.log('   - CandidateProfile exists: YES');
  console.log('   - Summary:', dbProfile.summary);
  console.log('   - Experiences count:', dbProfile.experiences.length, dbProfile.experiences[0]?.jobTitle, '@', dbProfile.experiences[0]?.company, 'startDate:', dbProfile.experiences[0]?.startDate);
  console.log('   - Projects count:', dbProfile.projects.length, dbProfile.projects.map(p => p.name));
  console.log('   - Educations count:', dbProfile.educations.length, dbProfile.educations[0]?.degree, '@', dbProfile.educations[0]?.institution);
  console.log('   - Skills count:', dbProfile.skills.length);

  // 6. Test GET /api/v1/candidates/me
  const getRes = await request(app)
    .get('/api/v1/candidates/me')
    .set('Authorization', `Bearer ${token}`);

  console.log('6. GET /api/v1/candidates/me Status:', getRes.status);
  console.log('   - API summary returned:', Boolean(getRes.body.data.summary));
  console.log('   - API experiences returned:', getRes.body.data.experiences.length);
  console.log('   - API projects returned:', getRes.body.data.projects.length);
  console.log('   - API educations returned:', getRes.body.data.educations.length);
  console.log('   - API skills returned:', getRes.body.data.skills.length);

  // Assertions
  if (!dbProfile.summary || dbProfile.experiences.length === 0 || dbProfile.projects.length === 0 || dbProfile.educations.length === 0) {
    console.error('FAILURE: Pipeline entities missing from database!');
    process.exit(1);
  }

  if (getRes.body.data.experiences.length === 0 || getRes.body.data.projects.length === 0) {
    console.error('FAILURE: API response omitted relations!');
    process.exit(1);
  }

  // Cleanup
  await prisma.user.delete({ where: { id: user.id } });
  console.log('\n>>> ALL RESUME -> MASTER PROFILE -> PROFILE API VERIFICATIONS PASSED 100%! <<<');
}

fullE2ETest().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
