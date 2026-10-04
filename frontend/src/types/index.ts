export type VerificationStatus = 'VERIFIED' | 'CONFIRMED' | 'PARSED' | 'NEEDS_REVIEW' | 'UNVERIFIED';

export interface CategorizedSkill {
  name: string;
  category: 
    | 'Programming Languages'
    | 'Automation Testing'
    | 'Manual Testing'
    | 'API Testing'
    | 'Frameworks'
    | 'Databases'
    | 'CI/CD'
    | 'Cloud'
    | 'DevOps'
    | 'Version Control'
    | 'Testing Tools'
    | 'Project Management / Agile'
    | 'Operating Systems'
    | 'Other Tools'
    | 'Domain Knowledge';
  status: VerificationStatus;
  years?: number;
  proficiency?: 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';
}

export interface DetailedExperienceItem {
  id: string;
  company: string;
  title: string;
  location?: string;
  startDate: string;
  endDate: string;
  isCurrent?: boolean;
  duration?: string;
  description?: string;
  responsibilities: string[];
  highlights?: string[];
  achievements?: string[];
  technologies: string[];
  domain?: string;
  employmentType?: string;
  isCompressed?: boolean;
}

export interface DetailedEducationItem {
  id: string;
  degree: string;
  specialization?: string;
  institution: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  year?: string;
  grade?: string;
  details?: string;
}

export interface DetailedCertificationItem {
  id: string;
  name: string;
  issuer?: string;
  issueDate?: string;
  expiryDate?: string;
  credentialId?: string;
  credentialUrl?: string;
}

export interface DetailedProjectItem {
  id: string;
  name: string;
  client?: string;
  domain?: string;
  description: string;
  responsibilities?: string[];
  technologies: string[];
  achievements?: string[];
  duration?: string;
  link?: string;
}

export interface ResumeValidationCheck {
  id: string;
  label: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  details?: string;
}

export interface ResumeValidationResult {
  passed: boolean;
  canExport: boolean;
  targetCompanyLeakDetected: boolean;
  unsupportedClaimsDetected: boolean;
  checks: ResumeValidationCheck[];
  completenessScore: number;
  completenessDetails: string[];
}

export interface CandidateProfile {
  id: string;
  name: string;
  headline?: string;
  email: string;
  phone: string;
  location: string;
  state?: string;
  country?: string;
  linkedInUrl?: string;
  gitHubUrl?: string;
  portfolioUrl?: string;
  targetRoles: string[];
  yearsOfExperience: number;
  relevantYearsOfExperience?: number;
  preferredLocations: string[];
  expectedSalary: string;
  noticePeriod: string;
  workPreference: 'Remote' | 'Hybrid' | 'Onsite' | 'Flexible';
  primarySkills: string[];
  secondarySkills: string[];
  technologies: string[];
  categorizedSkills?: CategorizedSkill[];
  companies: string[];
  education: DetailedEducationItem[];
  certifications: string[];
  detailedCertifications?: DetailedCertificationItem[];
  projects: DetailedProjectItem[];
  achievements?: string[];
  languages?: string[];
  summary: string;
  experiences: DetailedExperienceItem[];
  isDemo?: boolean;
  extractionAudit?: {
    rawName?: string;
    rawEmail?: string;
    rawPhone?: string;
    extractionConfidence?: number;
    fieldsNeedingReview?: string[];
  };
  createdAt: string;
  updatedAt: string;
}

// Backwards compatibility aliases
export type ExperienceItem = DetailedExperienceItem;
export type EducationItem = DetailedEducationItem;
export type ProjectItem = DetailedProjectItem;

export interface JobDescription {
  id: string;
  role: string;
  company: string;
  location: string;
  sourceUrl?: string;
  sourceType: 'pasted' | 'url' | 'extension' | 'sample' | 'external';
  source?: string; // e.g. 'Codewalla', 'JobPilot Predefined'
  applicationUrl?: string;
  applicationMethod?: 'External Website' | 'Email' | 'LinkedIn' | 'Other';
  applicationMode: 'demo' | 'external';
  employmentType?: string;
  workMode?: string;
  publishedDate?: string;
  isExternal?: boolean;
  externalJobId?: string;
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

export interface ResumeVersionItem {
  id: string;
  versionName: string;
  candidateId: string;
  jobId?: string;
  targetRole?: string;
  targetCompany?: string;
  mode: ResumeMode;
  tailoredSummary: string;
  orderedSkills: string[];
  experiences: DetailedExperienceItem[];
  projects: DetailedProjectItem[];
  education?: DetailedEducationItem[];
  certifications?: string[];
  truthCheckVerified: boolean;
  atsScore?: number;
  pdfUrl?: string;
  createdAt: string;
}

export interface TailoredResume {
  id: string;
  versionName: string;
  candidateId: string;
  jobId: string;
  targetRole: string;
  targetCompany: string;
  mode?: ResumeMode;
  tailoredSummary: string;
  orderedSkills: string[];
  experiences: DetailedExperienceItem[];
  projects: DetailedProjectItem[];
  education?: DetailedEducationItem[];
  certifications?: string[];
  modifications: {
    section: string;
    original: string;
    tailored: string;
    reason: string;
  }[];
  truthCheckVerified: boolean;
  targetCompanyLeakDetected?: boolean;
  atsScore?: number;
  createdAt: string;
}

export type ApplicationStatus =
  | 'DISCOVERED'
  | 'ANALYZED'
  | 'MATCHED'
  | 'RESUME_GENERATED'
  | 'ATS_CHECKED'
  | 'READY_TO_APPLY'
  | 'APPLICATION_STARTED'
  | 'APPLIED_DEMO'
  | 'APPLIED'
  | 'WAITING_FOR_RESPONSE'
  | 'INTERVIEW'
  | 'REJECTED'
  | 'SELECTED'
  | 'FAILED'
  // Legacy aliases
  | 'Saved'
  | 'Ready to Apply'
  | 'Applied'
  | 'Interview'
  | 'Rejected'
  | 'Selected'
  | 'Withdrawn'
  | 'Skipped';

export interface ApplicationTimelineEvent {
  timestamp: string;
  stage: string;
  description: string;
}

export interface ApplicationRecord {
  id: string;
  candidateId: string;
  jobId: string;
  resumeVersionId?: string;
  resumeVersionName?: string;
  company: string;
  role: string;
  location: string;
  applicationMode: 'demo' | 'external';
  jobUrl?: string;
  applicationUrl?: string;
  matchScore: number;
  atsScore?: number;
  status: ApplicationStatus;
  applicationDate: string;
  appliedAt?: string;
  notes: string;
  customAnswers?: Record<string, string>;
  skillGaps?: string[];
  timeline?: ApplicationTimelineEvent[];
  coverLetter?: string;
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

export interface CompanyRegistryItem {
  id: string;
  name: string;
  officialDomain: string;
  careersUrl: string;
  country: string;
  locations: string[];
  industry: string;
  atsProvider: 'Codewalla' | 'Lever' | 'Ashby' | 'Workable' | 'SmartRecruiters' | 'Greenhouse' | 'Custom';
  atsIdentifier?: string;
  sourceType: 'OFFICIAL_HTML' | 'PUBLIC_FEED' | 'ATS_PUBLIC_BOARD' | 'MANUAL';
  discoveryStatus: 'ACTIVE' | 'PENDING' | 'VERIFIED' | 'UNSUPPORTED';
  lastVerifiedAt: string;
  lastCheckedAt: string;
  healthStatus: 'HEALTHY' | 'DEGRADED' | 'DOWN';
  activeJobsCount: number;
  createdAt: string;
  updatedAt: string;
}

export type ResumeMode = 'FULL' | 'FOCUSED' | 'TARGETED';

export interface SmartResumeStrategy {
  mode: ResumeMode;
  targetRole: string;
  targetCompany: string;
  whyMode: string;
  whatToEmphasize: string[];
  whatToCompress: string[];
  whatToDeemphasize: string[];
  transferableCapabilities: { capability: string; transferableTo: string; rationale: string }[];
  genuineSkillGaps: string[];
  truthWarnings: string[];
  candidateApproved: boolean;
}

export interface SkillGapItem {
  skill: string;
  status: 'VERIFIED' | 'PARTIAL' | 'TRANSFERABLE' | 'MISSING' | 'UNKNOWN';
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  frequencyInTargetJobs: number;
  importanceInTargetRole: string;
  candidateStatus: string;
  reason: string;
  learningSequence: number;
}

export interface OnlineLearningResource {
  id: string;
  skill: string;
  title: string;
  platform: 'YouTube' | 'Official Documentation' | 'Interactive Tutorial' | 'Coursera / MOOC';
  url: string;
  language: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  approximateDuration?: string;
  isVerified: boolean;
  description: string;
}

export interface LocalTrainingInstitute {
  id: string;
  name: string;
  city: string;
  area: string;
  skillsTaught: string[];
  courseRelevance: string;
  rating?: number;
  contactPhone?: string;
  website?: string;
  distanceEstimate?: string;
  isVerified: boolean;
}

export interface SourceHealthStatus {
  sourceKey: string;
  name: string;
  status: 'HEALTHY' | 'WARNING' | 'ERROR';
  lastSuccessfulFetch: string;
  lastAttemptedFetch: string;
  jobsDiscovered: number;
  jobsUpdated: number;
  errorCount: number;
  failureReason?: string;
}
