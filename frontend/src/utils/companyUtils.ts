/**
 * Normalizes and validates company identities to prevent marketing slogans,
 * headlines, or generic page titles from leaking into candidate workflows as the employer name.
 */

const KNOWN_SLOGAN_MAPPINGS: Array<{ pattern: RegExp; canonical: string }> = [
  { pattern: /do\s+the\s+work\s+that\s+matters/i, canonical: 'Caterpillar' },
  { pattern: /caterpillar/i, canonical: 'Caterpillar' },
  { pattern: /hexaware/i, canonical: 'Hexaware Technologies' },
  { pattern: /maveric/i, canonical: 'Maveric Systems' },
  { pattern: /virtusa/i, canonical: 'Virtusa' },
  { pattern: /raintech/i, canonical: 'Raintech Software' },
  { pattern: /codewalla/i, canonical: 'Codewalla' },
  { pattern: /codfis/i, canonical: 'Codfis Technologies' },
  { pattern: /infosys/i, canonical: 'Infosys' },
  { pattern: /synechron/i, canonical: 'Synechron' },
  { pattern: /yellow\.?ai/i, canonical: 'Yellow.ai' },
  { pattern: /gnani\.?ai/i, canonical: 'Gnani.ai' },
  { pattern: /publicis\s+sapient/i, canonical: 'Publicis Sapient' }
];

const GENERIC_SLOGANS_LIST = [
  'do the work that matters',
  'make an impact',
  'explore opportunities',
  'join our team',
  'careers',
  'jobs',
  'working at',
  'work with us',
  'life at',
  'future of work',
  'grow with us',
  'open positions',
  'career opportunities'
];

/**
 * Returns the true canonical company name given raw company text, job URL, or source domain.
 */
export function getCanonicalCompanyName(
  rawCompany?: string | null,
  sourceUrl?: string | null,
  applicationUrl?: string | null
): string {
  const urlCombined = `${sourceUrl || ''} ${applicationUrl || ''}`.toLowerCase();
  const raw = (rawCompany || '').trim();
  const rawLower = raw.toLowerCase();

  // 1. Check known slogan/branding mappings first (e.g. "Do the Work that Matters" -> "Caterpillar")
  for (const mapping of KNOWN_SLOGAN_MAPPINGS) {
    if (mapping.pattern.test(rawLower) || mapping.pattern.test(urlCombined)) {
      return mapping.canonical;
    }
  }

  // 2. Reject marketing slogans that don't have a known map
  const isGenericSlogan = GENERIC_SLOGANS_LIST.some(s =>
    rawLower === s || rawLower.startsWith(`${s} `) || rawLower.endsWith(` ${s}`)
  );

  if (isGenericSlogan || !raw || raw === 'Company' || raw === 'Target Employer') {
    // Attempt fallback from domain
    const candidateUrl = applicationUrl || sourceUrl;
    if (candidateUrl) {
      try {
        const hostname = new URL(candidateUrl).hostname.replace(/^www\./, '').replace(/^careers?\./, '').replace(/^jobs?\./, '');
        const brand = hostname.split('.')[0];
        if (brand && brand.length >= 2) {
          return brand.charAt(0).toUpperCase() + brand.slice(1);
        }
      } catch {
        // Ignored
      }
    }
    return 'Target Employer';
  }

  return raw;
}
