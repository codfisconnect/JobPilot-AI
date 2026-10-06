import crypto from 'crypto';
import { prisma } from '../database/prisma.js';
import { CandidateProfileRepository } from '../repositories/candidateProfile.repository.js';
import { NotFoundError } from '../utils/errors.js';
import { LearningRepository } from './repositories.js';
import { ResumeTailorService } from '../generators/resume.generator.js';
import { aiProvider } from '../ai/index.js';
import type { MatchCategory } from '@prisma/client';

export interface SkillMatchItem {
  skill: string;
  status: 'VERIFIED' | 'PARTIAL' | 'MISSING';
  evidence: string;
  note: string;
  priority?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface MatchBreakdown {
  skillScore: number;
  experienceScore: number;
  roleScore: number;
  locationScore: number;
  seniorityScore: number;
}

export interface CareerTrackFit {
  candidateTrack: string;
  jobTrack: string;
  isSameTrack: boolean;
  transitionPossible: boolean;
  transitionGapExplanation?: string;
}

export interface ATSAnalysisResult {
  estimatedScore: number;
  breakdown: {
    keywordMatch: number;
    formattingScore: number;
    structureScore: number;
    roleAlignmentScore: number;
  };
  disclaimer: string;
}

export class ProductionMatchingService {
  /**
   * Deterministic Career Track Detector
   */
  public static detectCareerTrack(targetRole: string, jobTitle: string, jobTrack?: string): CareerTrackFit {
    const candRole = (targetRole || 'Software Engineer').toLowerCase();
    const jobRoleOrTrack = (jobTrack || jobTitle || 'Software Engineer').toLowerCase();

    const normalize = (t: string) => {
      if (/project\s*manager|delivery|program\s*manager|scrum\s*master|agile/i.test(t)) return 'Project & Delivery Management';
      if (/qa|automation|test|sdet/i.test(t)) return 'QA Automation';
      if (/backend|java|spring/i.test(t)) return 'Backend Engineering';
      if (/full\s*stack/i.test(t)) return 'Full Stack Development';
      if (/data|analyst|analytics|bi/i.test(t)) return 'Data Analytics';
      if (/devops|cloud|sre/i.test(t)) return 'DevOps / Cloud';
      return 'Software Engineering';
    };

    const candNormalized = normalize(candRole);
    const jobNormalized = normalize(jobRoleOrTrack);

    if (candNormalized === jobNormalized) {
      return {
        candidateTrack: candNormalized,
        jobTrack: jobNormalized,
        isSameTrack: true,
        transitionPossible: true
      };
    }

    let transitionPossible = false;
    let transitionGapExplanation = `Cross-domain transition from ${candNormalized} to ${jobNormalized}. Distinct domain expertise required.`;

    if (candNormalized === 'QA Automation' && jobNormalized === 'Backend Engineering') {
      transitionPossible = true;
      transitionGapExplanation = 'Candidate has foundational programming skills (Java/Python) but requires deep system architecture and database optimization evidence.';
    } else if (candNormalized === 'Backend Engineering' && jobNormalized === 'Full Stack Development') {
      transitionPossible = true;
      transitionGapExplanation = 'Strong backend architecture competency; frontend reactive UI frameworks gap.';
    }

    return {
      candidateTrack: candNormalized,
      jobTrack: jobNormalized,
      isSameTrack: false,
      transitionPossible,
      transitionGapExplanation
    };
  }

  /**
   * Related ecosystem knowledge map
   */
  private static findRelatedSkill(jobSkill: string, candidateSkillsSet: Set<string>): string | null {
    const relatedMap: Record<string, string[]> = {
      'playwright': ['selenium', 'cypress'],
      'selenium': ['playwright', 'cypress'],
      'cypress': ['selenium', 'playwright'],
      'testng': ['junit'],
      'junit': ['testng'],
      'postgresql': ['mysql', 'sql', 'sqlite', 'oracle'],
      'mysql': ['postgresql', 'sql'],
      'kafka': ['rabbitmq', 'sqs', 'pubsub'],
      'react': ['vue', 'angular', 'javascript', 'typescript'],
      'typescript': ['javascript'],
      'docker': ['kubernetes', 'jenkins', 'ci/cd'],
      'power bi': ['tableau', 'excel', 'sql'],
      'tableau': ['power bi', 'excel', 'sql']
    };

    const targets = relatedMap[jobSkill.toLowerCase()] || [];
    for (const t of targets) {
      if (candidateSkillsSet.has(t)) return t;
    }
    return null;
  }

  /**
   * Deterministic Truth & Skill Classification Check
   */
  public static evaluateSkillEvidence(
    candidateSkills: string[],
    jobRequiredSkills: string[],
    jobPreferredSkills: string[] = []
  ): {
    items: SkillMatchItem[];
    greenCount: number;
    yellowCount: number;
    redCount: number;
  } {
    const candidateSet = new Set(candidateSkills.map(s => s.toLowerCase().trim()));
    const allSkills = Array.from(new Set([...jobRequiredSkills, ...jobPreferredSkills]));

    const items: SkillMatchItem[] = [];
    let greenCount = 0;
    let yellowCount = 0;
    let redCount = 0;

    for (const skill of allSkills) {
      const lower = skill.toLowerCase().trim();
      if (candidateSet.has(lower)) {
        greenCount++;
        items.push({
          skill,
          status: 'VERIFIED',
          evidence: 'Verified in candidate master profile & skills',
          note: `Candidate has verified hands-on background in ${skill}.`,
          priority: 'LOW'
        });
      } else {
        const related = this.findRelatedSkill(lower, candidateSet);
        if (related) {
          yellowCount++;
          items.push({
            skill,
            status: 'PARTIAL',
            evidence: `Adjacent knowledge in related ecosystem: ${related}`,
            note: 'Found exposure to adjacent tools. Candidate can easily transition or learn.',
            priority: 'MEDIUM'
          });
        } else {
          redCount++;
          items.push({
            skill,
            status: 'MISSING',
            evidence: 'No record found in candidate master profile',
            note: 'Strict rule: Will NOT be fabricated on tailored resume.',
            priority: jobRequiredSkills.includes(skill) ? 'CRITICAL' : 'HIGH'
          });
        }
      }
    }

    return { items, greenCount, yellowCount, redCount };
  }

  /**
   * Deterministic Score Calculation
   */
  public static calculateScores(
    yearsOfExperience: number,
    candidateLocation: string,
    workPreference: string,
    preferredLocations: string[],
    jobExpMin: number | null,
    jobLocation: string,
    isRemoteJob: boolean,
    isSameTrack: boolean,
    greenCount: number,
    yellowCount: number,
    totalRequirements: number
  ): { scores: MatchBreakdown; overallScore: number; category: MatchCategory } {
    // 1. Technical Skills Score (Weight 40%)
    const skillRatio = totalRequirements > 0
      ? (greenCount * 1.0 + yellowCount * 0.6) / totalRequirements
      : 1.0;
    const skillScore = Math.min(100, Math.round(skillRatio * 100));

    // 2. Experience Score (Weight 25%)
    const reqYears = jobExpMin || 3;
    let experienceScore = 90;
    if (yearsOfExperience >= reqYears) {
      experienceScore = Math.min(100, 90 + Math.round((yearsOfExperience - reqYears) * 3));
    } else {
      const deficit = reqYears - yearsOfExperience;
      experienceScore = Math.max(40, 90 - Math.round(deficit * 15));
    }

    // 3. Role Fit (Weight 20%)
    const roleScore = isSameTrack ? 96 : 58;

    // 4. Location Fit (Weight 10%)
    const candLoc = (candidateLocation || '').toLowerCase();
    const jLoc = (jobLocation || '').toLowerCase();
    const isRemote = isRemoteJob || jLoc.includes('remote') || workPreference === 'Remote';
    const locMatch = isRemote || (candLoc && (jLoc.includes(candLoc) || candLoc.includes(jLoc))) || preferredLocations.some(l => jLoc.includes(l.toLowerCase()));
    const locationScore = locMatch ? 98 : 72;

    // 5. Seniority Fit (Weight 5%)
    const seniorityScore = Math.min(100, Math.max(50, Math.round((experienceScore * 0.7) + (roleScore * 0.3))));

    // Overall Weighted Score
    const overallScore = Math.round(
      skillScore * 0.4 +
      experienceScore * 0.25 +
      roleScore * 0.2 +
      locationScore * 0.1 +
      seniorityScore * 0.05
    );

    // Deriving Category
    let category: MatchCategory = 'LOW_MATCH';
    if (overallScore >= 90) {
      category = 'STRONG_MATCH';
    } else if (overallScore >= 75) {
      category = 'GOOD_MATCH';
    } else if (overallScore >= 50) {
      category = 'PARTIAL_MATCH';
    }

    return {
      scores: {
        skillScore,
        experienceScore,
        roleScore,
        locationScore,
        seniorityScore
      },
      overallScore,
      category
    };
  }

  /**
   * Deterministic ATS Analysis
   */
  public static performATSAnalysis(
    greenKeywords: string[],
    totalKeywords: number,
    roleScore: number,
    experienceScore: number,
    skillScore: number
  ): ATSAnalysisResult {
    const keywordMatch = Math.round((greenKeywords.length / Math.max(1, totalKeywords)) * 100);
    const estimatedScore = Math.round(
      keywordMatch * 0.35 +
      roleScore * 0.25 +
      experienceScore * 0.2 +
      skillScore * 0.2
    );

    return {
      estimatedScore,
      breakdown: {
        keywordMatch,
        formattingScore: 92,
        structureScore: 94,
        roleAlignmentScore: roleScore
      },
      disclaimer: 'Estimated ATS Match based on keyword presence, role alignment, and structural standards. Scoring algorithms differ across employer ATS platforms.'
    };
  }

  /**
   * Compute Input Hash for Deterministic Match Caching
   */
  public static computeInputHash(
    candidateUpdated: Date,
    skillCount: number,
    experienceCount: number,
    jobContentHash: string
  ): string {
    const raw = `${candidateUpdated.toISOString()}_${skillCount}_${experienceCount}_${jobContentHash}_v1.0.0`;
    return crypto.createHash('sha256').update(raw).digest('hex').substring(0, 32);
  }

  /**
   * Main Match Analysis Entrypoint: Checks Database Cache -> Computes -> Persists
   */
  public static async analyzeFit(userId: string, jobId: string, forceRecalculate = false) {
    const profile = await CandidateProfileRepository.findByUserId(userId);
    if (!profile) {
      throw new NotFoundError('Candidate profile not found');
    }

    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        company: true,
        skills: { include: { skill: true } }
      }
    });

    if (!job) {
      throw new NotFoundError('Job opening not found');
    }

    const candidateSkillNames = profile.skills.map(s => s.skill.name);
    const jobRequiredSkills = job.skills.filter(s => s.skillType === 'REQUIRED').map(s => s.skill.name);
    const jobPreferredSkills = job.skills.filter(s => s.skillType === 'PREFERRED').map(s => s.skill.name);

    // Fallback: If job has no tagged skills yet, extract from requirements
    const effectiveRequired = jobRequiredSkills.length > 0 ? jobRequiredSkills : job.requirements.slice(0, 8);
    const effectivePreferred = jobPreferredSkills.length > 0 ? jobPreferredSkills : job.preferredQualifications.slice(0, 5);

    // Compute input cache key
    const inputHash = this.computeInputHash(
      profile.updatedAt,
      candidateSkillNames.length,
      profile.experiences.length,
      job.contentHash
    );

    // Check DB cache
    if (!forceRecalculate) {
      const cached = await prisma.jobMatch.findUnique({
        where: {
          candidateProfileId_jobId_inputHash: {
            candidateProfileId: profile.id,
            jobId: job.id,
            inputHash
          }
        }
      });

      if (cached) {
        return {
          id: cached.id,
          jobId: cached.jobId,
          candidateProfileId: cached.candidateProfileId,
          overallScore: cached.overallScore,
          category: cached.category,
          breakdown: cached.breakdown as any,
          truthCheck: cached.truthCheck as any,
          careerTrack: cached.careerTrack as any,
          atsAnalysis: cached.atsAnalysis as any,
          isCached: true,
          createdAt: cached.createdAt
        };
      }
    }

    // Evaluate Career Track
    const targetRole = profile.preferences?.targetRoles?.[0] || profile.headline || 'Software Engineer';
    const careerTrack = this.detectCareerTrack(targetRole, job.title);

    // Evaluate Truth Check & Skill Evidence
    const truthCheck = this.evaluateSkillEvidence(candidateSkillNames, effectiveRequired, effectivePreferred);

    // Compute Scores
    const yearsExp = profile.experiences.length > 0 ? Math.max(3, profile.experiences.length * 1.5) : 3;
    const { scores, overallScore, category } = this.calculateScores(
      yearsExp,
      profile.location || '',
      profile.preferences?.remotePreference || 'Remote',
      profile.preferences?.preferredLocations || [],
      job.experienceMin ? Number(job.experienceMin) : 3,
      job.location || '',
      job.remoteType === 'REMOTE',
      careerTrack.isSameTrack,
      truthCheck.greenCount,
      truthCheck.yellowCount,
      truthCheck.items.length
    );

    // ATS Analysis
    const greenList = truthCheck.items.filter(i => i.status === 'VERIFIED').map(i => i.skill);
    const atsAnalysis = this.performATSAnalysis(
      greenList,
      truthCheck.items.length,
      scores.roleScore,
      scores.experienceScore,
      scores.skillScore
    );

    // Persist or Update Cache in PostgreSQL
    const savedMatch = await prisma.jobMatch.upsert({
      where: {
        candidateProfileId_jobId_inputHash: {
          candidateProfileId: profile.id,
          jobId: job.id,
          inputHash
        }
      },
      update: {
        overallScore,
        category,
        breakdown: scores as any,
        truthCheck: truthCheck as any,
        careerTrack: careerTrack as any,
        atsAnalysis: atsAnalysis as any,
        updatedAt: new Date()
      },
      create: {
        candidateProfileId: profile.id,
        jobId: job.id,
        overallScore,
        category,
        breakdown: scores as any,
        truthCheck: truthCheck as any,
        careerTrack: careerTrack as any,
        atsAnalysis: atsAnalysis as any,
        inputHash,
        engineVersion: '1.0.0'
      }
    });

    return {
      id: savedMatch.id,
      jobId: savedMatch.jobId,
      candidateProfileId: savedMatch.candidateProfileId,
      overallScore: savedMatch.overallScore,
      category: savedMatch.category,
      breakdown: savedMatch.breakdown as any,
      truthCheck: savedMatch.truthCheck as any,
      careerTrack: savedMatch.careerTrack as any,
      atsAnalysis: savedMatch.atsAnalysis as any,
      isCached: false,
      createdAt: savedMatch.createdAt
    };
  }

  /**
   * Deterministic Skill Gap Analysis with Verified Learning Resources
   */
  public static async getSkillGaps(userId: string, jobId: string) {
    const match = await this.analyzeFit(userId, jobId);
    const truthCheck = match.truthCheck as { items: SkillMatchItem[] };

    // Separate verified vs gap items
    const gaps: Array<SkillMatchItem & { learningResources: any[] }> = [];

    for (const item of truthCheck.items) {
      if (item.status === 'MISSING' || item.status === 'PARTIAL') {
        const resources = await LearningRepository.getResourcesForSkill(item.skill);
        gaps.push({
          ...item,
          learningResources: resources.slice(0, 3)
        });
      }
    }

    // Rank gaps by priority: CRITICAL > HIGH > MEDIUM > LOW
    const priorityWeight: Record<string, number> = {
      CRITICAL: 4,
      HIGH: 3,
      MEDIUM: 2,
      LOW: 1
    };

    gaps.sort((a, b) => {
      const wA = priorityWeight[a.priority || 'LOW'] || 0;
      const wB = priorityWeight[b.priority || 'LOW'] || 0;
      return wB - wA;
    });

    return {
      jobId,
      totalGaps: gaps.length,
      criticalCount: gaps.filter(g => g.priority === 'CRITICAL').length,
      gaps
    };
  }

  /**
   * Production AI Resume Tailoring Pipeline
   * Truth-enforcing: No fabrication, Target company leak rejection, ResumeVersion snapshot
   */
  public static async tailorResume(userId: string, jobId: string, mode: 'FULL' | 'FOCUSED' | 'TARGETED' = 'TARGETED') {
    const profile = await CandidateProfileRepository.findByUserId(userId);
    if (!profile) {
      throw new NotFoundError('Candidate profile not found');
    }

    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: { company: true }
    });

    if (!job) {
      throw new NotFoundError('Job opening not found');
    }

    // Ensure Master Resume exists
    let masterResumeId = profile.resumes.find(r => r.isMaster)?.id || profile.resumes[0]?.id;
    if (!masterResumeId) {
      // Create a default resume container if none uploaded yet
      const createdResume = await prisma.resume.create({
        data: {
          candidateProfileId: profile.id,
          title: 'Master Profile Resume',
          isMaster: true,
          status: 'PARSED'
        }
      });
      masterResumeId = createdResume.id;
    }

    // 1. Run Fit & Truth Check
    const matchAnalysis = await this.analyzeFit(userId, jobId);
    const truthCheck = matchAnalysis.truthCheck as { items: SkillMatchItem[]; greenCount: number; yellowCount: number; redCount: number };

    // 2. Map Candidate Historical Companies
    const historicalCompanies = profile.experiences.map(e => e.company);

    // 3. Convert candidate profile to generator model
    const candidateAdapter: any = {
      id: profile.id,
      name: profile.fullName,
      headline: profile.headline,
      email: profile.email,
      phone: profile.phone,
      location: profile.location,
      yearsOfExperience: profile.experiences.length > 0 ? profile.experiences.length * 1.5 : 3,
      targetRoles: profile.preferences?.targetRoles || ['Software Engineer'],
      summary: profile.summary || '',
      primarySkills: profile.skills.map(s => s.skill.name),
      secondarySkills: [],
      technologies: [],
      experiences: profile.experiences.map(e => ({
        id: e.id,
        title: e.jobTitle,
        company: e.company,
        startDate: e.startDate ? e.startDate.toISOString().slice(0, 7) : '2021',
        endDate: e.isCurrent ? 'Present' : (e.endDate ? e.endDate.toISOString().slice(0, 7) : 'Present'),
        duration: '',
        responsibilities: e.responsibilities,
        highlights: e.achievements || e.responsibilities
      })),
      education: profile.educations.map(ed => ({
        id: ed.id,
        degree: ed.degree,
        institution: ed.institution,
        year: ed.startDate ? ed.startDate.getFullYear().toString() : '2020'
      })),
      certifications: profile.certifications.map(c => c.name),
      projects: profile.projects.map(p => ({
        id: p.id,
        name: p.name,
        description: p.description,
        technologies: p.technologies
      }))
    };

    const jobAdapter: any = {
      id: job.id,
      role: job.title,
      company: job.company.name,
      careerTrack: job.title,
      mustHaveSkills: job.requirements.slice(0, 8),
      niceToHaveSkills: job.preferredQualifications.slice(0, 5),
      responsibilities: job.responsibilities,
      qualifications: job.requirements,
      experienceRequired: job.experienceMin ? `${job.experienceMin}+ years` : '3+ years',
      location: job.location || 'Remote'
    };

    // 4. Existing version count
    const existingVersions = await prisma.resumeVersion.findMany({
      where: { resumeId: masterResumeId }
    });

    // 5. Run Tailoring Generator
    const tailored = await ResumeTailorService.tailorResume(
      candidateAdapter,
      jobAdapter,
      {
        passed: truthCheck.redCount <= 2,
        items: truthCheck.items as any,
        greenCount: truthCheck.greenCount,
        yellowCount: truthCheck.yellowCount,
        redCount: truthCheck.redCount,
        summary: `${truthCheck.greenCount} verified skills.`
      },
      existingVersions.length,
      mode as any
    );

    // 6. Strict Target Company Leakage Guard
    const leakCheck = ResumeTailorService.checkTargetCompanyLeak(
      job.company.name,
      {
        tailoredSummary: tailored.tailoredSummary,
        orderedSkills: tailored.orderedSkills,
        experiences: tailored.experiences
      },
      historicalCompanies
    );

    if (leakCheck.leaked) {
      throw new Error(`Target Company Leakage detected in ${leakCheck.leakSection}. Tailored resume output was safely rejected.`);
    }

    // 7. Persist Immutable ResumeVersion
    const nextVersionNumber = existingVersions.length + 1;
    const versionRecord = await prisma.resumeVersion.create({
      data: {
        resumeId: masterResumeId,
        versionNumber: nextVersionNumber,
        title: `${job.company.name} - ${job.title} (${mode})`,
        summary: tailored.tailoredSummary,
        jobId: job.id,
        versionName: tailored.versionName,
        strategy: mode as any,
        atsScore: tailored.atsScore || matchAnalysis.atsAnalysis?.estimatedScore || 85,
        contentSnapshot: tailored as any,
        structuredContent: tailored as any
      }
    });

    return {
      versionId: versionRecord.id,
      versionName: versionRecord.versionName,
      versionNumber: versionRecord.versionNumber,
      title: versionRecord.title,
      atsScore: versionRecord.atsScore,
      mode: versionRecord.strategy,
      tailoredResume: tailored,
      truthCheckVerified: tailored.truthCheckVerified,
      modifications: tailored.modifications,
      createdAt: versionRecord.createdAt
    };
  }

  /**
   * List Tailored Resume Versions for a specific Job
   */
  public static async getTailoredResumesForJob(userId: string, jobId: string) {
    const profile = await CandidateProfileRepository.findByUserId(userId);
    if (!profile) {
      throw new NotFoundError('Candidate profile not found');
    }

    const versions = await prisma.resumeVersion.findMany({
      where: {
        jobId,
        resume: { candidateProfileId: profile.id }
      },
      orderBy: { createdAt: 'desc' }
    });

    return versions;
  }
}
