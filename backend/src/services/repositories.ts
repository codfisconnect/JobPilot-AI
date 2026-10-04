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
        id, name, headline, email, phone, location, state, country, linkedInUrl, gitHubUrl, portfolioUrl,
        targetRoles, yearsOfExperience, relevantYearsOfExperience, preferredLocations,
        expectedSalary, noticePeriod, workPreference, primarySkills, secondarySkills,
        technologies, categorizedSkills, companies, education, certifications, detailedCertifications,
        projects, achievements, languages, summary, experiences, extractionAudit, isDemo, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        candidate.id,
        candidate.name,
        candidate.headline || '',
        candidate.email,
        candidate.phone,
        candidate.location,
        candidate.state || '',
        candidate.country || '',
        candidate.linkedInUrl || '',
        candidate.gitHubUrl || '',
        candidate.portfolioUrl || '',
        JSON.stringify(candidate.targetRoles || []),
        candidate.yearsOfExperience || 0,
        candidate.relevantYearsOfExperience || candidate.yearsOfExperience || 0,
        JSON.stringify(candidate.preferredLocations || []),
        candidate.expectedSalary || '',
        candidate.noticePeriod || '',
        candidate.workPreference || 'Flexible',
        JSON.stringify(candidate.primarySkills || []),
        JSON.stringify(candidate.secondarySkills || []),
        JSON.stringify(candidate.technologies || []),
        JSON.stringify(candidate.categorizedSkills || []),
        JSON.stringify(candidate.companies || []),
        JSON.stringify(candidate.education || []),
        JSON.stringify(candidate.certifications || []),
        JSON.stringify(candidate.detailedCertifications || []),
        JSON.stringify(candidate.projects || []),
        JSON.stringify(candidate.achievements || []),
        JSON.stringify(candidate.languages || []),
        candidate.summary || '',
        JSON.stringify(candidate.experiences || []),
        JSON.stringify(candidate.extractionAudit || {}),
        candidate.isDemo ? 1 : 0,
        candidate.createdAt || new Date().toISOString(),
        candidate.updatedAt || new Date().toISOString()
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
      categorizedSkills: JSON.parse(row.categorizedSkills || '[]'),
      companies: JSON.parse(row.companies || '[]'),
      education: JSON.parse(row.education || '[]'),
      certifications: JSON.parse(row.certifications || '[]'),
      detailedCertifications: JSON.parse(row.detailedCertifications || '[]'),
      projects: JSON.parse(row.projects || '[]'),
      achievements: JSON.parse(row.achievements || '[]'),
      languages: JSON.parse(row.languages || '[]'),
      experiences: JSON.parse(row.experiences || '[]'),
      extractionAudit: JSON.parse(row.extractionAudit || '{}'),
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

  public static async getByExternalId(externalJobId: string): Promise<JobDescription | null> {
    const db = await getDb();
    const stmt = db.prepare('SELECT * FROM jobs WHERE externalJobId = :extId LIMIT 1');
    stmt.bind({ ':extId': externalJobId });
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
        id, role, company, location, sourceUrl, sourceType, source, applicationUrl,
        applicationMethod, employmentType, workMode, publishedDate, isExternal, externalJobId,
        experienceRequired, salary, careerTrack, mustHaveSkills, niceToHaveSkills,
        responsibilities, qualifications, rawText, createdAt, applicationMode
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        job.id,
        job.role,
        job.company,
        job.location,
        job.sourceUrl || '',
        job.sourceType,
        job.source || (job.isExternal ? 'Codewalla' : 'JobPilot Predefined'),
        job.applicationUrl || '',
        job.applicationMethod || 'External Website',
        job.employmentType || 'Full-time',
        job.workMode || 'Onsite',
        job.publishedDate || '',
        job.isExternal ? 1 : 0,
        job.externalJobId || '',
        job.experienceRequired,
        job.salary || '',
        job.careerTrack,
        JSON.stringify(job.mustHaveSkills),
        JSON.stringify(job.niceToHaveSkills),
        JSON.stringify(job.responsibilities),
        JSON.stringify(job.qualifications),
        job.rawText,
        job.createdAt,
        // Codewalla is MANDATORY demo. Other jobs use explicitly assigned mode or default to demo.
        job.company.toLowerCase().includes('codewalla') || (job.source && job.source.toLowerCase().includes('codewalla'))
          ? 'demo'
          : (job.applicationMode || (job.isExternal ? 'external' : 'demo'))
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
    // Codewalla is MANDATORY demo.
    const isCodewalla = (row.company && row.company.toLowerCase().includes('codewalla')) || (row.source && row.source.toLowerCase().includes('codewalla'));
    const appMode: 'demo' | 'external' = isCodewalla
      ? 'demo'
      : (row.applicationMode === 'external' ? 'external' : 'demo');

    return {
      ...row,
      source: row.source || (row.isExternal ? 'Codewalla' : 'JobPilot Predefined'),
      isExternal: Boolean(row.isExternal),
      applicationMode: appMode,
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
        id, versionName, candidateId, jobId, targetRole, targetCompany, mode, tailoredSummary,
        orderedSkills, experiences, projects, education, certifications, modifications,
        truthCheckVerified, targetCompanyLeakDetected, atsScore, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tailored.id,
        tailored.versionName,
        tailored.candidateId,
        tailored.jobId,
        tailored.targetRole,
        tailored.targetCompany,
        tailored.mode || 'TARGETED',
        tailored.tailoredSummary,
        JSON.stringify(tailored.orderedSkills || []),
        JSON.stringify(tailored.experiences || []),
        JSON.stringify(tailored.projects || []),
        JSON.stringify(tailored.education || []),
        JSON.stringify(tailored.certifications || []),
        JSON.stringify(tailored.modifications || []),
        tailored.truthCheckVerified ? 1 : 0,
        tailored.targetCompanyLeakDetected ? 1 : 0,
        tailored.atsScore || 0,
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
      mode: row.mode || 'TARGETED',
      tailoredSummary: row.tailoredSummary,
      orderedSkills: JSON.parse(row.orderedSkills || '[]'),
      experiences: JSON.parse(row.experiences || '[]'),
      projects: JSON.parse(row.projects || '[]'),
      education: JSON.parse(row.education || '[]'),
      certifications: JSON.parse(row.certifications || '[]'),
      modifications: JSON.parse(row.modifications || '[]'),
      truthCheckVerified: Boolean(row.truthCheckVerified),
      targetCompanyLeakDetected: Boolean(row.targetCompanyLeakDetected),
      atsScore: row.atsScore || undefined,
      createdAt: row.createdAt
    };
  }
}

export class ResumeVersionRepository {
  public static async save(version: any): Promise<any> {
    const db = await getDb();
    db.run(
      `INSERT OR REPLACE INTO resume_versions (
        id, versionName, candidateId, jobId, targetRole, targetCompany, mode, tailoredSummary,
        orderedSkills, experiences, projects, education, certifications, truthCheckVerified,
        atsScore, pdfUrl, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        version.id,
        version.versionName,
        version.candidateId,
        version.jobId || null,
        version.targetRole || null,
        version.targetCompany || null,
        version.mode,
        version.tailoredSummary,
        JSON.stringify(version.orderedSkills || []),
        JSON.stringify(version.experiences || []),
        JSON.stringify(version.projects || []),
        JSON.stringify(version.education || []),
        JSON.stringify(version.certifications || []),
        version.truthCheckVerified ? 1 : 0,
        version.atsScore || null,
        version.pdfUrl || null,
        version.createdAt || new Date().toISOString()
      ]
    );
    saveDb();
    return version;
  }

  public static async getByCandidateId(candidateId: string): Promise<any[]> {
    const db = await getDb();
    const stmt = db.prepare('SELECT * FROM resume_versions WHERE candidateId = :c ORDER BY createdAt DESC');
    stmt.bind({ ':c': candidateId });
    const list: any[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      list.push({
        ...row,
        orderedSkills: JSON.parse(String(row.orderedSkills || '[]')),
        experiences: JSON.parse(String(row.experiences || '[]')),
        projects: JSON.parse(String(row.projects || '[]')),
        education: JSON.parse(String(row.education || '[]')),
        certifications: JSON.parse(String(row.certifications || '[]')),
        truthCheckVerified: Boolean(row.truthCheckVerified)
      });
    }
    stmt.free();
    return list;
  }

  public static async getById(id: string): Promise<any | null> {
    const db = await getDb();
    const stmt = db.prepare('SELECT * FROM resume_versions WHERE id = :id');
    stmt.bind({ ':id': id });
    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      return {
        ...row,
        orderedSkills: JSON.parse(String(row.orderedSkills || '[]')),
        experiences: JSON.parse(String(row.experiences || '[]')),
        projects: JSON.parse(String(row.projects || '[]')),
        education: JSON.parse(String(row.education || '[]')),
        certifications: JSON.parse(String(row.certifications || '[]')),
        truthCheckVerified: Boolean(row.truthCheckVerified)
      };
    }
    stmt.free();
    return null;
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
    // Codewalla is MANDATORY demo
    const isCodewalla = (app.company && app.company.toLowerCase().includes('codewalla'));
    const safeMode = isCodewalla ? 'demo' : (app.applicationMode || 'demo');

    db.run(
      `INSERT OR REPLACE INTO applications (
        id, candidateId, jobId, resumeVersionId, resumeVersionName, company, role, location,
        jobUrl, matchScore, status, applicationDate, notes, customAnswers, createdAt, updatedAt,
        applicationMode, applicationUrl, atsScore, appliedAt, skillGaps, timeline, coverLetter
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        app.updatedAt,
        safeMode,
        app.applicationUrl || '',
        app.atsScore || 0,
        app.appliedAt || app.applicationDate,
        JSON.stringify(app.skillGaps || []),
        JSON.stringify(app.timeline || []),
        app.coverLetter || ''
      ]
    );
    saveDb();
    return { ...app, applicationMode: safeMode };
  }

  private static deserialize(row: any): ApplicationRecord {
    const isCodewalla = (row.company && row.company.toLowerCase().includes('codewalla'));
    const appMode: 'demo' | 'external' = isCodewalla ? 'demo' : (row.applicationMode === 'external' ? 'external' : 'demo');

    return {
      ...row,
      applicationMode: appMode,
      atsScore: row.atsScore ? Number(row.atsScore) : undefined,
      customAnswers: JSON.parse(row.customAnswers || '{}'),
      skillGaps: JSON.parse(row.skillGaps || '[]'),
      timeline: JSON.parse(row.timeline || '[]')
    };
  }

  public static async delete(id: string): Promise<void> {
    const db = await getDb();
    db.run('DELETE FROM applications WHERE id = ?', [id]);
    saveDb();
  }

  public static async deleteByCandidateAndJob(candidateId: string, jobId: string): Promise<void> {
    const db = await getDb();
    db.run('DELETE FROM applications WHERE candidateId = ? AND jobId = ?', [candidateId, jobId]);
    saveDb();
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

export class CompanyRepository {
  public static async getAll(): Promise<any[]> {
    const db = await getDb();
    const res = db.exec('SELECT * FROM companies ORDER BY name ASC');
    if (!res.length || !res[0].values) return [];
    return res[0].values.map(row => this.mapRow(res[0].columns, row));
  }

  public static async getById(id: string): Promise<any | null> {
    const db = await getDb();
    const stmt = db.prepare('SELECT * FROM companies WHERE id = :id');
    stmt.bind({ ':id': id });
    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      return this.deserialize(row);
    }
    stmt.free();
    return null;
  }

  public static async save(company: any): Promise<any> {
    const db = await getDb();
    db.run(
      `INSERT OR REPLACE INTO companies (
        id, name, officialDomain, careersUrl, country, locations, industry, atsProvider,
        atsIdentifier, sourceType, discoveryStatus, lastVerifiedAt, lastCheckedAt, healthStatus, activeJobsCount, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        company.id,
        company.name,
        company.officialDomain,
        company.careersUrl,
        company.country,
        JSON.stringify(company.locations || []),
        company.industry,
        company.atsProvider,
        company.atsIdentifier || '',
        company.sourceType,
        company.discoveryStatus,
        company.lastVerifiedAt,
        company.lastCheckedAt,
        company.healthStatus,
        company.activeJobsCount || 0,
        company.createdAt,
        company.updatedAt
      ]
    );
    saveDb();
    return company;
  }

  private static mapRow(columns: string[], values: any[]): any {
    const obj: any = {};
    columns.forEach((col, i) => {
      obj[col] = values[i];
    });
    return this.deserialize(obj);
  }

  private static deserialize(row: any): any {
    return {
      ...row,
      locations: JSON.parse(row.locations || '[]')
    };
  }
}

export class ResumeStrategyRepository {
  public static async getByCandidateAndJob(candidateId: string, jobId: string): Promise<any | null> {
    const db = await getDb();
    const stmt = db.prepare('SELECT * FROM resume_strategies WHERE candidateId = :c AND jobId = :j ORDER BY createdAt DESC LIMIT 1');
    stmt.bind({ ':c': candidateId, ':j': jobId });
    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      return this.deserialize(row);
    }
    stmt.free();
    return null;
  }

  public static async save(strat: any): Promise<any> {
    const db = await getDb();
    db.run(
      `INSERT OR REPLACE INTO resume_strategies (
        id, candidateId, jobId, mode, targetRole, targetCompany, whyMode, whatToEmphasize,
        whatToCompress, whatToDeemphasize, transferableCapabilities, genuineSkillGaps, truthWarnings, candidateApproved, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        strat.id,
        strat.candidateId,
        strat.jobId,
        strat.mode,
        strat.targetRole,
        strat.targetCompany,
        strat.whyMode,
        JSON.stringify(strat.whatToEmphasize || []),
        JSON.stringify(strat.whatToCompress || []),
        JSON.stringify(strat.whatToDeemphasize || []),
        JSON.stringify(strat.transferableCapabilities || []),
        JSON.stringify(strat.genuineSkillGaps || []),
        JSON.stringify(strat.truthWarnings || []),
        strat.candidateApproved ? 1 : 0,
        strat.createdAt,
        strat.updatedAt
      ]
    );
    saveDb();
    return strat;
  }

  private static deserialize(row: any): any {
    return {
      ...row,
      whatToEmphasize: JSON.parse(row.whatToEmphasize || '[]'),
      whatToCompress: JSON.parse(row.whatToCompress || '[]'),
      whatToDeemphasize: JSON.parse(row.whatToDeemphasize || '[]'),
      transferableCapabilities: JSON.parse(row.transferableCapabilities || '[]'),
      genuineSkillGaps: JSON.parse(row.genuineSkillGaps || '[]'),
      truthWarnings: JSON.parse(row.truthWarnings || '[]'),
      candidateApproved: Boolean(row.candidateApproved)
    };
  }
}

export class LearningRepository {
  public static async getResourcesForSkill(skill: string, preferredLanguage?: string): Promise<any[]> {
    const db = await getDb();
    const res = db.exec('SELECT * FROM learning_resources ORDER BY isVerified DESC');
    if (!res.length || !res[0].values) return [];
    const all = res[0].values.map(row => {
      const obj: any = {};
      res[0].columns.forEach((col, i) => { obj[col] = row[i]; });
      return { ...obj, isVerified: Boolean(obj.isVerified) };
    });

    const skillLower = skill.toLowerCase();
    const filtered = all.filter(r => r.skill.toLowerCase().includes(skillLower) || skillLower.includes(r.skill.toLowerCase()));
    if (preferredLanguage && preferredLanguage !== 'English') {
      const langMatch = filtered.filter(r => r.language.toLowerCase() === preferredLanguage.toLowerCase());
      if (langMatch.length > 0) return langMatch;
    }
    return filtered.length > 0 ? filtered : all.slice(0, 3);
  }

  public static async getLocalInstitutes(city: string, skill?: string): Promise<any[]> {
    const db = await getDb();
    const res = db.exec('SELECT * FROM local_institutes ORDER BY rating DESC');
    if (!res.length || !res[0].values) return [];
    const all = res[0].values.map(row => {
      const obj: any = {};
      res[0].columns.forEach((col, i) => { obj[col] = row[i]; });
      return {
        ...obj,
        skillsTaught: JSON.parse(obj.skillsTaught || '[]'),
        isVerified: Boolean(obj.isVerified)
      };
    });

    const cityLower = city.toLowerCase();
    let cityFiltered = all.filter(inst => inst.city.toLowerCase().includes(cityLower) || cityLower.includes(inst.city.toLowerCase()));
    if (cityFiltered.length === 0) cityFiltered = all;

    if (skill) {
      const skillLower = skill.toLowerCase();
      const skillMatched = cityFiltered.filter(inst => inst.skillsTaught.some((s: string) => s.toLowerCase().includes(skillLower)));
      if (skillMatched.length > 0) return skillMatched.slice(0, 5);
    }
    return cityFiltered.slice(0, 5);
  }

  public static async saveResource(resource: any): Promise<any> {
    const db = await getDb();
    db.run(
      `INSERT OR REPLACE INTO learning_resources (
        id, skill, title, platform, url, language, level, approximateDuration, isVerified, description
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        resource.id, resource.skill, resource.title, resource.platform, resource.url,
        resource.language, resource.level, resource.approximateDuration || '', resource.isVerified ? 1 : 0, resource.description
      ]
    );
    saveDb();
    return resource;
  }

  public static async saveInstitute(institute: any): Promise<any> {
    const db = await getDb();
    db.run(
      `INSERT OR REPLACE INTO local_institutes (
        id, name, city, area, skillsTaught, courseRelevance, rating, contactPhone, website, distanceEstimate, isVerified
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        institute.id, institute.name, institute.city, institute.area, JSON.stringify(institute.skillsTaught || []),
        institute.courseRelevance, institute.rating || 4.5, institute.contactPhone || '', institute.website || '', institute.distanceEstimate || '', institute.isVerified ? 1 : 0
      ]
    );
    saveDb();
    return institute;
  }
}

