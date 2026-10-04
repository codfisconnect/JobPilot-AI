import { getDb, saveDb } from '../database/db.js';
import {
  CandidateProfile,
  JobDescription,
  JobMatchAnalysis,
  TailoredResume,
  ApplicationRecord,
  InterviewPreparation
} from '../types/index.js';

export class CandidateRepository {
  public static async getAll(): Promise<CandidateProfile[]> {
    const db = await getDb();
    const res = db.exec('SELECT * FROM candidates ORDER BY createdAt DESC');
    if (!res.length || !res[0].values) return [];
    return res[0].values.map(row => this.mapRow(res[0].columns, row));
  }

  public static async getById(id: string): Promise<CandidateProfile | null> {
    const db = await getDb();
    const stmt = db.prepare('SELECT * FROM candidates WHERE id = :id');
    stmt.bind({ ':id': id });
    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      return this.deserialize(row);
    }
    stmt.free();
    return null;
  }

  public static async save(candidate: CandidateProfile): Promise<CandidateProfile> {
    const db = await getDb();
    db.run(
      `INSERT OR REPLACE INTO candidates (
        id, name, email, phone, location, targetRoles, yearsOfExperience, preferredLocations,
        expectedSalary, noticePeriod, workPreference, primarySkills, secondarySkills,
        technologies, companies, education, certifications, projects, summary, experiences, isDemo, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        candidate.id,
        candidate.name,
        candidate.email,
        candidate.phone,
        candidate.location,
        JSON.stringify(candidate.targetRoles),
        candidate.yearsOfExperience,
        JSON.stringify(candidate.preferredLocations),
        candidate.expectedSalary,
        candidate.noticePeriod,
        candidate.workPreference,
        JSON.stringify(candidate.primarySkills),
        JSON.stringify(candidate.secondarySkills),
        JSON.stringify(candidate.technologies),
        JSON.stringify(candidate.companies),
        JSON.stringify(candidate.education),
        JSON.stringify(candidate.certifications),
        JSON.stringify(candidate.projects),
        candidate.summary,
        JSON.stringify(candidate.experiences),
        candidate.isDemo ? 1 : 0,
        candidate.createdAt,
        candidate.updatedAt
      ]
    );
    saveDb();
    return candidate;
  }

  private static mapRow(columns: string[], values: any[]): CandidateProfile {
    const obj: any = {};
    columns.forEach((col, i) => {
      obj[col] = values[i];
    });
    return this.deserialize(obj);
  }

  private static deserialize(row: any): CandidateProfile {
    return {
      ...row,
      targetRoles: JSON.parse(row.targetRoles || '[]'),
      preferredLocations: JSON.parse(row.preferredLocations || '[]'),
      primarySkills: JSON.parse(row.primarySkills || '[]'),
      secondarySkills: JSON.parse(row.secondarySkills || '[]'),
      technologies: JSON.parse(row.technologies || '[]'),
      companies: JSON.parse(row.companies || '[]'),
      education: JSON.parse(row.education || '[]'),
      certifications: JSON.parse(row.certifications || '[]'),
      projects: JSON.parse(row.projects || '[]'),
      experiences: JSON.parse(row.experiences || '[]'),
      isDemo: Boolean(row.isDemo)
    };
  }
}

export class JobRepository {
  public static async getAll(): Promise<JobDescription[]> {
    const db = await getDb();
    const res = db.exec('SELECT * FROM jobs ORDER BY createdAt DESC');
    if (!res.length || !res[0].values) return [];
    return res[0].values.map(row => this.mapRow(res[0].columns, row));
  }

  public static async getById(id: string): Promise<JobDescription | null> {
    const db = await getDb();
    const stmt = db.prepare('SELECT * FROM jobs WHERE id = :id');
    stmt.bind({ ':id': id });
    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      return this.deserialize(row);
    }
    stmt.free();
    return null;
  }

  public static async save(job: JobDescription): Promise<JobDescription> {
    const db = await getDb();
    db.run(
      `INSERT OR REPLACE INTO jobs (
        id, role, company, location, sourceUrl, sourceType, experienceRequired,
        salary, careerTrack, mustHaveSkills, niceToHaveSkills, responsibilities, qualifications, rawText, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        job.id,
        job.role,
        job.company,
        job.location,
        job.sourceUrl || '',
        job.sourceType,
        job.experienceRequired,
        job.salary || '',
        job.careerTrack,
        JSON.stringify(job.mustHaveSkills),
        JSON.stringify(job.niceToHaveSkills),
        JSON.stringify(job.responsibilities),
        JSON.stringify(job.qualifications),
        job.rawText,
        job.createdAt
      ]
    );
    saveDb();
    return job;
  }

  private static mapRow(columns: string[], values: any[]): JobDescription {
    const obj: any = {};
    columns.forEach((col, i) => {
      obj[col] = values[i];
    });
    return this.deserialize(obj);
  }

  private static deserialize(row: any): JobDescription {
    return {
      ...row,
      mustHaveSkills: JSON.parse(row.mustHaveSkills || '[]'),
      niceToHaveSkills: JSON.parse(row.niceToHaveSkills || '[]'),
      responsibilities: JSON.parse(row.responsibilities || '[]'),
      qualifications: JSON.parse(row.qualifications || '[]')
    };
  }
}

export class MatchRepository {
  public static async save(analysis: JobMatchAnalysis): Promise<JobMatchAnalysis> {
    const db = await getDb();
    db.run(
      `INSERT OR REPLACE INTO match_analyses (
        id, candidateId, jobId, scores, recommendation, whyMatch, careerTrack, truthCheck, atsAnalysis, suggestedAnswers, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        analysis.id,
        analysis.candidateId,
        analysis.jobId,
        JSON.stringify(analysis.scores),
        JSON.stringify(analysis.recommendation),
        JSON.stringify(analysis.whyMatch),
        JSON.stringify(analysis.careerTrack),
        JSON.stringify(analysis.truthCheck),
        JSON.stringify(analysis.atsAnalysis),
        JSON.stringify(analysis.suggestedAnswers),
        analysis.createdAt
      ]
    );
    saveDb();
    return analysis;
  }

  public static async getByCandidateAndJob(candidateId: string, jobId: string): Promise<JobMatchAnalysis | null> {
    const db = await getDb();
    const stmt = db.prepare('SELECT * FROM match_analyses WHERE candidateId = :candidateId AND jobId = :jobId ORDER BY createdAt DESC LIMIT 1');
    stmt.bind({ ':candidateId': candidateId, ':jobId': jobId });
    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      return this.deserialize(row);
    }
    stmt.free();
    return null;
  }

  private static deserialize(row: any): JobMatchAnalysis {
    return {
      id: row.id,
      candidateId: row.candidateId,
      jobId: row.jobId,
      scores: JSON.parse(row.scores),
      recommendation: JSON.parse(row.recommendation),
      whyMatch: JSON.parse(row.whyMatch),
      careerTrack: JSON.parse(row.careerTrack),
      truthCheck: JSON.parse(row.truthCheck),
      atsAnalysis: JSON.parse(row.atsAnalysis),
      suggestedAnswers: JSON.parse(row.suggestedAnswers || '{}'),
      createdAt: row.createdAt
    };
  }
}

export class ResumeRepository {
  public static async save(tailored: TailoredResume): Promise<TailoredResume> {
    const db = await getDb();
    db.run(
      `INSERT OR REPLACE INTO tailored_resumes (
        id, versionName, candidateId, jobId, targetRole, targetCompany, tailoredSummary,
        orderedSkills, experiences, projects, modifications, truthCheckVerified, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tailored.id,
        tailored.versionName,
        tailored.candidateId,
        tailored.jobId,
        tailored.targetRole,
        tailored.targetCompany,
        tailored.tailoredSummary,
        JSON.stringify(tailored.orderedSkills),
        JSON.stringify(tailored.experiences),
        JSON.stringify(tailored.projects),
        JSON.stringify(tailored.modifications),
        tailored.truthCheckVerified ? 1 : 0,
        tailored.createdAt
      ]
    );
    saveDb();
    return tailored;
  }

  public static async getById(id: string): Promise<TailoredResume | null> {
    const db = await getDb();
    const stmt = db.prepare('SELECT * FROM tailored_resumes WHERE id = :id');
    stmt.bind({ ':id': id });
    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      return this.deserialize(row);
    }
    stmt.free();
    return null;
  }

  public static async getByCandidateAndJob(candidateId: string, jobId: string): Promise<TailoredResume[]> {
    const db = await getDb();
    const stmt = db.prepare('SELECT * FROM tailored_resumes WHERE candidateId = :c AND jobId = :j ORDER BY createdAt DESC');
    stmt.bind({ ':c': candidateId, ':j': jobId });
    const list: TailoredResume[] = [];
    while (stmt.step()) {
      list.push(this.deserialize(stmt.getAsObject()));
    }
    stmt.free();
    return list;
  }

  public static async getAll(): Promise<TailoredResume[]> {
    const db = await getDb();
    const res = db.exec('SELECT * FROM tailored_resumes ORDER BY createdAt DESC');
    if (!res.length || !res[0].values) return [];
    return res[0].values.map(row => {
      const obj: any = {};
      res[0].columns.forEach((c, idx) => { obj[c] = row[idx]; });
      return this.deserialize(obj);
    });
  }

  private static deserialize(row: any): TailoredResume {
    return {
      id: row.id,
      versionName: row.versionName,
      candidateId: row.candidateId,
      jobId: row.jobId,
      targetRole: row.targetRole,
      targetCompany: row.targetCompany,
      tailoredSummary: row.tailoredSummary,
      orderedSkills: JSON.parse(row.orderedSkills || '[]'),
      experiences: JSON.parse(row.experiences || '[]'),
      projects: JSON.parse(row.projects || '[]'),
      modifications: JSON.parse(row.modifications || '[]'),
      truthCheckVerified: Boolean(row.truthCheckVerified),
      createdAt: row.createdAt
    };
  }
}

export class ApplicationRepository {
  public static async getAll(candidateId?: string): Promise<ApplicationRecord[]> {
    const db = await getDb();
    let query = 'SELECT * FROM applications ORDER BY createdAt DESC';
    if (candidateId) {
      query = `SELECT * FROM applications WHERE candidateId = '${candidateId}' ORDER BY createdAt DESC`;
    }
    const res = db.exec(query);
    if (!res.length || !res[0].values) return [];
    return res[0].values.map(row => {
      const obj: any = {};
      res[0].columns.forEach((c, idx) => { obj[c] = row[idx]; });
      return this.deserialize(obj);
    });
  }

  public static async getById(id: string): Promise<ApplicationRecord | null> {
    const db = await getDb();
    const stmt = db.prepare('SELECT * FROM applications WHERE id = :id');
    stmt.bind({ ':id': id });
    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      return this.deserialize(row);
    }
    stmt.free();
    return null;
  }

  public static async save(app: ApplicationRecord): Promise<ApplicationRecord> {
    const db = await getDb();
    db.run(
      `INSERT OR REPLACE INTO applications (
        id, candidateId, jobId, resumeVersionId, resumeVersionName, company, role, location,
        jobUrl, matchScore, status, applicationDate, notes, customAnswers, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        app.id,
        app.candidateId,
        app.jobId,
        app.resumeVersionId || '',
        app.resumeVersionName || '',
        app.company,
        app.role,
        app.location,
        app.jobUrl || '',
        app.matchScore,
        app.status,
        app.applicationDate,
        app.notes,
        JSON.stringify(app.customAnswers || {}),
        app.createdAt,
        app.updatedAt
      ]
    );
    saveDb();
    return app;
  }

  private static deserialize(row: any): ApplicationRecord {
    return {
      ...row,
      customAnswers: JSON.parse(row.customAnswers || '{}')
    };
  }
}

export class InterviewPrepRepository {
  public static async save(prep: InterviewPreparation): Promise<InterviewPreparation> {
    const db = await getDb();
    db.run(
      `INSERT OR REPLACE INTO interview_preps (
        id, candidateId, jobId, resumeVersionId, role, company,
        technicalTopics, technicalQuestions, resumeQuestions, hrQuestions, roleSpecificQuestions, preparationAreas, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        prep.id,
        prep.candidateId,
        prep.jobId,
        prep.resumeVersionId || '',
        prep.role,
        prep.company,
        JSON.stringify(prep.technicalTopics),
        JSON.stringify(prep.technicalQuestions),
        JSON.stringify(prep.resumeQuestions),
        JSON.stringify(prep.hrQuestions),
        JSON.stringify(prep.roleSpecificQuestions),
        JSON.stringify(prep.preparationAreas),
        prep.createdAt
      ]
    );
    saveDb();
    return prep;
  }

  public static async getByCandidateAndJob(candidateId: string, jobId: string): Promise<InterviewPreparation | null> {
    const db = await getDb();
    const stmt = db.prepare('SELECT * FROM interview_preps WHERE candidateId = :c AND jobId = :j ORDER BY createdAt DESC LIMIT 1');
    stmt.bind({ ':c': candidateId, ':j': jobId });
    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      return this.deserialize(row);
    }
    stmt.free();
    return null;
  }

  private static deserialize(row: any): InterviewPreparation {
    return {
      id: row.id,
      candidateId: row.candidateId,
      jobId: row.jobId,
      resumeVersionId: row.resumeVersionId,
      role: row.role,
      company: row.company,
      technicalTopics: JSON.parse(row.technicalTopics || '[]'),
      technicalQuestions: JSON.parse(row.technicalQuestions || '[]'),
      resumeQuestions: JSON.parse(row.resumeQuestions || '[]'),
      hrQuestions: JSON.parse(row.hrQuestions || '[]'),
      roleSpecificQuestions: JSON.parse(row.roleSpecificQuestions || '[]'),
      preparationAreas: JSON.parse(row.preparationAreas || '[]'),
      createdAt: row.createdAt
    };
  }
}
