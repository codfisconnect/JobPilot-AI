/**
 * Centralized Target URL Resolution for Job Applications (Backend Copy / Invariant Engine).
 */

export type ApplicationTargetClassification =
  | 'EXACT_APPLICATION_TARGET'
  | 'EXACT_JOB_TARGET'
  | 'GENERIC_CAREERS_TARGET'
  | 'NO_APPLICATION_TARGET';

export interface ResolvedApplicationTarget {
  classification: ApplicationTargetClassification;
  url: string | null;
  isExact: boolean;
  displayWarning: string | null;
  buttonLabel: string;
}

export interface JobTargetInput {
  applicationUrl?: string | null;
  jobDetailUrl?: string | null;
  sourceUrl?: string | null;
  companyCareersUrl?: string | null;
  externalJobId?: string | null;
}

export function isGenericCareersUrl(rawUrl?: string | null): boolean {
  if (!rawUrl || typeof rawUrl !== 'string') return true;
  const url = rawUrl.trim();
  if (!url) return true;

  if (url.includes('ripplehire.com') && (url.endsWith('#list') || url.includes('#list') || !url.includes('#detail/job/'))) {
    return true;
  }

  if (url.includes('myworkdayjobs.com') && !url.includes('/job/')) {
    return true;
  }

  const cleanUrl = url.split('#')[0].replace(/\/+$/, '');
  
  if (
    cleanUrl === 'https://www.synechron.com/careers' ||
    cleanUrl === 'https://synechron.com/careers' ||
    cleanUrl === 'https://bahwancybertek.com/careers' ||
    cleanUrl === 'https://www.bahwancybertek.com/careers'
  ) {
    return true;
  }

  try {
    const parsed = new URL(url);
    const path = parsed.pathname.toLowerCase().replace(/\/+$/, '');

    if (path === '' || path === '/') {
      return true;
    }

    const genericPaths = [
      '/careers',
      '/en/careers',
      '/us/careers',
      '/en-us/careers',
      '/jobs',
      '/en/jobs',
      '/us/jobs',
      '/en-us/jobs',
      '/careers/job-search',
      '/job-search',
      '/openings'
    ];

    if (genericPaths.includes(path) && !parsed.hash.includes('detail') && !parsed.searchParams.has('jobId') && !parsed.searchParams.has('id')) {
      return true;
    }
  } catch {
    return true;
  }

  return false;
}

export function resolveApplicationTarget(job: JobTargetInput): ResolvedApplicationTarget {
  const appUrl = (job.applicationUrl || '').trim();
  const detailUrl = (job.jobDetailUrl || '').trim();
  const srcUrl = (job.sourceUrl || '').trim();

  if (appUrl && !isGenericCareersUrl(appUrl)) {
    return {
      classification: 'EXACT_APPLICATION_TARGET',
      url: appUrl,
      isExact: true,
      displayWarning: null,
      buttonLabel: 'Continue to Employer Application'
    };
  }

  if (detailUrl && !isGenericCareersUrl(detailUrl)) {
    return {
      classification: 'EXACT_JOB_TARGET',
      url: detailUrl,
      isExact: true,
      displayWarning: null,
      buttonLabel: 'Continue to Employer Application'
    };
  }

  if (srcUrl && !isGenericCareersUrl(srcUrl)) {
    return {
      classification: 'EXACT_JOB_TARGET',
      url: srcUrl,
      isExact: true,
      displayWarning: null,
      buttonLabel: 'Continue to Employer Application'
    };
  }

  const fallbackUrl = appUrl || detailUrl || srcUrl || (job.companyCareersUrl || '').trim() || null;

  if (fallbackUrl) {
    return {
      classification: 'GENERIC_CAREERS_TARGET',
      url: fallbackUrl,
      isExact: false,
      displayWarning: 'Exact application link unavailable for this job. Target will open employer careers portal as fallback.',
      buttonLabel: 'Open Employer Careers Page'
    };
  }

  return {
    classification: 'NO_APPLICATION_TARGET',
    url: null,
    isExact: false,
    displayWarning: 'Exact application link unavailable for this job.',
    buttonLabel: 'Application Unavailable'
  };
}
