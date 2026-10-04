export interface ExperienceItem {
  id: string;
  title: string;
  company: string;
  location?: string;
  startDate: string;
  endDate: string;
  isCurrent?: boolean;
  highlights: string[];
  skillsUsed: string[];
}

export interface EducationItem {
  id: string;
  degree: string;
  institution: string;
  year?: string;
  details?: string;
}

export interface ProjectItem {
  id: string;
  name: string;
  description: string;
  technologies: string[];
  link?: string;
}

export interface CandidateProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  location: string;
  targetRoles: string[];
  yearsOfExperience: number;
  preferredLocations: string[];
  expectedSalary: string;
  noticePeriod: string;
  workPreference: 'Remote' | 'Hybrid' | 'Onsite' | 'Flexible';
  primarySkills: string[];
  secondarySkills: string[];
  technologies: string[];
  companies: string[];
  education: EducationItem[];
  certifications: string[];
  projects: ProjectItem[];
  summary: string;
  experiences: ExperienceItem[];
  isDemo?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface JobDescription {
  id: string;
  role: string;
  company: string;
  location: string;
  sourceUrl?: string;
  sourceType: 'pasted' | 'url' | 'extension' | 'sample';
  experienceRequired: string;
  salary?: string;
  careerTrack: string;
  mustHaveSkills: string[];
  niceToHaveSkills: string[];
  responsibilities: string[];
  qualifications: string[];
  rawText: string;
  createdAt: string;
}

export interface MatchCategory {
  level: 'Strongly Recommended' | 'Recommended' | 'Review' | 'Not Recommended';
  color: 'emerald' | 'blue' | 'amber' | 'rose';
  description: string;
}

export interface MatchScores {
  overallScore: number;
  skillScore: number;
  experienceScore: number;
  roleScore: number;
  locationScore: number;
  seniorityScore: number;
}

export interface TruthCheckItem {
  requirement: string;
  status: 'GREEN' | 'YELLOW' | 'RED';
  evidence: string;
  note: string;
}

export interface TruthCheckResult {
  passed: boolean;
  items: TruthCheckItem[];
  greenCount: number;
  yellowCount: number;
  redCount: number;
  summary: string;
}

export interface ATSAnalysisResult {
  estimatedScore: number;
  breakdown: {
    keywordMatch: number;
    roleAlignment: number;
    experienceAlignment: number;
    skillsAlignment: number;
    formatting: number;
    readability: number;
  };
  keywords: {
    green: string[];
    yellow: string[];
    red: string[];
  };
  disclaimer: string;
}

export interface JobMatchAnalysis {
  id: string;
  candidateId: string;
  jobId: string;
  scores: MatchScores;
  recommendation: MatchCategory;
  whyMatch: {
    matchingStrengths: string[];
    relevantExperienceHighlights: string[];
    locationAlignment: string;
    seniorityAlignment: string;
    missingOrWeakAreas: string[];
    potentialConcerns: string[];
  };
  careerTrack: {
    candidateTrack: string;
    jobTrack: string;
    isSameTrack: boolean;
    transitionPossible: boolean;
    transitionGapExplanation?: string;
  };
  truthCheck: TruthCheckResult;
  atsAnalysis: ATSAnalysisResult;
  suggestedAnswers: Record<string, string>;
  createdAt: string;
}

export interface TailoredResume {
  id: string;
  versionName: string;
  candidateId: string;
  jobId: string;
  targetRole: string;
  targetCompany: string;
  tailoredSummary: string;
  orderedSkills: string[];
  experiences: ExperienceItem[];
  projects: ProjectItem[];
  modifications: {
    section: string;
    original: string;
    tailored: string;
    reason: string;
  }[];
  truthCheckVerified: boolean;
  createdAt: string;
}

export type ApplicationStatus =
  | 'Saved'
  | 'Ready to Apply'
  | 'Applied'
  | 'Interview'
  | 'Rejected'
  | 'Selected'
  | 'Withdrawn'
  | 'Skipped';

export interface ApplicationRecord {
  id: string;
  candidateId: string;
  jobId: string;
  resumeVersionId?: string;
  resumeVersionName?: string;
  company: string;
  role: string;
  location: string;
  jobUrl?: string;
  matchScore: number;
  status: ApplicationStatus;
  applicationDate: string;
  notes: string;
  customAnswers?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface InterviewPreparation {
  id: string;
  candidateId: string;
  jobId: string;
  resumeVersionId?: string;
  role: string;
  company: string;
  technicalTopics: string[];
  technicalQuestions: { question: string; answerGuidance: string; difficulty: 'Easy' | 'Medium' | 'Hard' }[];
  resumeQuestions: { question: string; basedOn: string; answerGuidance: string }[];
  hrQuestions: { question: string; purpose: string; sampleOutline: string }[];
  roleSpecificQuestions: { scenario: string; keyCheckpoints: string[] }[];
  preparationAreas: string[];
  createdAt: string;
}
