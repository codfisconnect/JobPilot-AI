/**
 * Application Readiness Engine for Pilot Mama
 * Deterministic calculation of candidate experience, verification status,
 * structured blockers, and gate evaluations.
 */

export interface ExperienceItemInput {
  id?: string | null;
  company?: string | null;
  title?: string | null;
  location?: string | null;
  startDate?: string | Date | null;
  endDate?: string | Date | null;
  isCurrent?: boolean | null;
  duration?: string | null;
  description?: string | null;
  responsibilities?: string[] | null;
  technologies?: string[] | null;
}

export interface CandidateProfileInput {
  id?: string | null;
  name?: string | null;
  fullName?: string | null;
  headline?: string | null;
  email?: string | null;
  phone?: string | null;
  location?: string | null;
  yearsOfExperience?: number | null;
  experiences?: ExperienceItemInput[] | null;
}

export interface JobDescriptionInput {
  id?: string | null;
  role?: string | null;
  title?: string | null;
  company?: string | null;
  location?: string | null;
  experienceRequired?: string | null;
}

export type BlockerId =
  | 'PROFILE_DATA_CONFLICT'
  | 'MISSING_CANDIDATE_LOCATION'
  | 'ATS_BELOW_THRESHOLD'
  | 'OTHER_REQUIRED_FIELD';

export interface ReadinessBlocker {
  id: BlockerId;
  title: string;
  description: string;
  severity: 'BLOCKING' | 'WARNING';
  actionLabel?: string;
  field?: string;
}

/**
 * Calculates candidate work history experience deterministically from verified experience records.
 * Sums date spans (end date - start date) in years, avoiding heuristics like count * 1.5.
 */
export function calculateWorkHistoryExperienceYears(experiences?: ExperienceItemInput[] | null): number {
  if (!experiences || !Array.isArray(experiences) || experiences.length === 0) {
    return 0;
  }

  let totalDays = 0;
  let parsedFromDescription = 0;

  for (const exp of experiences) {
    if (!exp) continue;

    let hasValidDates = false;
    if (exp.startDate) {
      const start = new Date(exp.startDate);
      const isPresent = exp.isCurrent || !exp.endDate || (typeof exp.endDate === 'string' && exp.endDate.toLowerCase() === 'present');
      const end = isPresent ? new Date() : new Date(exp.endDate as string | Date);

      if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end.getTime() >= start.getTime()) {
        const days = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
        totalDays += days;
        hasValidDates = true;
      }
    }

    if (!hasValidDates) {
      const durMatch = (exp.duration || exp.description || '').match(/(\d+(?:\.\d+)?)\s*(?:years|yrs)/i);
      if (durMatch) {
        parsedFromDescription += parseFloat(durMatch[1]);
      }
    }
  }

  const yearsFromDays = totalDays / 365.25;
  const total = yearsFromDays + parsedFromDescription;
  return Math.round(total * 10) / 10;
}

export interface ReadinessEvaluationParams {
  candidate?: CandidateProfileInput | null;
  job?: JobDescriptionInput | null;
  currentAtsScore?: number | null;
  atsThreshold?: number; // default 80
  isExperienceConfirmed?: boolean;
}

export interface ReadinessEvaluationResult {
  isReady: boolean;
  blockers: ReadinessBlocker[];
  profileStatedYears: number;
  workHistoryYears: number;
  experienceDiscrepancy: number; // profile - workHistory
  hasExperienceDiscrepancy: boolean;
  candidateLocation: string;
  jobLocation: string;
  isLocationMissing: boolean;
  atsScore: number | null;
  atsThreshold: number;
  isAtsPassed: boolean;
}

export const MANDATORY_ATS_THRESHOLD = 80;

/**
 * Evaluates application readiness and returns structured blockers.
 */
export function evaluateApplicationReadiness(
  params: ReadinessEvaluationParams
): ReadinessEvaluationResult {
  const {
    candidate,
    job,
    currentAtsScore,
    atsThreshold = MANDATORY_ATS_THRESHOLD,
    isExperienceConfirmed = false
  } = params;

  const blockers: ReadinessBlocker[] = [];

  // 1. Profile Core Field Requirements
  const candidateName = candidate?.name || candidate?.fullName || '';
  if (!candidateName.trim()) {
    blockers.push({
      id: 'OTHER_REQUIRED_FIELD',
      field: 'name',
      title: 'Missing Candidate Name',
      description: 'Your candidate profile requires a full legal or professional name to apply.',
      severity: 'BLOCKING',
      actionLabel: 'Add Name'
    });
  }

  if (!candidate?.email || candidate.email.trim() === '') {
    blockers.push({
      id: 'OTHER_REQUIRED_FIELD',
      field: 'email',
      title: 'Missing Email Address',
      description: 'A verified contact email is required for employers and application tracking.',
      severity: 'BLOCKING',
      actionLabel: 'Add Email'
    });
  }

  if (!candidate?.phone || candidate.phone.trim() === '') {
    blockers.push({
      id: 'OTHER_REQUIRED_FIELD',
      field: 'phone',
      title: 'Missing Phone Number',
      description: 'A phone number is required to complete submission requirements.',
      severity: 'BLOCKING',
      actionLabel: 'Add Phone'
    });
  }

  // 2. Candidate Location vs Job Location
  const candidateLocation = (candidate?.location || '').trim();
  const jobLocation = (job?.location || '').trim();
  const isLocationMissing = !candidateLocation;

  if (isLocationMissing) {
    blockers.push({
      id: 'MISSING_CANDIDATE_LOCATION',
      title: 'Missing Candidate Location',
      description: `Target job is located at "${jobLocation || 'Specified by employer'}". Your candidate profile location is missing.`,
      severity: 'BLOCKING',
      actionLabel: 'Add Location'
    });
  }

  // 3. Experience Discrepancy Evaluation
  const profileStatedYears = candidate?.yearsOfExperience ?? 0;
  const workHistoryYears = calculateWorkHistoryExperienceYears(candidate?.experiences);
  const diff = Math.round(Math.abs(profileStatedYears - workHistoryYears) * 10) / 10;
  
  // A discrepancy exists if both values are defined and differ by 1.0 or more years
  const hasExperienceDiscrepancy = (profileStatedYears > 0 || workHistoryYears > 0) && diff >= 1.0;

  if (hasExperienceDiscrepancy && !isExperienceConfirmed) {
    blockers.push({
      id: 'PROFILE_DATA_CONFLICT',
      title: 'Profile & Resume Experience Discrepancy',
      description: `Profile stated experience is ${profileStatedYears} yrs, while verified employment records total ${workHistoryYears} yrs (difference: ${diff} yrs). Review or confirm this breakdown before proceeding.`,
      severity: 'BLOCKING',
      actionLabel: 'Review Experience'
    });
  }

  // 4. ATS Gate (Mandatory >= 80%)
  const isAtsPassed = typeof currentAtsScore === 'number' && currentAtsScore >= atsThreshold;
  if (!isAtsPassed) {
    if (typeof currentAtsScore === 'number') {
      blockers.push({
        id: 'ATS_BELOW_THRESHOLD',
        title: 'ATS Below Mandatory Threshold',
        description: `Current ATS score for this job is ${currentAtsScore}%. Minimum required threshold to submit is ${atsThreshold}%. Tailor your resume to bridge missing skill keywords.`,
        severity: 'BLOCKING',
        actionLabel: 'Improve Resume'
      });
    } else {
      blockers.push({
        id: 'ATS_BELOW_THRESHOLD',
        title: 'ATS Compatibility Calculation Unavailable',
        description: `ATS compatibility has not yet been computed for this job and resume. Click "Run ATS Check" to calculate before submitting.`,
        severity: 'BLOCKING',
        actionLabel: 'Run ATS Check'
      });
    }
  }

  // 5. Job Availability
  if (!job) {
    blockers.push({
      id: 'OTHER_REQUIRED_FIELD',
      field: 'job',
      title: 'Target Job Unavailable',
      description: 'The job posting details could not be verified.',
      severity: 'BLOCKING'
    });
  }

  return {
    isReady: blockers.length === 0,
    blockers,
    profileStatedYears,
    workHistoryYears,
    experienceDiscrepancy: diff,
    hasExperienceDiscrepancy,
    candidateLocation,
    jobLocation,
    isLocationMissing,
    atsScore: typeof currentAtsScore === 'number' ? currentAtsScore : null,
    atsThreshold,
    isAtsPassed
  };
}
