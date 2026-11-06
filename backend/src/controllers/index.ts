import { Request, Response } from 'express';
import {
  CandidateRepository,
  JobRepository,
  MatchRepository,
  ResumeRepository,
  ApplicationRepository,
  InterviewPrepRepository
} from '../services/repositories.js';
import { ResumeParserService } from '../parsers/resume.parser.js';
import { JobParserService } from '../parsers/job.parser.js';
import { MatchingEngine } from '../analyzers/matching.engine.js';
import { ResumeTailorService } from '../generators/resume.generator.js';
import { InterviewPrepService } from '../generators/interview.generator.js';
import { CandidateProfile, JobDescription, ApplicationRecord } from '../types/index.js';

export class CandidateController {
  public static async getAll(req: Request, res: Response) {
    try {
      const candidates = await CandidateRepository.getAll();
      res.json({ success: true, data: candidates });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  public static async getById(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const candidate = await CandidateRepository.getById(id);
      if (!candidate) {
        return res.status(404).json({ success: false, error: 'Candidate profile not found' });
      }
      res.json({ success: true, data: candidate });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  public static async update(req: Request, res: Response) {
    try {
      const candidateData: CandidateProfile = req.body;
      candidateData.updatedAt = new Date().toISOString();
      const saved = await CandidateRepository.save(candidateData);
      res.json({ success: true, data: saved });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  public static async uploadResume(req: Request, res: Response) {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ success: false, error: 'No resume file uploaded. Please upload a PDF or DOCX file.' });
      }

      const text = await ResumeParserService.extractTextFromFile(file.buffer, file.mimetype);
      if (!text || text.trim().length === 0) {
        return res.status(400).json({ success: false, error: 'The uploaded file appears empty or unreadable.' });
      }

      const parsed = await ResumeParserService.parseResumeText(text);

      const candidate: CandidateProfile = {
        id: `cand-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        name: parsed.name || 'Candidate',
        email: parsed.email || '',
        phone: parsed.phone || '',
        location: parsed.location || 'Bangalore, India',
        targetRoles: parsed.targetRoles || ['Software Engineer'],
        yearsOfExperience: parsed.yearsOfExperience || 3,
        preferredLocations: ['Bangalore', 'Remote', 'Hybrid'],
        expectedSalary: 'Competitive Market Standard',
        noticePeriod: '30 Days',
        workPreference: 'Hybrid',
        primarySkills: parsed.primarySkills || [],
        secondarySkills: parsed.secondarySkills || [],
        technologies: parsed.technologies || [],
        companies: parsed.companies || [],
        education: parsed.education || [],
        certifications: parsed.certifications || [],
        projects: parsed.projects || [],
        summary: parsed.summary || '',
        experiences: parsed.experiences || [],
        isDemo: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await CandidateRepository.save(candidate);

      res.json({
        success: true,
        data: candidate,
        extractedRawText: text.substring(0, 1000)
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: `Failed to process resume: ${err.message}` });
    }
  }
}

export class JobController {
  public static async getAll(req: Request, res: Response) {
    try {
      const jobs = await JobRepository.getAll();
      res.json({ success: true, data: jobs });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  public static async getById(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const job = await JobRepository.getById(id);
      if (!job) {
        return res.status(404).json({ success: false, error: 'Job not found' });
      }
      res.json({ success: true, data: job });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  public static async create(req: Request, res: Response) {
    try {
      const data = req.body;
      if (!data.role || !data.company) {
        return res.status(400).json({ success: false, error: 'Job role and company are required' });
      }

      const job: JobDescription = {
        id: data.id || `job-emp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        role: data.role,
        company: data.company,
        location: data.location || 'Bangalore, India',
        sourceType: data.sourceType || 'sample',
        source: data.source || 'Employer Portal',
        applicationType: data.applicationType || 'INTERNAL',
        applicationUrl: data.applicationUrl,
        applicationMethod: data.applicationMethod || (data.applicationType === 'EXTERNAL' ? 'External Website' : 'JobPilot Demo Simulation'),
        applicationMode: data.applicationMode || (data.applicationType === 'EXTERNAL' ? 'external' : 'demo'),
        openingsCount: data.openingsCount ? Number(data.openingsCount) : 1,
        department: data.department || 'Engineering',
        roleCategory: data.roleCategory || 'Software Development',
        screeningQuestions: Array.isArray(data.screeningQuestions) ? data.screeningQuestions : [],
        rating: data.rating !== undefined ? Number(data.rating) : 4.2,
        reviewsCount: data.reviewsCount !== undefined ? Number(data.reviewsCount) : 12,
        companyLogo: data.companyLogo || '',
        companyWebsite: data.companyWebsite || '',
        companySize: data.companySize || '500-1000 employees',
        companyHeadquarters: data.companyHeadquarters || 'Bangalore, Karnataka, India',
        companyFounded: data.companyFounded || '2015',
        companyDescription: data.companyDescription || `${data.company} is a leading enterprise providing innovative technology solutions.`,
        benefits: Array.isArray(data.benefits) ? data.benefits : ['Health Insurance', 'Flexible Working Hours', 'Performance Bonus', 'Learning Allowance'],
        employmentType: data.employmentType || 'Full-time',
        workMode: data.workMode || 'Hybrid',
        publishedDate: data.publishedDate || new Date().toISOString(),
        isExternal: data.applicationType === 'EXTERNAL',
        experienceRequired: data.experienceRequired || '2-5 years',
        salary: data.salary || '₹12,00,000 - ₹18,00,000 P.A.',
        careerTrack: data.careerTrack || 'Software Development',
        mustHaveSkills: Array.isArray(data.mustHaveSkills) ? data.mustHaveSkills : [],
        niceToHaveSkills: Array.isArray(data.niceToHaveSkills) ? data.niceToHaveSkills : [],
        responsibilities: Array.isArray(data.responsibilities) ? data.responsibilities : [],
        qualifications: Array.isArray(data.qualifications) ? data.qualifications : ["Bachelor's degree in Computer Science or related field"],
        rawText: data.rawText || `${data.role} at ${data.company}`,
        createdAt: new Date().toISOString()
      };

      const saved = await JobRepository.save(job);
      res.status(201).json({ success: true, message: 'Job created successfully', data: saved });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  public static async parseAndCreate(req: Request, res: Response) {
    try {
      const { rawText, sourceType, sourceUrl } = req.body;
      if (!rawText || !rawText.trim()) {
        return res.status(400).json({
          success: false,
          error: 'Empty job description provided. Unable to extract job details.'
        });
      }

      const job = await JobParserService.parseJobText(rawText, sourceType || 'pasted', sourceUrl);
      const saved = await JobRepository.save(job);
      res.json({ success: true, data: saved });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  public static async extractUrl(req: Request, res: Response) {
    try {
      const { url } = req.body;
      if (!url) {
        return res.status(400).json({ success: false, error: 'URL is required' });
      }

      // Check URL format
      try {
        new URL(url);
      } catch {
        return res.status(400).json({ success: false, error: 'Invalid URL format' });
      }

      // Attempt public fetch
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const resp = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 JobPilotAI/1.0'
        },
        signal: controller.signal
      }).catch(err => null);

      clearTimeout(timeoutId);

      if (!resp || !resp.ok) {
        return res.json({
          success: false,
          fallbackRequired: true,
          error: 'Unable to reliably extract this job page. Paste the job description instead.'
        });
      }

      const html = await resp.text();
      // Basic extraction of readable text
      const cleanText = html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (cleanText.length < 100) {
        return res.json({
          success: false,
          fallbackRequired: true,
          error: 'Unable to reliably extract this job page. Paste the job description instead.'
        });
      }

      const job = await JobParserService.parseJobText(cleanText.slice(0, 10000), 'url', url);
      const saved = await JobRepository.save(job);
      res.json({ success: true, data: saved });
    } catch (err: any) {
      res.json({
        success: false,
        fallbackRequired: true,
        error: 'Unable to reliably extract this job page. Paste the job description instead.'
      });
    }
  }

  public static async getSources(req: Request, res: Response) {
    try {
      const { JobSourceManager } = await import('../jobSources/index.js');
      const sources = JobSourceManager.getRegisteredSources();
      res.json({ success: true, data: sources });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  public static async syncSource(req: Request, res: Response) {
    try {
      const { sourceKey } = req.body;
      const { JobSourceManager } = await import('../jobSources/index.js');
      const result = await JobSourceManager.syncSource(sourceKey || 'codewalla');
      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
}

export class MatchController {
  public static async analyze(req: Request, res: Response) {
    try {
      const { candidateId, jobId } = req.body;
      if (!candidateId || !jobId) {
        return res.status(400).json({ success: false, error: 'Both candidateId and jobId are required' });
      }

      const candidate = await CandidateRepository.getById(candidateId);
      const job = await JobRepository.getById(jobId);

      if (!candidate || !job) {
        return res.status(404).json({ success: false, error: 'Candidate or Job not found' });
      }

      const analysis = await MatchingEngine.analyze(candidate, job);
      await MatchRepository.save(analysis);

      res.json({ success: true, data: analysis });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  public static async getByCandidateAndJob(req: Request, res: Response) {
    try {
      const candidateId = req.params.candidateId as string;
      const jobId = req.params.jobId as string;
      const analysis = await MatchRepository.getByCandidateAndJob(candidateId, jobId);
      if (!analysis) {
        return res.status(404).json({ success: false, error: 'No existing match analysis found' });
      }
      res.json({ success: true, data: analysis });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
}

export class ResumeController {
  public static async tailor(req: Request, res: Response) {
    try {
      const { candidateId, jobId, mode } = req.body;
      const candidate = await CandidateRepository.getById(candidateId);
      const job = await JobRepository.getById(jobId);

      if (!candidate || !job) {
        return res.status(404).json({ success: false, error: 'Candidate or Job not found' });
      }

      const truthCheck = MatchingEngine.performTruthCheck(candidate, job);
      const existingVersions = await ResumeRepository.getByCandidateAndJob(candidateId, jobId);
      const tailored = await ResumeTailorService.tailorResume(candidate, job, truthCheck, existingVersions.length, mode);

      // Deterministically calculate actual ATS score for the tailored resume (no artificial boost)
      const careerTrack = MatchingEngine.detectCareerTrack(candidate, job);
      const scores = MatchingEngine.calculateScores(candidate, job, truthCheck, careerTrack.isSameTrack);
      const atsRes = MatchingEngine.performATSAnalysis(candidate, job, truthCheck, scores);
      tailored.atsScore = atsRes.estimatedScore;

      await ResumeRepository.save(tailored);

      res.json({ success: true, data: tailored });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }


  public static async validate(req: Request, res: Response) {
    try {
      const { resumeId, candidateId } = req.body;
      let resume = await ResumeRepository.getById(resumeId);
      const candidate = await CandidateRepository.getById(candidateId);

      if (!resume || !candidate) {
        return res.status(404).json({ success: false, error: 'Resume or Candidate not found' });
      }

      const validation = ResumeTailorService.validateResumeForExport(resume, candidate);
      res.json({ success: true, data: validation });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  public static async saveVersion(req: Request, res: Response) {
    try {
      const { ResumeVersionRepository } = await import('../services/repositories.js');
      const versionData = req.body;
      if (!versionData.id) {
        versionData.id = `ver-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      }
      const saved = await ResumeVersionRepository.save(versionData);
      res.json({ success: true, data: saved });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  public static async getVersions(req: Request, res: Response) {
    try {
      const { ResumeVersionRepository } = await import('../services/repositories.js');
      const candidateId = req.params.candidateId as string;
      const versions = await ResumeVersionRepository.getByCandidateId(candidateId);
      res.json({ success: true, data: versions });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  public static async exportDocument(req: Request, res: Response) {
    try {
      const { resumeId, format = 'txt' } = req.body;
      const resume = await ResumeRepository.getById(resumeId);
      if (!resume) {
        return res.status(404).json({ success: false, error: 'Resume not found for export' });
      }

      const candidate = await CandidateRepository.getById(resume.candidateId);
      if (!candidate) {
        return res.status(404).json({ success: false, error: 'Candidate not found' });
      }

      // Generate cleanly formatted professional text representation
      const formattedDoc = [
        candidate.name.toUpperCase(),
        candidate.headline || `${resume.targetRole} Professional`,
        `${candidate.email} | ${candidate.phone} | ${candidate.location}`,
        [candidate.linkedInUrl, candidate.gitHubUrl].filter(Boolean).join(' | '),
        '',
        'PROFESSIONAL SUMMARY',
        '--------------------',
        resume.tailoredSummary,
        '',
        'TECHNICAL SKILLS',
        '----------------',
        resume.orderedSkills.join(', '),
        '',
        'PROFESSIONAL EXPERIENCE',
        '-----------------------',
        ...resume.experiences.map(exp => [
          `${exp.title.toUpperCase()} — ${exp.company}`,
          `${exp.startDate} - ${exp.endDate} (${exp.duration || 'Relevant Experience'})`,
          ...(exp.responsibilities || exp.highlights || []).map(r => `  • ${r}`),
          ''
        ].join('\n')),
        'EDUCATION',
        '---------',
        ...(resume.education || candidate.education || []).map(edu =>
          `  • ${edu.degree} — ${edu.institution} (${edu.year || ''})`
        ),
        '',
        'CERTIFICATIONS & CREDENTIALS',
        '----------------------------',
        ...(resume.certifications && resume.certifications.length > 0 ? resume.certifications : (candidate.certifications || [])).map(c =>
          `  • ${c}`
        )
      ].filter(line => line !== undefined).join('\n');

      res.json({
        success: true,
        data: {
          resumeId: resume.id,
          versionName: resume.versionName,
          format,
          content: formattedDoc,
          filename: `${candidate.name.replace(/\s+/g, '_')}_${resume.versionName}.${format}`
        }
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  public static async getById(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const resume = await ResumeRepository.getById(id);
      if (!resume) {
        return res.status(404).json({ success: false, error: 'Tailored resume not found' });
      }

      // Ensure summary never has target company leaks and deduplicate skills
      let updated = false;
      if (resume.targetCompany && (resume.tailoredSummary.includes('tailored for') || resume.tailoredSummary.includes('delivering solutions for'))) {
        resume.tailoredSummary = `Results-driven ${resume.targetRole} with proven engineering experience specializing in ${resume.orderedSkills.slice(0, 5).join(', ')}. Adept at designing robust solutions, driving cross-team collaboration, and delivering resilient enterprise systems.`;
        resume.targetCompanyLeakDetected = false;
        updated = true;
      }

      if (resume.modifications) {
        for (const mod of resume.modifications) {
          if (mod.tailored && (mod.tailored.includes('tailored for') || mod.tailored.includes('delivering solutions for'))) {
            mod.tailored = `Results-driven ${resume.targetRole} with proven engineering experience specializing in core competencies. Adept at designing robust solutions, driving cross-team collaboration, and delivering resilient enterprise systems.`;
            updated = true;
          }
        }
      }

      if (resume.orderedSkills) {
        const uniqueSkills = Array.from(new Set(resume.orderedSkills));
        if (uniqueSkills.length !== resume.orderedSkills.length) {
          resume.orderedSkills = uniqueSkills;
          updated = true;
        }
      }

      if (updated) {
        await ResumeRepository.save(resume);
      }

      res.json({ success: true, data: resume });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  public static async getAll(req: Request, res: Response) {
    try {
      const resumes = await ResumeRepository.getAll();
      // Sanitize summaries and deduplicate skills for any legacy resumes
      for (const resume of resumes) {
        let updated = false;
        if (resume.targetCompany && (resume.tailoredSummary.includes('tailored for') || resume.tailoredSummary.includes('delivering solutions for'))) {
          resume.tailoredSummary = `Results-driven ${resume.targetRole} with proven engineering experience specializing in ${resume.orderedSkills.slice(0, 5).join(', ')}. Adept at designing robust solutions, driving cross-team collaboration, and delivering resilient enterprise systems.`;
          resume.targetCompanyLeakDetected = false;
          updated = true;
        }

        if (resume.modifications) {
          for (const mod of resume.modifications) {
            if (mod.tailored && (mod.tailored.includes('tailored for') || mod.tailored.includes('delivering solutions for'))) {
              mod.tailored = `Results-driven ${resume.targetRole} with proven engineering experience specializing in core competencies. Adept at designing robust solutions, driving cross-team collaboration, and delivering resilient enterprise systems.`;
              updated = true;
            }
          }
        }

        if (resume.orderedSkills) {
          const uniqueSkills = Array.from(new Set(resume.orderedSkills));
          if (uniqueSkills.length !== resume.orderedSkills.length) {
            resume.orderedSkills = uniqueSkills;
            updated = true;
          }
        }

        if (updated) {
          await ResumeRepository.save(resume);
        }
      }
      res.json({ success: true, data: resumes });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
}

export class ApplicationController {
  public static async getAll(req: Request, res: Response) {
    try {
      const candidateId = req.query.candidateId as string | undefined;
      const apps = await ApplicationRepository.getAll(candidateId);
      res.json({ success: true, data: apps });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  public static async getById(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const app = await ApplicationRepository.getById(id);
      if (!app) {
        return res.status(404).json({ success: false, error: 'Application record not found' });
      }

      // Fetch linked job, resume, and candidate for complete rich view
      const job = await JobRepository.getById(app.jobId);
      const tailoredResume = app.resumeVersionId ? await ResumeRepository.getById(app.resumeVersionId) : null;
      const candidate = await CandidateRepository.getById(app.candidateId);
      const matchAnalysis = await MatchRepository.getByCandidateAndJob(app.candidateId, app.jobId);

      res.json({
        success: true,
        data: {
          application: app,
          job,
          tailoredResume,
          candidate,
          matchAnalysis
        }
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  public static async createOrUpdate(req: Request, res: Response) {
    try {
      const body: Partial<ApplicationRecord> = req.body;
      const now = new Date().toISOString();

      if (!body.candidateId || !body.jobId) {
        return res.status(400).json({ success: false, error: 'candidateId and jobId are required' });
      }

      // Check duplicate application unless it's an update to an existing application by ID
      if (!body.id) {
        const existingApps = await ApplicationRepository.getAll(body.candidateId);
        const duplicate = existingApps.find(a => a.jobId === body.jobId);
        if (duplicate) {
          return res.status(409).json({
            success: false,
            isDuplicate: true,
            error: 'You have already applied for this job.',
            data: duplicate
          });
        }
      }

      // Determine application mode from job if available
      const job = await JobRepository.getById(body.jobId);
      const isCodewalla = (job?.company && job.company.toLowerCase().includes('codewalla')) || (body.company && body.company.toLowerCase().includes('codewalla'));
      const determinedMode: 'demo' | 'external' = isCodewalla
        ? 'demo'
        : (body.applicationMode || job?.applicationMode || 'demo');

      const app: ApplicationRecord = {
        id: body.id || `app-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        candidateId: body.candidateId,
        jobId: body.jobId,
        resumeVersionId: body.resumeVersionId || '',
        resumeVersionName: body.resumeVersionName || '',
        company: body.company || job?.company || 'Unknown Company',
        role: body.role || job?.role || 'Software Engineer',
        location: body.location || job?.location || '',
        applicationMode: determinedMode,
        jobUrl: body.jobUrl || job?.sourceUrl || '',
        applicationUrl: determinedMode === 'external' ? (body.applicationUrl || job?.applicationUrl || '') : undefined,
        matchScore: body.matchScore || 0,
        atsScore: body.atsScore || 0,
        status: body.status || (determinedMode === 'demo' ? 'APPLIED_DEMO' : 'APPLICATION_STARTED'),
        applicationDate: body.applicationDate || now.split('T')[0],
        appliedAt: body.appliedAt || now,
        notes: body.notes || '',
        customAnswers: body.customAnswers || {},
        skillGaps: body.skillGaps || [],
        timeline: body.timeline || [
          { timestamp: now, stage: 'Application Created', description: `Application initialized in ${determinedMode.toUpperCase()} mode.` }
        ],
        coverLetter: body.coverLetter || '',
        createdAt: body.createdAt || now,
        updatedAt: now
      };

      const saved = await ApplicationRepository.save(app);
      res.json({ success: true, data: saved });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  public static async delete(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      await ApplicationRepository.delete(id);
      res.json({ success: true, message: 'Application deleted' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  public static async deleteByCandidateAndJob(req: Request, res: Response) {
    try {
      const { candidateId, jobId } = req.query as { candidateId: string; jobId: string };
      if (!candidateId || !jobId) {
        return res.status(400).json({ success: false, error: 'candidateId and jobId are required' });
      }
      await ApplicationRepository.deleteByCandidateAndJob(candidateId, jobId);
      res.json({ success: true, message: 'Application reset' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * TYPE A: Candidate Applies Directly to Internal Job
   */
  public static async applyInternal(req: Request, res: Response) {
    try {
      const { candidateId, jobId, resumeVersionId, resumeVersionName, screeningAnswers, notes } = req.body;
      if (!candidateId || !jobId) {
        return res.status(400).json({ success: false, error: 'candidateId and jobId are required' });
      }

      const job = await JobRepository.getById(jobId);
      if (!job) {
        return res.status(404).json({ success: false, error: 'Job not found' });
      }

      const candidate = await CandidateRepository.getById(candidateId);
      if (!candidate) {
        return res.status(404).json({ success: false, error: 'Candidate profile not found' });
      }

      const now = new Date().toISOString();
      const existing = (await ApplicationRepository.getAll(candidateId)).find(a => a.jobId === jobId);
      if (existing) {
        return res.status(409).json({
          success: false,
          isDuplicate: true,
          message: 'You have already submitted an application for this position.',
          data: existing
        });
      }

      // Calculate initial match score if possible
      let matchScore = 85;
      try {
        const analysis = await MatchingEngine.analyze(candidate, job);
        matchScore = analysis.scores.overallScore;
      } catch {}

      const application: ApplicationRecord = {
        id: `app-int-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        candidateId,
        jobId,
        company: job.company,
        role: job.role,
        location: job.location,
        applicationType: 'INTERNAL',
        applicationMode: 'demo',
        status: 'Submitted' as any,
        matchScore,
        resumeVersionId: resumeVersionId || undefined,
        resumeVersionName: resumeVersionName || 'Master Resume',
        candidateName: candidate.name,
        candidateEmail: candidate.email,
        candidatePhone: candidate.phone,
        candidateLocation: candidate.location,
        candidateExperience: candidate.yearsOfExperience,
        candidateDesignation: candidate.headline || (candidate.targetRoles && candidate.targetRoles[0]) || 'Applicant',
        applicationDate: now.split('T')[0],
        appliedAt: now,
        notes: notes || '',
        screeningAnswers: screeningAnswers || {},
        statusHistory: [
          { status: 'Submitted', changedAt: now, note: 'Direct candidate application submitted on JobPilot' }
        ],
        timeline: [
          { timestamp: now, stage: 'Submitted', description: 'Application delivered directly to employer dashboard.' }
        ],
        createdAt: now,
        updatedAt: now
      };

      const saved = await ApplicationRepository.save(application);
      res.status(201).json({
        success: true,
        message: 'Your application has been successfully submitted to the employer.',
        data: saved
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * TYPE B: Candidate Tracks External Application
   */
  public static async trackExternal(req: Request, res: Response) {
    try {
      const { candidateId, jobId, action, notes, reminderDate, followCompany } = req.body;
      if (!candidateId || !jobId) {
        return res.status(400).json({ success: false, error: 'candidateId and jobId are required' });
      }

      const job = await JobRepository.getById(jobId);
      if (!job) {
        return res.status(404).json({ success: false, error: 'Job not found' });
      }

      const candidate = await CandidateRepository.getById(candidateId);
      const now = new Date().toISOString();

      // If user selected "Follow this company", register follow intent
      if (followCompany && job.company) {
        const { FollowedCompanyRepository } = await import('../services/repositories.js');
        await FollowedCompanyRepository.follow(candidateId, job.company);
      }

      // Check existing application record
      let app = (await ApplicationRepository.getAll(candidateId)).find(a => a.jobId === jobId);

      if (action === 'CLICKED_LINK') {
        // Link clicked -> DOES NOT mark as applied. Sets status to 'Ready to Apply'
        if (!app) {
          app = {
            id: `app-ext-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            candidateId,
            jobId,
            company: job.company,
            role: job.role,
            location: job.location,
            applicationType: 'EXTERNAL',
            applicationMode: 'external',
            applicationUrl: job.applicationUrl || job.sourceUrl,
            status: 'Ready to Apply' as any,
            matchScore: 80,
            candidateName: candidate?.name,
            candidateEmail: candidate?.email,
            candidatePhone: candidate?.phone,
            applicationDate: now.split('T')[0],
            notes: notes || 'Redirected to external career page.',
            statusHistory: [
              { status: 'Ready to Apply', changedAt: now, note: 'External career link opened in new tab' }
            ],
            timeline: [
              { timestamp: now, stage: 'Redirected to Company Site', description: 'Application link opened on official company website.' }
            ],
            createdAt: now,
            updatedAt: now
          };
          await ApplicationRepository.save(app);
        }
        return res.json({ success: true, data: app, redirected: true });
      }

      if (action === 'CONFIRMED_APPLIED') {
        // Candidate returns and explicitly confirms they submitted on external site
        const statusHistory = app?.statusHistory || [];
        statusHistory.push({
          status: 'Applied',
          changedAt: now,
          note: notes || 'Candidate confirmed manual application submission on employer career website.'
        });

        const timeline = app?.timeline || [];
        timeline.push({
          timestamp: now,
          stage: 'Applied on External Site',
          description: 'Candidate confirmed application was completed.'
        });

        const updatedApp: ApplicationRecord = {
          id: app?.id || `app-ext-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          candidateId,
          jobId,
          company: job.company,
          role: job.role,
          location: job.location,
          applicationType: 'EXTERNAL',
          applicationMode: 'external',
          applicationUrl: job.applicationUrl || job.sourceUrl,
          status: 'Applied' as any,
          matchScore: app?.matchScore || 80,
          candidateName: candidate?.name,
          candidateEmail: candidate?.email,
          candidatePhone: candidate?.phone,
          applicationDate: now.split('T')[0],
          appliedAt: now,
          notes: notes || app?.notes || 'Applied on company website.',
          statusHistory,
          timeline,
          createdAt: app?.createdAt || now,
          updatedAt: now
        };

        const saved = await ApplicationRepository.save(updatedApp);
        return res.json({ success: true, data: saved, message: 'External application confirmed and logged in your tracker.' });
      }

      if (action === 'REQUESTED_EMAIL') {
        // Candidate requested job details in email to apply later
        return res.json({
          success: true,
          message: `Job opportunity details sent to ${candidate?.email || 'your email'}. You can apply whenever you are ready.`
        });
      }

      res.status(400).json({ success: false, error: 'Invalid tracking action' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * Employer Updates Application Status (Submitted, Viewed, Under Review, Shortlisted, Interview Scheduled, Selected, Rejected)
   */
  public static async updateStatusByEmployer(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const { status, employerNotes, interviewDetails } = req.body;

      const app = await ApplicationRepository.getById(id);
      if (!app) {
        return res.status(404).json({ success: false, error: 'Application not found' });
      }

      const now = new Date().toISOString();
      const statusHistory = app.statusHistory || [];
      statusHistory.push({
        status,
        changedAt: now,
        note: employerNotes || `Application status updated to ${status}`
      });

      const timeline = app.timeline || [];
      timeline.push({
        timestamp: now,
        stage: status,
        description: employerNotes || `Employer updated status to ${status}.`
      });

      const updated: ApplicationRecord = {
        ...app,
        status: status as any,
        employerNotes: employerNotes !== undefined ? employerNotes : app.employerNotes,
        interviewDetails: interviewDetails !== undefined ? interviewDetails : app.interviewDetails,
        statusHistory,
        timeline,
        updatedAt: now
      };

      const saved = await ApplicationRepository.save(updated);
      res.json({ success: true, data: saved });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * Employer Fetches Applicants
   */
  public static async getEmployerApplicants(req: Request, res: Response) {
    try {
      const companyOrEmployerId = String(req.query.company || req.query.employerId || '');
      const apps = await ApplicationRepository.getByEmployerOrCompany(companyOrEmployerId);
      res.json({ success: true, data: apps });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
}

export class InterviewController {
  public static async generate(req: Request, res: Response) {
    try {
      const { candidateId, jobId, resumeVersionId } = req.body;
      const candidate = await CandidateRepository.getById(candidateId);
      const job = await JobRepository.getById(jobId);

      if (!candidate || !job) {
        return res.status(404).json({ success: false, error: 'Candidate or Job not found' });
      }

      const tailoredResume = resumeVersionId ? await ResumeRepository.getById(resumeVersionId) : undefined;
      const prep = await InterviewPrepService.generatePreparation(candidate, job, tailoredResume || undefined);

      await InterviewPrepRepository.save(prep);

      res.json({ success: true, data: prep });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  public static async getByCandidateAndJob(req: Request, res: Response) {
    try {
      const candidateId = req.params.candidateId as string;
      const jobId = req.params.jobId as string;
      const prep = await InterviewPrepRepository.getByCandidateAndJob(candidateId, jobId);
      if (!prep) {
        return res.status(404).json({ success: false, error: 'Interview preparation not generated yet' });
      }
      res.json({ success: true, data: prep });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
}

export class CompanyController {
  public static async getAll(req: Request, res: Response) {
    try {
      const { CompanyRepository } = await import('../services/repositories.js');
      const companies = await CompanyRepository.getAll();
      res.json({ success: true, data: companies });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  public static async getReviews(req: Request, res: Response) {
    try {
      const companyName = (req.params.companyName || req.query.company || '') as string;
      const { CompanyReviewRepository } = await import('../services/repositories.js');
      const reviews = await CompanyReviewRepository.getAll(companyName || undefined);
      res.json({ success: true, data: reviews });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  public static async submitReview(req: Request, res: Response) {
    try {
      const { companyName, reviewerName, reviewerRole, rating, title, reviewText, pros, cons, workCultureRating, salaryBenefitsRating, careerGrowthRating, workLifeBalanceRating, employmentStatus } = req.body;
      if (!companyName || !reviewerName || !title || !rating) {
        return res.status(400).json({ success: false, error: 'companyName, reviewerName, title, and rating are required' });
      }

      const { CompanyReviewRepository } = await import('../services/repositories.js');
      const review = await CompanyReviewRepository.save({
        id: `rev-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        companyName,
        reviewerName,
        reviewerRole: reviewerRole || 'Software Professional',
        rating: Number(rating),
        title,
        reviewText: reviewText || '',
        pros: pros || '',
        cons: cons || '',
        workCultureRating: Number(workCultureRating || rating),
        salaryBenefitsRating: Number(salaryBenefitsRating || rating),
        careerGrowthRating: Number(careerGrowthRating || rating),
        workLifeBalanceRating: Number(workLifeBalanceRating || rating),
        employmentStatus: employmentStatus || 'Current Employee',
        isVerified: true,
        createdAt: new Date().toISOString()
      });

      res.status(201).json({ success: true, message: 'Review submitted successfully', data: review });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  public static async followCompany(req: Request, res: Response) {
    try {
      const { candidateId, companyName } = req.body;
      if (!candidateId || !companyName) {
        return res.status(400).json({ success: false, error: 'candidateId and companyName are required' });
      }
      const { FollowedCompanyRepository } = await import('../services/repositories.js');
      await FollowedCompanyRepository.follow(candidateId, companyName);
      res.json({ success: true, message: `You are now following ${companyName}` });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  public static async unfollowCompany(req: Request, res: Response) {
    try {
      const { candidateId, companyName } = req.body;
      if (!candidateId || !companyName) {
        return res.status(400).json({ success: false, error: 'candidateId and companyName are required' });
      }
      const { FollowedCompanyRepository } = await import('../services/repositories.js');
      await FollowedCompanyRepository.unfollow(candidateId, companyName);
      res.json({ success: true, message: `Unfollowed ${companyName}` });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  public static async getFollowedCompanies(req: Request, res: Response) {
    try {
      const candidateId = (req.params.candidateId || req.query.candidateId || '') as string;
      const { FollowedCompanyRepository } = await import('../services/repositories.js');
      const list = await FollowedCompanyRepository.getByCandidateId(candidateId);
      res.json({ success: true, data: list });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
}

export class JobAlertController {
  public static async listAlerts(req: Request, res: Response) {
    try {
      const candidateId = (req.query.candidateId || '') as string;
      const { JobAlertRepository } = await import('../services/repositories.js');
      const alerts = await JobAlertRepository.getByCandidateId(candidateId);
      res.json({ success: true, data: alerts });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  public static async createAlert(req: Request, res: Response) {
    try {
      const { candidateId, title, keywords, location, experienceMin, experienceMax, salaryMin, frequency } = req.body;
      if (!candidateId || !title) {
        return res.status(400).json({ success: false, error: 'candidateId and title are required' });
      }
      const { JobAlertRepository } = await import('../services/repositories.js');
      const alert = await JobAlertRepository.save({
        id: `alert-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        candidateId,
        title,
        keywords: keywords || '',
        location: location || '',
        experienceMin: experienceMin ? Number(experienceMin) : undefined,
        experienceMax: experienceMax ? Number(experienceMax) : undefined,
        salaryMin: salaryMin || '',
        frequency: frequency || 'Daily',
        isActive: true,
        createdAt: new Date().toISOString()
      });
      res.status(201).json({ success: true, message: 'Job alert created successfully', data: alert });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  public static async deleteAlert(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const { JobAlertRepository } = await import('../services/repositories.js');
      await JobAlertRepository.delete(id);
      res.json({ success: true, message: 'Job alert removed' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
}

export class StrategyController {
  public static async getStrategy(req: Request, res: Response) {
    try {
      const { candidateId, jobId } = req.body;
      const candidate = await CandidateRepository.getById(candidateId);
      const job = await JobRepository.getById(jobId);
      if (!candidate || !job) {
        return res.status(404).json({ success: false, error: 'Candidate or Job not found' });
      }

      const { ResumeStrategyRepository } = await import('../services/repositories.js');
      const existing = await ResumeStrategyRepository.getByCandidateAndJob(candidateId, jobId);
      if (existing) {
        return res.json({ success: true, data: existing });
      }

      const { ResumeStrategyEngine } = await import('../analyzers/strategy.engine.js');
      const truthCheck = MatchingEngine.performTruthCheck(candidate, job);
      const track = MatchingEngine.detectCareerTrack(candidate, job);
      const strategy = ResumeStrategyEngine.evaluateStrategy(candidate, job, truthCheck, track.isSameTrack);

      const saved = await ResumeStrategyRepository.save({
        id: `strat-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        candidateId,
        jobId,
        ...strategy,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      res.json({ success: true, data: saved });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
}

export class LearningController {
  public static async getSkillGaps(req: Request, res: Response) {
    try {
      const candidateId = req.query.candidateId as string;
      const candidate = await CandidateRepository.getById(candidateId);
      const jobs = await JobRepository.getAll();
      if (!candidate) {
        return res.status(404).json({ success: false, error: 'Candidate not found' });
      }

      const { SkillGapEngine } = await import('../analyzers/skillGap.engine.js');
      const gaps = SkillGapEngine.calculateGaps(candidate, jobs);
      res.json({ success: true, data: gaps });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  public static async getResources(req: Request, res: Response) {
    try {
      const skill = (req.query.skill as string) || 'Playwright';
      const lang = req.query.language as string;
      const { LearningRepository } = await import('../services/repositories.js');
      const resources = await LearningRepository.getResourcesForSkill(skill, lang);
      res.json({ success: true, data: resources });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  public static async getInstitutes(req: Request, res: Response) {
    try {
      const city = (req.query.city as string) || 'Chennai';
      const skill = req.query.skill as string;
      const { LearningRepository } = await import('../services/repositories.js');
      const institutes = await LearningRepository.getLocalInstitutes(city, skill);
      res.json({ success: true, data: institutes });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  public static async getSourceHealth(req: Request, res: Response) {
    try {
      const { JobSourceManager } = await import('../jobSources/index.js');
      const health = JobSourceManager.getSourceHealth();
      res.json({ success: true, data: health });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
}

