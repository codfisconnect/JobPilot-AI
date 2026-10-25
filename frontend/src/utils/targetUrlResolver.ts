/**
 * Centralized Target URL Resolution for Job Applications.
 *
 * Implements strict Pilot Mama business invariants:
 * - URL Priority:
 *   1. job.applicationUrl (if exact, e.g. #detail/job/<id>, Workday job requisition, Greenhouse/Lever application)
 *   2. job.jobDetailUrl (if separately stored and exact)
 *   3. job.sourceUrl (ONLY when genuinely job-specific, e.g. contains deep link / job sequence)
 * - NEVER silently fall back to:
 *   - company.careersUrl
 *   - generic company careers homepage (/careers)
 *   - generic job listing / search page (/jobs, #list)
 * - Classifies targets into:
 *   - EXACT_APPLICATION_TARGET
 *   - EXACT_JOB_TARGET
 *   - GENERIC_CAREERS_TARGET
 *   - NO_APPLICATION_TARGET
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

/**
 * Checks whether a given URL is a generic careers landing page, root domain, or #list view
 * rather than a specific job application or job detail page.
 */
export function isGenericCareersUrl(rawUrl?: string | null): boolean {
  if (!rawUrl || typeof rawUrl !== 'string') return true;
  const url = rawUrl.trim();
  if (!url) return true;

  // RippleHire generic list check
  if (url.includes('ripplehire.com') && (url.endsWith('#list') || url.includes('#list') || !url.includes('#detail/job/'))) {
    return true;
  }

  // Workday generic careers / search check
  if (url.includes('myworkdayjobs.com') && !url.includes('/job/')) {
    return true;
  }

  // Clean trailing slashes and hash for generic path checking
  const cleanUrl = url.split('#')[0].replace(/\/+$/, '');
  
  // Specific known generic careers portals
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

    // Root path with no subpath or query indicating a specific job
    if (path === '' || path === '/') {
      return true;
    }

    // Generic paths with no slug or requisition ID
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
    // Malformed URL treated as generic/invalid
    return true;
  }

  return false;
}

/**
 * Resolves the authoritative application target using strict priority order.
 */
export function resolveApplicationTarget(job: JobTargetInput): ResolvedApplicationTarget {
  const appUrl = (job.applicationUrl || '').trim();
  const detailUrl = (job.jobDetailUrl || '').trim();
  const srcUrl = (job.sourceUrl || '').trim();

  // 1. Check applicationUrl
  if (appUrl && !isGenericCareersUrl(appUrl)) {
    return {
      classification: 'EXACT_APPLICATION_TARGET',
      url: appUrl,
      isExact: true,
      displayWarning: null,
      buttonLabel: 'Continue to Employer Application'
    };
  }

  // 2. Check jobDetailUrl
  if (detailUrl && !isGenericCareersUrl(detailUrl)) {
    return {
      classification: 'EXACT_JOB_TARGET',
      url: detailUrl,
      isExact: true,
      displayWarning: null,
      buttonLabel: 'Continue to Employer Application'
    };
  }

  // 3. Check sourceUrl only if genuinely job-specific
  if (srcUrl && !isGenericCareersUrl(srcUrl)) {
    return {
      classification: 'EXACT_JOB_TARGET',
      url: srcUrl,
      isExact: true,
      displayWarning: null,
      buttonLabel: 'Continue to Employer Application'
    };
  }

  // 4. All job-specific targets failed or only generic links available
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
