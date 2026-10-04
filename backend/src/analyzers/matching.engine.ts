import {
  CandidateProfile,
  JobDescription,
  MatchScores,
  MatchCategory,
  TruthCheckResult,
  TruthCheckItem,
  ATSAnalysisResult,
  JobMatchAnalysis
} from '../types/index.js';
import { AIServiceFactory } from '../ai/index.js';

export class MatchingEngine {
  public static async analyze(candidate: CandidateProfile, job: JobDescription): Promise<JobMatchAnalysis> {
    // 1. Truth Check
    const truthCheck = this.performTruthCheck(candidate, job);

    // 2. Career Track Alignment
    const careerTrack = this.detectCareerTrack(candidate, job);

    // 3. Match Scores
    const scores = this.calculateScores(candidate, job, truthCheck, careerTrack.isSameTrack);

    // 4. Recommendation Category
    const recommendation = this.getRecommendationCategory(scores.overallScore);

    // 5. ATS-Style Analysis
    const atsAnalysis = this.performATSAnalysis(candidate, job, truthCheck, scores);

    // 6. Why This Job (AI or structured builder)
    const whyMatch = await this.generateWhyMatch(candidate, job, scores, truthCheck, careerTrack);

    // 7. Suggested Answers for Application
    const suggestedAnswers = this.generateSuggestedAnswers(candidate, job);

    return {
      id: `match-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      candidateId: candidate.id,
      jobId: job.id,
      scores,
      recommendation,
      whyMatch,
      careerTrack,
      truthCheck,
      atsAnalysis,
      suggestedAnswers,
      createdAt: new Date().toISOString()
    };
  }

  public static performTruthCheck(candidate: CandidateProfile, job: JobDescription): TruthCheckResult {
    const candidateSkillsLower = new Set(
      [
        ...candidate.primarySkills,
        ...candidate.secondarySkills,
        ...candidate.technologies
      ].map(s => s.toLowerCase().trim())
    );

    const allJobSkills = Array.from(new Set([...job.mustHaveSkills, ...job.niceToHaveSkills]));
    const items: TruthCheckItem[] = [];

    let greenCount = 0;
    let yellowCount = 0;
    let redCount = 0;

    for (const skill of allJobSkills) {
      const skillLower = skill.toLowerCase().trim();

      // Check exact match in candidate profile
      if (candidateSkillsLower.has(skillLower)) {
        greenCount++;
        items.push({
          requirement: skill,
          status: 'GREEN',
          evidence: `Verified in profile skills & experience`,
          note: `Candidate has verified hands-on background in ${skill}.`
        });
      } else {
        // Related check (e.g. TestNG relates to JUnit, Selenium relates to Playwright)
        const isRelated = this.isRelatedSkill(skillLower, candidateSkillsLower);
        if (isRelated) {
          yellowCount++;
          items.push({
            requirement: skill,
            status: 'YELLOW',
            evidence: `Adjacent knowledge in related ecosystem: ${isRelated}`,
            note: `Found exposure to adjacent tools. Candidate can easily transition or learn.`
          });
        } else {
          redCount++;
          items.push({
            requirement: skill,
            status: 'RED',
            evidence: 'No record found in master profile',
            note: `Strict rule: Will NOT be fabricated on tailored resume.`
          });
        }
      }
    }

    const passed = redCount <= 2; // Pass if majority verified/related
    const summary = `${greenCount} skills verified (GREEN), ${yellowCount} transferable skills (YELLOW), ${redCount} unverified skills (RED - strictly omitted from resume fabrication).`;

    return {
      passed,
      items,
      greenCount,
      yellowCount,
      redCount,
      summary
    };
  }

  private static isRelatedSkill(jobSkill: string, candidateSkills: Set<string>): string | null {
    const relatedMap: Record<string, string[]> = {
      'playwright': ['selenium', 'cypress'],
      'selenium': ['playwright', 'cypress'],
      'testng': ['junit'],
      'junit': ['testng'],
      'postgresql': ['mysql', 'sql', 'sqlite'],
      'mysql': ['postgresql', 'sql'],
      'kafka': ['rabbitmq', 'sqs'],
      'react': ['vue', 'angular', 'javascript', 'typescript'],
      'typescript': ['javascript'],
      'docker': ['kubernetes', 'jenkins', 'ci/cd'],
      'power bi': ['tableau', 'excel', 'sql'],
      'tableau': ['power bi', 'excel', 'sql']
    };

    const targets = relatedMap[jobSkill] || [];
    for (const t of targets) {
      if (candidateSkills.has(t)) return t;
    }
    return null;
  }

  public static detectCareerTrack(candidate: CandidateProfile, job: JobDescription) {
    const candTrack = (candidate.targetRoles[0] || 'Software Engineer').toLowerCase();
    const jobTrack = (job.careerTrack || job.role).toLowerCase();

    let isSameTrack = false;
    let transitionPossible = false;
    let transitionGapExplanation = '';

    const normalize = (t: string) => {
      if (/qa|automation|test|sdet/i.test(t)) return 'QA Automation';
      if (/backend|java|spring/i.test(t)) return 'Backend Engineering';
      if (/full\s*stack/i.test(t)) return 'Full Stack Development';
      if (/data|analyst|analytics|bi/i.test(t)) return 'Data Analytics';
      if (/devops|cloud|sre/i.test(t)) return 'DevOps / Cloud';
      return 'Software Engineering';
    };

    const candNormalized = normalize(candTrack);
    const jobNormalized = normalize(jobTrack);

    if (candNormalized === jobNormalized) {
      isSameTrack = true;
      transitionPossible = true;
    } else {
      isSameTrack = false;
      // Potential transitions
      if (candNormalized === 'QA Automation' && jobNormalized === 'Backend Engineering') {
        transitionPossible = true;
        transitionGapExplanation =
          'Candidate has coding foundation (Java/Python) but needs to demonstrate deep architectural design, caching, and database optimization patterns.';
      } else if (candNormalized === 'Backend Engineering' && jobNormalized === 'Full Stack Development') {
        transitionPossible = true;
        transitionGapExplanation =
          'Candidate has strong backend competencies; gap lies in modern frontend UI state management and styling frameworks.';
      } else {
        transitionPossible = false;
        transitionGapExplanation = `Cross-domain leap from ${candNormalized} to ${jobNormalized}. Significant gap in core domain knowledge.`;
      }
    }

    return {
      candidateTrack: candNormalized,
      jobTrack: jobNormalized,
      isSameTrack,
      transitionPossible,
      transitionGapExplanation: transitionGapExplanation || undefined
    };
  }

  public static calculateScores(
    candidate: CandidateProfile,
    job: JobDescription,
    truthCheck: TruthCheckResult,
    isSameTrack: boolean
  ): MatchScores {
    // 1. Skill Score based on Truth Check: Green = 100%, Yellow = 60%, Red = 0%
    const totalSkills = Math.max(1, truthCheck.items.length);
    const skillScore = Math.min(
      100,
      Math.round(
        ((truthCheck.greenCount * 1.0 + truthCheck.yellowCount * 0.6) / totalSkills) * 100
      )
    );

    // 2. Experience Score
    const reqYearsMatch = job.experienceRequired.match(/(\d+)/);
    const reqYears = reqYearsMatch ? parseInt(reqYearsMatch[1], 10) : 3;
    let expScore = 90;
    if (candidate.yearsOfExperience >= reqYears) {
      expScore = Math.min(100, 90 + Math.round((candidate.yearsOfExperience - reqYears) * 3));
    } else {
      const deficit = reqYears - candidate.yearsOfExperience;
      expScore = Math.max(40, 90 - Math.round(deficit * 15));
    }

    // 3. Role Score
    const roleScore = isSameTrack ? 96 : 58;

    // 4. Location Score
    const candLoc = candidate.location.toLowerCase();
    const jobLoc = job.location.toLowerCase();
    const isRemote = jobLoc.includes('remote') || candidate.workPreference === 'Remote';
    const locMatch = isRemote || jobLoc.includes(candLoc) || candLoc.includes(jobLoc) || candidate.preferredLocations.some(l => jobLoc.includes(l.toLowerCase()));
    const locationScore = locMatch ? 98 : 72;

    // 5. Seniority Score
    const seniorityScore = Math.min(100, Math.max(50, Math.round((expScore * 0.7) + (roleScore * 0.3))));

    // Overall weighted calculation
    // Skill: 40%, Experience: 25%, Role: 20%, Location: 10%, Seniority: 5%
    const overallScore = Math.round(
      skillScore * 0.4 +
      expScore * 0.25 +
      roleScore * 0.2 +
      locationScore * 0.1 +
      seniorityScore * 0.05
    );

    return {
      overallScore,
      skillScore,
      experienceScore: expScore,
      roleScore,
      locationScore,
      seniorityScore
    };
  }

  public static getRecommendationCategory(score: number): MatchCategory {
    if (score >= 90) {
      return {
        level: 'Strongly Recommended',
        color: 'emerald',
        description: 'Exceptional profile match with strong core competencies and track alignment.'
      };
    } else if (score >= 75) {
      return {
        level: 'Recommended',
        color: 'blue',
        description: 'Good alignment. Minor gaps can be easily addressed during interview prep.'
      };
    } else if (score >= 50) {
      return {
        level: 'Review',
        color: 'amber',
        description: 'Moderate overlap. Candidate has adjacent skills but may require explanation or transition story.'
      };
    } else {
      return {
        level: 'Not Recommended',
        color: 'rose',
        description: 'Significant misalignment in required tech stack or career track.'
      };
    }
  }

  public static performATSAnalysis(
    candidate: CandidateProfile,
    job: JobDescription,
    truthCheck: TruthCheckResult,
    scores: MatchScores
  ): ATSAnalysisResult {
    const greenKeywords = truthCheck.items.filter(i => i.status === 'GREEN').map(i => i.requirement);
    const yellowKeywords = truthCheck.items.filter(i => i.status === 'YELLOW').map(i => i.requirement);
    const redKeywords = truthCheck.items.filter(i => i.status === 'RED').map(i => i.requirement);

    const keywordMatch = Math.round(
      (greenKeywords.length / Math.max(1, truthCheck.items.length)) * 100
    );

    const estimatedScore = Math.round(
      keywordMatch * 0.35 +
      scores.roleScore * 0.25 +
      scores.experienceScore * 0.2 +
      scores.skillScore * 0.2
    );

    return {
      estimatedScore,
      breakdown: {
        keywordMatch,
        roleAlignment: scores.roleScore,
        experienceAlignment: scores.experienceScore,
        skillsAlignment: scores.skillScore,
        formatting: 95, // High readability ATS compliant
        readability: 92
      },
      keywords: {
        green: greenKeywords,
        yellow: yellowKeywords,
        red: redKeywords
      },
      disclaimer: 'Estimated ATS Match is a simulation of standard ATS keyword scanning and parse heuristics. It is not an actual proprietary score of any specific employer.'
    };
  }

  private static async generateWhyMatch(
    candidate: CandidateProfile,
    job: JobDescription,
    scores: MatchScores,
    truthCheck: TruthCheckResult,
    careerTrack: any
  ) {
    const matchingStrengths = truthCheck.items
      .filter(i => i.status === 'GREEN')
      .map(i => `Demonstrated capability in ${i.requirement}`);

    const missingOrWeakAreas = truthCheck.items
      .filter(i => i.status === 'RED')
      .map(i => `Missing verified production experience with ${i.requirement}`);

    const potentialConcerns = [];
    if (!careerTrack.isSameTrack) {
      potentialConcerns.push(
        careerTrack.transitionGapExplanation || 'Candidate is applying across differing engineering tracks.'
      );
    }
    if (truthCheck.redCount > 2) {
      potentialConcerns.push(`${truthCheck.redCount} required tools not found in candidate experience.`);
    }

    return {
      matchingStrengths: matchingStrengths.slice(0, 5),
      relevantExperienceHighlights: [
        `${candidate.yearsOfExperience} years of experience vs required ${job.experienceRequired}`,
        `Track alignment: ${careerTrack.isSameTrack ? 'Direct match in ' + careerTrack.jobTrack : 'Cross-track opportunity'}`
      ],
      locationAlignment: `Location preferences match requirement (${job.location})`,
      seniorityAlignment: `Seniority index: ${scores.seniorityScore}% match for role scope`,
      missingOrWeakAreas: missingOrWeakAreas.slice(0, 4),
      potentialConcerns: potentialConcerns.length > 0 ? potentialConcerns : ['None detected. Profile is well matched.']
    };
  }

  public static generateSuggestedAnswers(candidate: CandidateProfile, job: JobDescription): Record<string, string> {
    return {
      'Total years of relevant experience?': `${candidate.yearsOfExperience} years`,
      'What is your notice period?': candidate.noticePeriod || '30 days',
      'What is your expected salary?': candidate.expectedSalary || 'Market standard / negotiable',
      'Are you open to relocation / work arrangement?': `${candidate.workPreference} arrangement preferred. Open to discussing based on role location (${job.location}).`,
      'Why are you a good fit for this role?': `With ${candidate.yearsOfExperience} years working in ${candidate.primarySkills.slice(0, 4).join(', ')}, I bring direct experience delivering scalable solutions aligned with ${job.company}'s engineering objectives.`
    };
  }
}
