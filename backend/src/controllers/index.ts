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
      const { candidateId, jobId } = req.body;
      const candidate = await CandidateRepository.getById(candidateId);
      const job = await JobRepository.getById(jobId);

      if (!candidate || !job) {
        return res.status(404).json({ success: false, error: 'Candidate or Job not found' });
      }

      const truthCheck = MatchingEngine.performTruthCheck(candidate, job);
      const existingVersions = await ResumeRepository.getByCandidateAndJob(candidateId, jobId);
      const tailored = await ResumeTailorService.tailorResume(candidate, job, truthCheck, existingVersions.length);

      await ResumeRepository.save(tailored);

      res.json({ success: true, data: tailored });
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
      res.json({ success: true, data: resume });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  public static async getAll(req: Request, res: Response) {
    try {
      const resumes = await ResumeRepository.getAll();
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

      const app: ApplicationRecord = {
        id: body.id || `app-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        candidateId: body.candidateId!,
        jobId: body.jobId!,
        resumeVersionId: body.resumeVersionId || '',
        resumeVersionName: body.resumeVersionName || '',
        company: body.company || 'Unknown Company',
        role: body.role || 'Software Engineer',
        location: body.location || '',
        jobUrl: body.jobUrl || '',
        matchScore: body.matchScore || 0,
        status: body.status || 'Saved',
        applicationDate: body.applicationDate || now.split('T')[0],
        notes: body.notes || '',
        customAnswers: body.customAnswers || {},
        createdAt: body.createdAt || now,
        updatedAt: now
      };

      const saved = await ApplicationRepository.save(app);
      res.json({ success: true, data: saved });
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
