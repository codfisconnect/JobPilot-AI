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
      tailoredSummary TEXT,
      orderedSkills TEXT,
      experiences TEXT,
      projects TEXT,
      modifications TEXT,
      truthCheckVerified INTEGER DEFAULT 1,
      createdAt TEXT,
      FOREIGN KEY(candidateId) REFERENCES candidates(id),
      FOREIGN KEY(jobId) REFERENCES jobs(id)
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
  `);
}
