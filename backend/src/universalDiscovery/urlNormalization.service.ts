export interface NormalizedUrlResult {
  rawUrl: string;
  normalizedUrl: string;
  baseUrl: string;
  domain: string;
  searchParams: Record<string, string>;
  hash: string;
  hashParams: Record<string, string>;
  isAtsSubdomain: boolean;
  detectedVendorHint?: string;
  sanitizedLogUrl: string;
}

export class UrlNormalizationService {
  private static readonly KNOWN_ATS_DOMAINS: Record<string, string> = {
    'ripplehire.com': 'RIPPLEHIRE',
    'myworkdayjobs.com': 'WORKDAY',
    'icims.com': 'ICIMS',
    'greenhouse.io': 'GREENHOUSE',
    'lever.co': 'LEVER',
    'ashbyhq.com': 'ASHBY',
    'smartrecruiters.com': 'SMARTRECRUITERS',
    'jobvite.com': 'JOBVITE',
    'taleo.net': 'TALEO',
    'oraclecloud.com': 'ORACLE_RECRUITING',
    'successfactors.com': 'SUCCESSFACTORS',
    'avature.net': 'AVATURE',
    'phenompeople.com': 'PHENOM',
    'workable.com': 'WORKABLE',
    'breezy.hr': 'BREEZY',
    'recruitee.com': 'RECRUITEE',
    'jazz.co': 'JAZZHR',
    'teamtailor.com': 'TEAMTAILOR',
    'pinpointhq.com': 'PINPOINT',
    'bamboohr.com': 'BAMBOOHR'
  };

  /**
   * Normalizes a user-supplied careers/jobs URL.
   * Dissects query parameters, hash fragments, ATS vendor subdomains,
   * and prepares a redacted safe logging URL.
   */
  public static normalize(rawInput: string): NormalizedUrlResult {
    const raw = (rawInput || '').trim();
    if (!raw) {
      throw new Error('URL must not be empty.');
    }

    let urlObj: URL;
    try {
      urlObj = new URL(raw.startsWith('http://') || raw.startsWith('https://') ? raw : `https://${raw}`);
    } catch {
      throw new Error(`Invalid URL format: ${raw}`);
    }

    // Force lower-case protocol and hostname
    urlObj.protocol = urlObj.protocol.toLowerCase();
    urlObj.hostname = urlObj.hostname.toLowerCase();

    let domain = urlObj.hostname;
    if (domain.startsWith('www.')) {
      domain = domain.slice(4);
    }

    const searchParams: Record<string, string> = {};
    urlObj.searchParams.forEach((val, key) => {
      searchParams[key] = val;
    });

    const hash = urlObj.hash ? urlObj.hash.slice(1) : '';
    const hashParams: Record<string, string> = {};
    if (hash.includes('?')) {
      const hashQuery = hash.slice(hash.indexOf('?') + 1);
      const subParams = new URLSearchParams(hashQuery);
      subParams.forEach((v, k) => {
        hashParams[k] = v;
      });
    }

    // Identify vendor hint if subdomain or domain matches
    let isAtsSubdomain = false;
    let detectedVendorHint: string | undefined;

    for (const [vendorDomain, vendorName] of Object.entries(this.KNOWN_ATS_DOMAINS)) {
      if (domain === vendorDomain || domain.endsWith('.' + vendorDomain)) {
        isAtsSubdomain = true;
        detectedVendorHint = vendorName;
        break;
      }
    }

    // Redacted URL for logs and safe display
    const sanitizedUrl = new URL(urlObj.toString());
    const sensitiveKeys = ['token', 'secret', 'key', 'auth', 'apikey', 'api_key', 'access_token', 'password', 'bearer'];
    for (const key of sanitizedUrl.searchParams.keys()) {
      if (sensitiveKeys.some(s => key.toLowerCase().includes(s))) {
        sanitizedUrl.searchParams.set(key, '[REDACTED]');
      }
    }

    return {
      rawUrl: raw,
      normalizedUrl: urlObj.toString(),
      baseUrl: `${urlObj.protocol}//${urlObj.host}`,
      domain,
      searchParams,
      hash,
      hashParams,
      isAtsSubdomain,
      detectedVendorHint,
      sanitizedLogUrl: decodeURIComponent(sanitizedUrl.toString())
    };
  }

  /**
   * Sanitizes any URL for logging or UI display by redacting token values.
   */
  public static sanitizeUrlForLog(urlStr: string): string {
    try {
      const u = new URL(urlStr);
      const sensitiveKeys = ['token', 'secret', 'key', 'auth', 'apikey', 'api_key', 'access_token', 'password', 'bearer'];
      for (const k of u.searchParams.keys()) {
        if (sensitiveKeys.some(s => k.toLowerCase().includes(s))) {
          u.searchParams.set(k, '[REDACTED]');
        }
      }
      return u.toString();
    } catch {
      return urlStr;
    }
  }
}
