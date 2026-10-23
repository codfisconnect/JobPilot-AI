import { prisma } from '../database/prisma.js';
import { CandidateProfileRepository } from '../repositories/candidateProfile.repository.js';
import { calculateWorkHistoryExperienceYears } from '../utils/readiness.js';
import { ProductionMatchingService } from './matching.service.js';

export interface RecommendationExplanation {
  headline: string;
  reasons: string[];
  score: number; // 0 - 100
  isStrongMatch: boolean;
}

export interface RecommendedJobItem {
  job: any;
  recommendationScore: number;
  matchScore: number | null;
  explanation: RecommendationExplanation;
}

export interface RecommendationResult {
  items: any[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  hasProfileData: boolean;
  profileState: 'EMPTY' | 'PARTIAL' | 'COMPLETE';
  profileSummary?: {
    primaryRole?: string;
    skillsCount: number;
    yearsOfExperience: number;
    location?: string;
  };
}

export class JobRecommendationService {
  /**
   * Determine candidate profile completeness level
   */
  public static evaluateProfileState(profile: any): 'EMPTY' | 'PARTIAL' | 'COMPLETE' {
    if (!profile) return 'EMPTY';

    const hasSkills = profile.skills && profile.skills.length > 0;
    const hasExperiences = profile.experiences && profile.experiences.length > 0;
    const hasResumes = profile.resumes && profile.resumes.length > 0;
    const hasHeadline = !!profile.headline?.trim();
    const hasTargetRoles = profile.preferences?.targetRoles && profile.preferences.targetRoles.length > 0;

    if (!hasSkills && !hasExperiences && !hasResumes && !hasHeadline && !hasTargetRoles) {
      return 'EMPTY';
    }

    if ((hasSkills || hasResumes) && (hasExperiences || hasTargetRoles || hasHeadline)) {
      return 'COMPLETE';
    }

    return 'PARTIAL';
  }

  /**
   * Generate personalized job recommendations for candidate
   */
  public static async getRecommendations(
    userId: string,
    options: {
      page?: number;
      pageSize?: number;
      country?: string;
      location?: string;
      remoteType?: string;
      employmentType?: string;
      minScore?: number;
    } = {}
  ): Promise<RecommendationResult> {
    const page = Math.max(1, options.page || 1);
    const pageSize = Math.min(100, Math.max(1, options.pageSize || 12));

    const profile = await CandidateProfileRepository.findByUserId(userId);
    const profileState = this.evaluateProfileState(profile);

    // If new candidate has no profile and no resume, return transparent onboarding signal
    if (profileState === 'EMPTY' || !profile) {
      return {
        items: [],
        pagination: {
          page: 1,
          pageSize,
          total: 0,
          totalPages: 0
        },
        hasProfileData: false,
        profileState: 'EMPTY'
      };
    }

    // Extract normalized candidate features
    const candidateSkills = (profile.skills || []).map((s: any) => s.skill?.name || s.name).filter(Boolean);
    const candidateSkillsLower = new Set(candidateSkills.map((s: string) => s.toLowerCase().trim()));

    // Target roles: primary role, secondary roles, and headline
    const targetRoles = profile.preferences?.targetRoles || [];
    const primaryRole = targetRoles[0] || profile.headline || 'Software Engineer';
    const secondaryRoles = targetRoles.slice(1);
    const candidateLocation = profile.location || profile.city || '';
    const preferredLocations = (profile.preferences?.preferredLocations || []).map((l: string) => l.toLowerCase());
    const remotePref = profile.preferences?.remotePreference || 'ANY';

    const workExpYears = calculateWorkHistoryExperienceYears(profile.experiences);
    const candidateExpYears = workExpYears > 0 ? workExpYears : ((profile as any).yearsOfExperience || profile.experiences?.length || 1);

    // Filter candidate jobs
    const where: any = {
      status: 'ACTIVE'
    };

    if (options.country) {
      where.country = { contains: options.country.trim(), mode: 'insensitive' };
    }
    if (options.location) {
      where.location = { contains: options.location.trim(), mode: 'insensitive' };
    }
    if (options.remoteType) {
      where.remoteType = options.remoteType;
    }
    if (options.employmentType) {
      where.employmentType = options.employmentType;
    }

    // Fetch active candidates jobs with company and skills
    const jobs = await prisma.job.findMany({
      where,
      take: 250, // pool for relevance ranking
      orderBy: [
        { postedAt: 'desc' },
        { createdAt: 'desc' }
      ],
      include: {
        company: {
          select: {
            id: true,
            name: true,
            officialDomain: true,
            logoUrl: true,
            industry: true
          }
        },
        skills: {
          include: {
            skill: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    });

    // Score each job across multiple dimensions
    const scoredJobs: RecommendedJobItem[] = [];

    for (const job of jobs) {
      const evaluation = this.evaluateJobRecommendation(job, {
        primaryRole,
        secondaryRoles,
        candidateSkillsLower,
        candidateExpYears,
        candidateLocation,
        preferredLocations,
        remotePref
      });

      // Filter by minimum relevance threshold (default: 45) so irrelevant jobs do not pollute feed
      const threshold = options.minScore || 45;
      if (evaluation.score >= threshold) {
        // Adapt job object to match canonical response shape
        const adaptedJob = {
          ...job,
          salaryMin: job.salaryMin ? Number(job.salaryMin) : null,
          salaryMax: job.salaryMax ? Number(job.salaryMax) : null,
          skills: job.skills.map((s: any) => ({
            id: s.skill?.id,
            name: s.skill?.name,
            type: s.skillType
          })),
          recommendation: {
            score: evaluation.score,
            headline: evaluation.headline,
            reasons: evaluation.reasons,
            isStrongMatch: evaluation.isStrongMatch
          }
        };

        scoredJobs.push({
          job: adaptedJob,
          recommendationScore: evaluation.score,
          matchScore: evaluation.score,
          explanation: evaluation
        });
      }
    }

    // Rank jobs strictly by recommendation relevance score descending
    scoredJobs.sort((a, b) => b.recommendationScore - a.recommendationScore);

    // Apply pagination
    const total = scoredJobs.length;
    const totalPages = Math.ceil(total / pageSize);
    const skip = (page - 1) * pageSize;
    const paginatedItems = scoredJobs.slice(skip, skip + pageSize).map(item => item.job);

    return {
      items: paginatedItems,
      pagination: {
        page,
        pageSize,
        total,
        totalPages
      },
      hasProfileData: true,
      profileState,
      profileSummary: {
        primaryRole,
        skillsCount: candidateSkills.length,
        yearsOfExperience: candidateExpYears,
        location: candidateLocation
      }
    };
  }

  /**
   * Evaluate a single job against candidate profile features
   */
  public static evaluateJobRecommendation(
    job: any,
    candidate: {
      primaryRole: string;
      secondaryRoles: string[];
      candidateSkillsLower: Set<string>;
      candidateExpYears: number;
      candidateLocation: string;
      preferredLocations: string[];
      remotePref: string;
    }
  ): RecommendationExplanation {
    const jobTitleLower = job.title.toLowerCase();
    const reasons: string[] = [];
    let roleScore = 50;

    // 1. Role & Career Track Fit (Weight: 35%)
    const trackFit = ProductionMatchingService.detectCareerTrack(candidate.primaryRole, job.title);
    if (trackFit.isSameTrack) {
      roleScore = 95;
      reasons.push(`Direct alignment with your target track: ${trackFit.candidateTrack}`);
    } else {
      // Check secondary target roles
      let matchedSecondary = false;
      for (const sec of candidate.secondaryRoles) {
        const secTrack = ProductionMatchingService.detectCareerTrack(sec, job.title);
        if (secTrack.isSameTrack) {
          roleScore = 85;
          matchedSecondary = true;
          reasons.push(`Matches your interest in ${sec}`);
          break;
        }
      }

      if (!matchedSecondary) {
        if (trackFit.transitionPossible) {
          roleScore = 65;
          reasons.push(`Adjacent domain to ${candidate.primaryRole}`);
        } else {
          roleScore = 25;
        }
      }
    }

    // 2. Skill Overlap (Weight: 35%)
    const jobSkills = (job.skills || []).map((s: any) => (s.skill?.name || s.name || '').toLowerCase());
    const matchedSkills: string[] = [];

    jobSkills.forEach((s: string) => {
      if (candidate.candidateSkillsLower.has(s)) {
        matchedSkills.push(s);
      }
    });

    // Also check requirements text if tagged skills are sparse
    if (matchedSkills.length === 0 && Array.isArray(job.requirements)) {
      candidate.candidateSkillsLower.forEach(sk => {
        if (sk.length > 2 && job.requirements.some((r: string) => r.toLowerCase().includes(sk))) {
          matchedSkills.push(sk);
        }
      });
    }

    let skillScore = 30;
    if (jobSkills.length > 0) {
      const ratio = matchedSkills.length / jobSkills.length;
      skillScore = Math.min(100, Math.round(ratio * 100));
    } else if (matchedSkills.length > 0) {
      skillScore = Math.min(100, 50 + matchedSkills.length * 15);
    }

    if (matchedSkills.length > 0) {
      const displaySkills = matchedSkills.slice(0, 3).map(s => s.toUpperCase());
      reasons.push(`Matches your verified skills: ${displaySkills.join(', ')}`);
    }

    // 3. Experience & Seniority Compatibility (Weight: 15%)
    const jobMinExp = job.experienceMin ?? 2;
    let expScore = 85;
    if (candidate.candidateExpYears >= jobMinExp) {
      expScore = Math.min(100, 85 + Math.round((candidate.candidateExpYears - jobMinExp) * 3));
      reasons.push(`Your ${candidate.candidateExpYears} yrs experience satisfies the ${jobMinExp}+ yrs requirement`);
    } else {
      const diff = jobMinExp - candidate.candidateExpYears;
      expScore = Math.max(30, 85 - diff * 15);
    }

    // 4. Location & Remote Compatibility (Weight: 15%)
    const candLoc = candidate.candidateLocation.toLowerCase();
    const jobLoc = (job.location || job.city || '').toLowerCase();
    const isRemote = job.remoteType === 'REMOTE' || jobLoc.includes('remote');
    let locScore = 70;

    if (isRemote) {
      locScore = 100;
      reasons.push('Remote opportunity matching flexible work preference');
    } else if (candLoc && (jobLoc.includes(candLoc) || candLoc.includes(jobLoc))) {
      locScore = 95;
      reasons.push(`Located in your preferred area: ${job.location || job.city}`);
    } else if (candidate.preferredLocations.some(l => jobLoc.includes(l))) {
      locScore = 90;
      reasons.push(`Matches your preferred location`);
    } else {
      locScore = 60;
    }

    // Overall Weighted Recommendation Score (0 - 100)
    const overallScore = Math.round(
      roleScore * 0.35 +
      skillScore * 0.35 +
      expScore * 0.15 +
      locScore * 0.15
    );

    const isStrongMatch = overallScore >= 80;
    let headline = 'Relevant to your profile';
    if (overallScore >= 85) {
      headline = 'Strong match for your skills & experience';
    } else if (overallScore >= 70) {
      headline = 'Good match for your career track';
    } else if (overallScore >= 50) {
      headline = 'Potential transition opportunity';
    }

    return {
      headline,
      reasons: reasons.slice(0, 3),
      score: overallScore,
      isStrongMatch
    };
  }
}
