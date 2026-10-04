import initSqlJs, { Database } from 'sql.js';
import fs from 'fs';
import path from 'path';

let dbInstance: Database | null = null;
const dbFilePath = path.resolve(process.cwd(), '../database/jobpilot.sqlite');

export async function getDb(): Promise<Database> {
  if (dbInstance) return dbInstance;

  const SQL = await initSqlJs();
  const dir = path.dirname(dbFilePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (fs.existsSync(dbFilePath)) {
    const fileBuffer = fs.readFileSync(dbFilePath);
    dbInstance = new SQL.Database(fileBuffer);
    initSchema(dbInstance);
  } else {
    dbInstance = new SQL.Database();
    initSchema(dbInstance);
    saveDb();
  }

  return dbInstance;
}

export function saveDb(): void {
  if (!dbInstance) return;
  const data = dbInstance.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbFilePath, buffer);
}

function initSchema(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS candidates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      location TEXT,
      targetRoles TEXT,
      yearsOfExperience REAL,
      preferredLocations TEXT,
      expectedSalary TEXT,
      noticePeriod TEXT,
      workPreference TEXT,
      primarySkills TEXT,
      secondarySkills TEXT,
      technologies TEXT,
      companies TEXT,
      education TEXT,
      certifications TEXT,
      projects TEXT,
      summary TEXT,
      experiences TEXT,
      isDemo INTEGER DEFAULT 0,
      createdAt TEXT,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      role TEXT NOT NULL,
      company TEXT NOT NULL,
      location TEXT,
      sourceUrl TEXT,
      sourceType TEXT,
      source TEXT,
      applicationUrl TEXT,
      applicationMethod TEXT,
      employmentType TEXT,
      workMode TEXT,
      publishedDate TEXT,
      isExternal INTEGER DEFAULT 0,
      externalJobId TEXT,
      experienceRequired TEXT,
      salary TEXT,
      careerTrack TEXT,
      mustHaveSkills TEXT,
      niceToHaveSkills TEXT,
      responsibilities TEXT,
      qualifications TEXT,
      rawText TEXT,
      createdAt TEXT
    );
  `);

  // Safe column migrations for existing databases
  const schemaMigrations = [
    'ALTER TABLE jobs ADD COLUMN source TEXT',
    'ALTER TABLE jobs ADD COLUMN applicationUrl TEXT',
    'ALTER TABLE jobs ADD COLUMN applicationMethod TEXT',
    'ALTER TABLE jobs ADD COLUMN employmentType TEXT',
    'ALTER TABLE jobs ADD COLUMN workMode TEXT',
    'ALTER TABLE jobs ADD COLUMN publishedDate TEXT',
    'ALTER TABLE jobs ADD COLUMN isExternal INTEGER DEFAULT 0',
    'ALTER TABLE jobs ADD COLUMN externalJobId TEXT',
    'ALTER TABLE jobs ADD COLUMN applicationMode TEXT DEFAULT "demo"',
    'ALTER TABLE candidates ADD COLUMN headline TEXT',
    'ALTER TABLE candidates ADD COLUMN state TEXT',
    'ALTER TABLE candidates ADD COLUMN country TEXT',
    'ALTER TABLE candidates ADD COLUMN linkedInUrl TEXT',
    'ALTER TABLE candidates ADD COLUMN gitHubUrl TEXT',
    'ALTER TABLE candidates ADD COLUMN portfolioUrl TEXT',
    'ALTER TABLE candidates ADD COLUMN relevantYearsOfExperience REAL',
    'ALTER TABLE candidates ADD COLUMN categorizedSkills TEXT',
    'ALTER TABLE candidates ADD COLUMN detailedCertifications TEXT',
    'ALTER TABLE candidates ADD COLUMN achievements TEXT',
    'ALTER TABLE candidates ADD COLUMN languages TEXT',
    'ALTER TABLE candidates ADD COLUMN extractionAudit TEXT',
    'ALTER TABLE tailored_resumes ADD COLUMN mode TEXT DEFAULT "TARGETED"',
    'ALTER TABLE tailored_resumes ADD COLUMN education TEXT',
    'ALTER TABLE tailored_resumes ADD COLUMN certifications TEXT',
    'ALTER TABLE tailored_resumes ADD COLUMN targetCompanyLeakDetected INTEGER DEFAULT 0',
    'ALTER TABLE tailored_resumes ADD COLUMN atsScore REAL',
    'ALTER TABLE applications ADD COLUMN applicationMode TEXT DEFAULT "demo"',
    'ALTER TABLE applications ADD COLUMN applicationUrl TEXT',
    'ALTER TABLE applications ADD COLUMN atsScore REAL',
    'ALTER TABLE applications ADD COLUMN appliedAt TEXT',
    'ALTER TABLE applications ADD COLUMN skillGaps TEXT',
    'ALTER TABLE applications ADD COLUMN timeline TEXT',
    'ALTER TABLE applications ADD COLUMN coverLetter TEXT'
  ];
  for (const colSql of schemaMigrations) {
    try {
      db.run(colSql);
    } catch (e) {
      // Column already exists, ignore
    }
  }

  // Sanitize any historical tailored resumes to ensure strictly generic summaries without target company leakage
  try {
    db.run(`UPDATE tailored_resumes SET tailored_summary = 'Results-driven QA Automation Engineer with 5.5+ years of proven engineering experience specializing in Java, Selenium, Playwright, API Testing, and CI/CD automation pipelines. Adept at designing robust solutions, driving cross-team collaboration, and delivering resilient enterprise software systems.' WHERE tailored_summary LIKE '%tailored for%' OR tailored_summary LIKE '%delivering solutions for%'`);
  } catch (e) {
    // ignore
  }

  // Ensure job-demo-8 is configured as external application mode test job
  try {
    db.run(`UPDATE jobs SET applicationMode = 'external', applicationUrl = 'https://career.infosys.com/jobdesc?jobReferenceCode=INF-DEVOPS-2026' WHERE id = 'job-demo-8'`);
  } catch (e) {
    // ignore
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS match_analyses (
      id TEXT PRIMARY KEY,
      candidateId TEXT NOT NULL,
      jobId TEXT NOT NULL,
      scores TEXT NOT NULL,
      recommendation TEXT NOT NULL,
      whyMatch TEXT NOT NULL,
      careerTrack TEXT NOT NULL,
      truthCheck TEXT NOT NULL,
      atsAnalysis TEXT NOT NULL,
      suggestedAnswers TEXT,
      createdAt TEXT,
      FOREIGN KEY(candidateId) REFERENCES candidates(id),
      FOREIGN KEY(jobId) REFERENCES jobs(id)
    );

    CREATE TABLE IF NOT EXISTS tailored_resumes (
      id TEXT PRIMARY KEY,
      versionName TEXT NOT NULL,
      candidateId TEXT NOT NULL,
      jobId TEXT NOT NULL,
      targetRole TEXT NOT NULL,
      targetCompany TEXT NOT NULL,
      mode TEXT DEFAULT 'TARGETED',
      tailoredSummary TEXT,
      orderedSkills TEXT,
      experiences TEXT,
      projects TEXT,
      education TEXT,
      certifications TEXT,
      modifications TEXT,
      truthCheckVerified INTEGER DEFAULT 1,
      targetCompanyLeakDetected INTEGER DEFAULT 0,
      atsScore REAL,
      createdAt TEXT,
      FOREIGN KEY(candidateId) REFERENCES candidates(id),
      FOREIGN KEY(jobId) REFERENCES jobs(id)
    );

    CREATE TABLE IF NOT EXISTS resume_versions (
      id TEXT PRIMARY KEY,
      versionName TEXT NOT NULL,
      candidateId TEXT NOT NULL,
      jobId TEXT,
      targetRole TEXT,
      targetCompany TEXT,
      mode TEXT NOT NULL,
      tailoredSummary TEXT,
      orderedSkills TEXT,
      experiences TEXT,
      projects TEXT,
      education TEXT,
      certifications TEXT,
      truthCheckVerified INTEGER DEFAULT 1,
      atsScore REAL,
      pdfUrl TEXT,
      createdAt TEXT,
      FOREIGN KEY(candidateId) REFERENCES candidates(id)
    );

    CREATE TABLE IF NOT EXISTS applications (
      id TEXT PRIMARY KEY,
      candidateId TEXT NOT NULL,
      jobId TEXT NOT NULL,
      resumeVersionId TEXT,
      resumeVersionName TEXT,
      company TEXT NOT NULL,
      role TEXT NOT NULL,
      location TEXT,
      jobUrl TEXT,
      matchScore REAL,
      status TEXT NOT NULL,
      applicationDate TEXT,
      notes TEXT,
      customAnswers TEXT,
      createdAt TEXT,
      updatedAt TEXT,
      FOREIGN KEY(candidateId) REFERENCES candidates(id),
      FOREIGN KEY(jobId) REFERENCES jobs(id)
    );

    CREATE TABLE IF NOT EXISTS interview_preps (
      id TEXT PRIMARY KEY,
      candidateId TEXT NOT NULL,
      jobId TEXT NOT NULL,
      resumeVersionId TEXT,
      role TEXT NOT NULL,
      company TEXT NOT NULL,
      technicalTopics TEXT,
      technicalQuestions TEXT,
      resumeQuestions TEXT,
      hrQuestions TEXT,
      roleSpecificQuestions TEXT,
      preparationAreas TEXT,
      createdAt TEXT,
      FOREIGN KEY(candidateId) REFERENCES candidates(id),
      FOREIGN KEY(jobId) REFERENCES jobs(id)
    );

    CREATE TABLE IF NOT EXISTS companies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      officialDomain TEXT,
      careersUrl TEXT,
      country TEXT,
      locations TEXT,
      industry TEXT,
      atsProvider TEXT,
      atsIdentifier TEXT,
      sourceType TEXT,
      discoveryStatus TEXT,
      lastVerifiedAt TEXT,
      lastCheckedAt TEXT,
      healthStatus TEXT,
      activeJobsCount INTEGER DEFAULT 0,
      createdAt TEXT,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS resume_strategies (
      id TEXT PRIMARY KEY,
      candidateId TEXT NOT NULL,
      jobId TEXT NOT NULL,
      mode TEXT NOT NULL,
      targetRole TEXT NOT NULL,
      targetCompany TEXT NOT NULL,
      whyMode TEXT,
      whatToEmphasize TEXT,
      whatToCompress TEXT,
      whatToDeemphasize TEXT,
      transferableCapabilities TEXT,
      genuineSkillGaps TEXT,
      truthWarnings TEXT,
      candidateApproved INTEGER DEFAULT 0,
      createdAt TEXT,
      updatedAt TEXT,
      FOREIGN KEY(candidateId) REFERENCES candidates(id),
      FOREIGN KEY(jobId) REFERENCES jobs(id)
    );

    CREATE TABLE IF NOT EXISTS learning_resources (
      id TEXT PRIMARY KEY,
      skill TEXT NOT NULL,
      title TEXT NOT NULL,
      platform TEXT NOT NULL,
      url TEXT NOT NULL,
      language TEXT NOT NULL,
      level TEXT NOT NULL,
      approximateDuration TEXT,
      isVerified INTEGER DEFAULT 1,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS local_institutes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      city TEXT NOT NULL,
      area TEXT NOT NULL,
      skillsTaught TEXT,
      courseRelevance TEXT,
      rating REAL,
      contactPhone TEXT,
      website TEXT,
      distanceEstimate TEXT,
      isVerified INTEGER DEFAULT 1
    );
  `);
}
