import * as cheerio from 'cheerio';
import crypto from 'crypto';
import { safeFetchUrl } from '../utils/safeFetch.js';
import { logger } from '../utils/logger.js';

export interface ExtractedHtmlJob {
  externalJobId?: string;
  title: string;
  department?: string;
  location?: string;
  workMode?: string;
  employmentType?: string;
  experience?: string;
  salary?: string;
  qualification?: string;
  summary?: string;
  description: string;
  responsibilities?: string[];
  requirements?: string[];
  skills?: string[];
  preferredSkills?: string[];
  openingCount?: number;
  applicationUrl?: string;
  detailUrl?: string;
  postedAt?: string;
  deadline?: string;
  confidence: number;
}

export interface HtmlExtractionResult {
  strategy: 'REPEATED_DOM_STRUCTURE' | 'DETAIL_PAGES' | 'HYBRID_ACCORDION';
  jobs: ExtractedHtmlJob[];
  jobLinksFound: number;
  jobDetailPagesVisited: number;
  confidence: number;
}

export interface HtmlDiscoveryOptions {
  maxDetailPages?: number;
  timeoutMs?: number;
  onlySameOrigin?: boolean;
}

export class HtmlJobDiscoveryService {
  private static readonly JOB_TITLE_KEYWORDS = [
    'engineer', 'developer', 'architect', 'manager', 'lead', 'specialist',
    'analyst', 'designer', 'consultant', 'administrator', 'director',
    'officer', 'executive', 'technician', 'intern', 'associate', 'tester',
    'sdet', 'qa', 'frontend', 'backend', 'full stack', 'fullstack', 'devops',
    'cloud', 'mobile', 'android', 'ios', 'data', 'product', 'scrum'
  ];

  private static readonly NEGATIVE_TITLE_KEYWORDS = [
    'cookie', 'privacy', 'policy', 'terms', 'subscribe', 'newsletter',
    'contact us', 'about us', 'our story', 'read more', 'learn more',
    'view all', 'filter', 'search', 'menu', 'navigation', 'footer',
    'copyright', 'blog', 'news', 'press', 'login', 'sign in', 'register'
  ];

  /**
   * Sanitizes raw HTML into clean, human-readable plain text.
   * Strips scripts, styles, forms, navigation and normalizes whitespace while preserving structure.
   */
  public static cleanHtmlToText(rawHtml: string): string {
    if (!rawHtml) return '';
    try {
      const $ = cheerio.load(rawHtml);
      $('script, style, noscript, iframe, svg, form, input, button, select, nav, header, footer').remove();
      
      // Replace block elements with linebreaks to maintain spacing
      $('p, div, li, br, h1, h2, h3, h4, h5, h6, tr').each((_, el) => {
        $(el).append('\n');
      });

      return $.text()
        .replace(/[ \t]+/g, ' ')
        .replace(/\n\s*\n+/g, '\n\n')
        .trim();
    } catch {
      return rawHtml.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
    }
  }

  /**
   * Evaluates whether a candidate string is likely a job title.
   */
  public static scoreTitleText(text: string): { isTitle: boolean; score: number } {
    const clean = text.replace(/\s+/g, ' ').trim();
    if (clean.length < 3 || clean.length > 120) {
      return { isTitle: false, score: 0 };
    }

    const lower = clean.toLowerCase();

    // Negative check
    for (const neg of this.NEGATIVE_TITLE_KEYWORDS) {
      if (lower === neg || lower.startsWith(neg + ' ') || lower.endsWith(' ' + neg)) {
        return { isTitle: false, score: 0 };
      }
    }

    let score = 0;
    for (const kw of this.JOB_TITLE_KEYWORDS) {
      if (lower.includes(kw)) {
        score += 30;
      }
    }

    // Typical title length is 10 to 70 chars
    if (clean.length >= 8 && clean.length <= 70) {
      score += 15;
    }

    // Capitalization signal
    if (/^[A-Z]/.test(clean)) {
      score += 5;
    }

    return { isTitle: score >= 30, score };
  }

  /**
   * Derives a deterministic external ID if an explicit one is not present.
   */
  public static computeDeterministicId(sourceUrl: string, title: string, detailUrl?: string): string {
    if (detailUrl && detailUrl.trim().length > 0) {
      return detailUrl.trim();
    }
    const seed = `${sourceUrl.trim().toLowerCase()}|${title.trim().toLowerCase()}`;
    return 'HTML-' + crypto.createHash('sha256').update(seed).digest('hex').substring(0, 16);
  }

  /**
   * Extracts metadata fields from structured text lines / labels.
   */
  public static extractFieldsFromText(text: string): {
    experience?: string;
    location?: string;
    employmentType?: string;
    workMode?: string;
    salary?: string;
  } {
    const fields: {
      experience?: string;
      location?: string;
      employmentType?: string;
      workMode?: string;
      salary?: string;
    } = {};

    // Normalize line-by-line matches
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

    for (const line of lines) {
      if (!fields.experience) {
        const exp = line.match(/(?:experience|exp|yoe)\s*[:\-–]\s*([^;\n\r]+)/i) ||
                    line.match(/^(\d+\+?\s*(?:to|-)?\s*\d*\s*(?:years?|yrs?)[^;\n\r]*)/i);
        if (exp) {
          // Clean out any trailing field prefixes like Location: or Employment Type:
          fields.experience = exp[1].replace(/(?:location|employment|job|work).*$/i, '').trim();
        }
      }

      if (!fields.location) {
        const loc = line.match(/(?:location|loc|place|city)\s*[:\-–]\s*([^;\n\r]+)/i);
        if (loc) {
          fields.location = loc[1].replace(/(?:experience|employment|job|work|what).*$/i, '').trim();
        }
      }

      if (!fields.employmentType) {
        const emp = line.match(/(?:employment\s*type|job\s*type|type)\s*[:\-–]\s*([^;\n\r]+)/i);
        if (emp) {
          fields.employmentType = emp[1].replace(/(?:experience|location|what|do).*$/i, '').trim();
        }
      }

      if (!fields.workMode) {
        const mode = line.match(/(?:work\s*mode|workplace|workplace\s*type)\s*[:\-–]\s*([^;\n\r]+)/i);
        if (mode) {
          fields.workMode = mode[1].trim();
        }
      }

      if (!fields.salary) {
        const sal = line.match(/(?:salary|compensation|ctc|pay)\s*[:\-–]\s*([^;\n\r]+)/i) ||
                    line.match(/([₹$€£]\s*[\d,]+(?:\s*-\s*[₹$€£]?\s*[\d,]+)?(?:\s*(?:k|lakhs?|inr|usd|eur|gbp|per\s*(?:year|annum|month)))?)/i);
        if (sal) {
          fields.salary = sal[1].trim();
        }
      }
    }

    // Fallback regex over whole text if line-by-line missed
    if (!fields.experience) {
      const exp = text.match(/(?:experience|exp|yoe)\s*[:\-–]\s*([^\n\r,;]+)/i);
      if (exp) fields.experience = exp[1].replace(/(?:location|employment|job|work).*$/i, '').trim();
    }
    if (!fields.location) {
      const loc = text.match(/(?:location|loc|place|city)\s*[:\-–]\s*([^\n\r,;]+)/i);
      if (loc) fields.location = loc[1].replace(/(?:experience|employment|job|work).*$/i, '').trim();
    }
    if (!fields.employmentType) {
      const emp = text.match(/(?:employment\s*type|job\s*type|type)\s*[:\-–]\s*([^\n\r,;]+)/i);
      if (emp) fields.employmentType = emp[1].replace(/(?:experience|location|what|do).*$/i, '').trim();
    }

    return fields;
  }

  /**
   * Primary entry point: Extracts job listings from HTML page using
   * Repeated DOM Structure analysis, In-Page Accordion analysis, or Detail-Page Crawling.
   */
  public static async extractJobsFromHtml(
    pageUrl: string,
    html: string,
    options: HtmlDiscoveryOptions = {}
  ): Promise<HtmlExtractionResult | null> {
    const $ = cheerio.load(html);
    const baseUrl = new URL(pageUrl);
    const maxDetailPages = options.maxDetailPages || 30;

    // Remove only non-content interactive and styling elements
    $('script, style, noscript, iframe, svg, form, input, button, select').remove();

    // -------------------------------------------------------------
    // STRATEGY 1: Repeated Container / Accordion Discovery
    // Searches for repeated sibling elements (class, tag, or role)
    // containing titles, job metadata, descriptions, and/or apply links.
    // -------------------------------------------------------------
    const candidateContainers: {
      el: cheerio.Cheerio<any>;
      score: number;
      jobs: ExtractedHtmlJob[];
    }[] = [];

    // Identify candidate container groups by scanning common repeating patterns
    const repeatingSelectors = [
      '[class*="accordion"]',
      '[class*="job-item"]',
      '[class*="job_item"]',
      '[class*="job-card"]',
      '[class*="job_card"]',
      '[class*="opening"]',
      '[class*="position"]',
      '[class*="career"]',
      '[class*="vacancy"]',
      '[class*="role"]',
      '[class*="card"]',
      '[class*="list-item"]',
      'article',
      'ul > li',
      'div > div'
    ];

    for (const selector of repeatingSelectors) {
      try {
        const matches = $(selector);
        if (matches.length < 2 || matches.length > 200) continue;

        // Group matches by parent element to find true sibling collections
        const parentMap = new Map<any, any[]>();
        matches.each((_, el) => {
          const parent = el.parentNode;
          if (parent) {
            const list = parentMap.get(parent) || [];
            list.push(el);
            parentMap.set(parent, list);
          }
        });

        for (const [_, siblings] of parentMap.entries()) {
          if (siblings.length < 2) continue;

          // Test if these siblings look like job postings
          const extracted: ExtractedHtmlJob[] = [];
          let totalScore = 0;

          for (const item of siblings) {
            const $item = $(item);
            const itemText = $item.text().trim();
            if (itemText.length < 25) continue; // Too short to be a job

            // 1. Locate title
            let titleCandidate = '';
            let titleScore = 0;

            // Priority: explicit question/title/header classes, then h1-h6, strong, p
            const titleElements = $item.find('[class*="question"], [class*="title"], [class*="heading"], [class*="role"], [class*="name"], h1, h2, h3, h4, h5, h6, strong, p');
            
            titleElements.each((_, tEl) => {
              if (titleCandidate) return;
              const text = $(tEl).text().trim();
              const scored = this.scoreTitleText(text);
              if (scored.isTitle && scored.score > titleScore) {
                titleCandidate = text;
                titleScore = scored.score;
              }
            });

            if (!titleCandidate) {
              // Try checking the first non-empty text node
              const firstLine = itemText.split('\n')[0].trim();
              const scored = this.scoreTitleText(firstLine);
              if (scored.isTitle) {
                titleCandidate = firstLine;
                titleScore = scored.score;
              }
            }

            if (!titleCandidate) continue;

            // 2. Locate Apply Link or Detail URL
            let applyUrl: string | undefined;
            let detailUrl: string | undefined;

            $item.find('a').each((_, aEl) => {
              const href = $(aEl).attr('href');
              const aText = $(aEl).text().trim().toLowerCase();
              if (!href) return;

              let resolved: string;
              try {
                resolved = new URL(href, baseUrl.origin).toString();
              } catch {
                resolved = href;
              }

              if (href.startsWith('mailto:') || aText.includes('apply') || href.includes('apply') || href.includes('linkedin.com/jobs')) {
                applyUrl = resolved;
              } else if (
                aText.includes('view detail') || aText.includes('view role') || aText.includes('view job') ||
                aText.includes('job detail') || aText.includes('learn more') ||
                href.includes('job') || href.includes('career') || href.includes('opening') || href.includes('position')
              ) {
                detailUrl = resolved;
              }
            });

            // 3. Extract Metadata & Description
            const metaFields = this.extractFieldsFromText(itemText);

            // If location was not found via explicit label, inspect meta badges/spans
            if (!metaFields.location) {
              $item.find('[class*="meta"] span, [class*="badge"], [class*="tag"], [class*="location"], span, li').each((_, sEl) => {
                if (metaFields.location) return;
                const spanText = $(sEl).text().trim();
                // Check for "City, State/Country" or "Infopark, Kochi" or similar location patterns
                if (/^[A-Za-z\s]+,\s*[A-Za-z\s]+$/.test(spanText) && spanText.length >= 4 && spanText.length <= 60) {
                  // Ensure it's not experience e.g. "Full-time" or "2-4 Years"
                  if (!spanText.includes('Year') && !spanText.includes('time') && !spanText.includes('Opening')) {
                    metaFields.location = spanText;
                  }
                }
              });
            }

            // Extract opening/vacancy count if present (e.g. "3 Openings", "2 Vacancies")
            let openingCount: number | undefined;
            const openingMatch = itemText.match(/(\d+)\s*(?:openings?|vacancies|positions?|seats?)/i);
            if (openingMatch) {
              const parsedCount = parseInt(openingMatch[1], 10);
              if (!isNaN(parsedCount) && parsedCount > 0 && parsedCount < 500) {
                openingCount = parsedCount;
              }
            }
            
            // Extract responsibilities and requirements lists if present
            const responsibilities: string[] = [];
            const requirements: string[] = [];
            const skills: string[] = [];

            $item.find('ul, ol').each((_, listEl) => {
              // Only process top-level lists in this group to avoid double-processing nested ULs
              if ($(listEl).parents('ul, ol').length > 0) return;

              let currentSection: 'RESPONSIBILITIES' | 'REQUIREMENTS' | 'NONE' = 'NONE';

              $(listEl).find('li').each((_, li) => {
                const liText = $(li).clone().children('ul, ol').remove().end().text().trim();
                if (!liText) return;

                const lowerLi = liText.toLowerCase();
                if (lowerLi.includes("what you'll do") || lowerLi.includes('responsibilit') || lowerLi.includes('what you will do') || lowerLi.includes('duties')) {
                  currentSection = 'RESPONSIBILITIES';
                  return;
                } else if (lowerLi.includes('what makes you a great fit') || lowerLi.includes('requirement') || lowerLi.includes('qualification') || lowerLi.includes('who you are') || lowerLi.includes('skills')) {
                  currentSection = 'REQUIREMENTS';
                  return;
                }

                // If not a heading, it's a bullet item
                if (currentSection === 'RESPONSIBILITIES') {
                  responsibilities.push(liText);
                } else if (currentSection === 'REQUIREMENTS') {
                  requirements.push(liText);
                }
              });
            });

            // Clean description
            const cleanDescription = this.cleanHtmlToText($item.html() || itemText);

            // Compute confidence score
            let itemScore = titleScore; // +30 or more
            if (applyUrl) itemScore += 25;
            if (detailUrl) itemScore += 20;
            if (metaFields.location) itemScore += 15;
            if (metaFields.experience) itemScore += 15;
            if (metaFields.employmentType) itemScore += 10;
            if (cleanDescription.length > 150) itemScore += 15;
            if (responsibilities.length > 0 || requirements.length > 0) itemScore += 15;

            if (itemScore >= 60) {
              extracted.push({
                externalJobId: this.computeDeterministicId(pageUrl, titleCandidate, detailUrl || applyUrl),
                title: titleCandidate,
                location: metaFields.location,
                workMode: metaFields.workMode,
                employmentType: metaFields.employmentType,
                experience: metaFields.experience,
                salary: metaFields.salary,
                description: cleanDescription,
                responsibilities: responsibilities.length > 0 ? responsibilities : undefined,
                requirements: requirements.length > 0 ? requirements : undefined,
                skills: skills.length > 0 ? skills : undefined,
                openingCount: openingCount,
                applicationUrl: applyUrl || detailUrl || pageUrl,
                detailUrl: detailUrl,
                confidence: itemScore
              });
              totalScore += itemScore;
            }
          }

          if (extracted.length >= 2) {
            candidateContainers.push({
              el: $(siblings[0]),
              score: totalScore,
              jobs: extracted
            });
          }
        }
      } catch (err: any) {
        // Continue scanning other selectors
      }
    }

    // If we found repeated in-page job structures with high confidence:
    if (candidateContainers.length > 0) {
      candidateContainers.sort((a, b) => b.score - a.score);
      const best = candidateContainers[0];
      logger.info(`[HtmlJobDiscoveryService] Repeated DOM structure matched with ${best.jobs.length} jobs (Score: ${best.score})`);

      return {
        strategy: 'REPEATED_DOM_STRUCTURE',
        jobs: best.jobs,
        jobLinksFound: best.jobs.filter(j => j.detailUrl || j.applicationUrl).length,
        jobDetailPagesVisited: 0,
        confidence: Math.round(best.score / best.jobs.length)
      };
    }

    // -------------------------------------------------------------
    // STRATEGY 1B: Direct Job Card Anchors
    // For modern SPA/React/Next.js pages where repeated jobs are structured
    // as cards linking to external ATS systems (Workday, Greenhouse, Lever, etc.)
    // or specific job detail URLs on or off origin.
    // -------------------------------------------------------------
    const directJobCards: ExtractedHtmlJob[] = [];
    const seenCardUrls = new Set<string>();

    const atsAndJobRegex = /(?:myworkdayjobs\.com|greenhouse\.io|lever\.co|smartrecruiters\.com|ashbyhq\.com|jobvite\.com|workable\.com|breezy\.hr|icims\.com|taleo\.net|\/job\/|\/jobs\/)/i;

    $('a').each((_, aEl) => {
      const href = $(aEl).attr('href');
      if (!href) return;

      let resolvedUrl: string;
      try {
        resolvedUrl = new URL(href, baseUrl.origin).toString();
      } catch {
        resolvedUrl = href;
      }

      if (seenCardUrls.has(resolvedUrl)) return;

      if (atsAndJobRegex.test(resolvedUrl)) {
        // Exclude general marketing/overview pages
        const lowerUrl = resolvedUrl.toLowerCase();
        if (
          lowerUrl.includes('/expertise/') || lowerUrl.includes('/services/') ||
          lowerUrl.includes('/solutions/') || lowerUrl.includes('/case-studies/') ||
          lowerUrl.endsWith('/careers') || lowerUrl.endsWith('/jobs')
        ) {
          return;
        }

        const $a = $(aEl);
        // Find nearest enclosing card container or use anchor itself
        const $card = $a.closest('div[class*="rounded"], div[class*="border"], div[class*="card"], li, article');
        const container = $card.length ? $card : $a;

        const titleEl = container.find('h1, h2, h3, h4, h5, [class*="title"]').first();
        const candidateTitle = titleEl.text().trim() || $a.text().replace(/\s+/g, ' ').trim();
        const scoredTitle = this.scoreTitleText(candidateTitle);

        if (scoredTitle.isTitle) {
          seenCardUrls.add(resolvedUrl);
          const rawCardText = container.text().replace(/\s+/g, ' ').trim();
          const meta = this.extractFieldsFromText(rawCardText);
          const cleanDesc = this.cleanHtmlToText(container.html() || rawCardText);

          directJobCards.push({
            externalJobId: resolvedUrl,
            title: candidateTitle,
            location: meta.location,
            workMode: meta.workMode,
            employmentType: meta.employmentType,
            experience: meta.experience,
            salary: meta.salary,
            description: cleanDesc.length > 50 ? cleanDesc : rawCardText,
            applicationUrl: resolvedUrl,
            detailUrl: resolvedUrl,
            confidence: 85
          });
        }
      }
    });

    if (directJobCards.length >= 2) {
      logger.info(`[HtmlJobDiscoveryService] Direct Job Card Anchors matched with ${directJobCards.length} jobs`);
      return {
        strategy: 'REPEATED_DOM_STRUCTURE',
        jobs: directJobCards,
        jobLinksFound: directJobCards.length,
        jobDetailPagesVisited: 0,
        confidence: 85
      };
    }

    // -------------------------------------------------------------
    // STRATEGY 2: Detail Page Crawling
    // When the jobs page contains links to individual job detail pages
    // -------------------------------------------------------------
    const jobDetailUrls = new Set<string>();

    $('a').each((_, aEl) => {
      const href = $(aEl).attr('href');
      const text = $(aEl).text().trim();
      if (!href) return;

      try {
        const fullUrl = new URL(href, baseUrl.origin);
        
        // Safety: only same origin unless specified
        if (options.onlySameOrigin !== false && fullUrl.origin !== baseUrl.origin) {
          return;
        }

        // Avoid common non-job paths and corporate service/marketing/case-study sections
        const pathLower = fullUrl.pathname.toLowerCase();
        if (
          pathLower.endsWith('.pdf') || pathLower.endsWith('.jpg') || pathLower.endsWith('.png') ||
          pathLower === '/' || pathLower === '/about' || pathLower === '/contact' || pathLower === '/blog' ||
          pathLower === '/privacy' || pathLower === '/terms' || pathLower.includes('wp-admin') ||
          pathLower.includes('/expertise/') || pathLower.includes('/services/') ||
          pathLower.includes('/solutions/') || pathLower.includes('/case-studies/') ||
          pathLower.includes('/insights/') || pathLower.includes('/industries/')
        ) {
          return;
        }

        // Positive signal: path contains job, career, opening, position, or link text is a title
        const scoredText = this.scoreTitleText(text);
        const isJobPath = pathLower.includes('/job/') || pathLower.includes('/jobs/') ||
                          pathLower.includes('/career/') || pathLower.includes('/careers/') ||
                          pathLower.includes('/opening/') || pathLower.includes('/position/') ||
                          pathLower.includes('/role/');

        if (isJobPath || scoredText.isTitle) {
          jobDetailUrls.add(fullUrl.toString());
        }
      } catch {}
    });

    if (jobDetailUrls.size >= 1) {
      logger.info(`[HtmlJobDiscoveryService] Found ${jobDetailUrls.size} candidate job detail links to crawl`);
      const crawledJobs: ExtractedHtmlJob[] = [];
      let pagesVisited = 0;

      for (const detailUrl of Array.from(jobDetailUrls).slice(0, maxDetailPages)) {
        try {
          pagesVisited++;
          const detailRes = await safeFetchUrl(detailUrl, { timeoutMs: options.timeoutMs || 8000 });
          if (detailRes.status !== 200 || !detailRes.contentType.includes('text/html')) continue;

          const $d = cheerio.load(detailRes.text);
          $d('script, style, noscript, iframe, nav, header, footer').remove();

          // Locate title
          const titleCandidate = $d('h1, h2, [class*="job-title"], [class*="job_title"]').first().text().trim() ||
                                 $d('title').text().split('|')[0].split('—')[0].trim();

          const scored = this.scoreTitleText(titleCandidate);
          if (!scored.isTitle) continue;

          // Locate apply button / link
          let applyUrl: string | undefined;
          $d('a').each((_, aEl) => {
            const h = $d(aEl).attr('href');
            const t = $d(aEl).text().toLowerCase();
            if (h && (t.includes('apply') || h.includes('apply') || h.startsWith('mailto:'))) {
              try {
                applyUrl = new URL(h, baseUrl.origin).toString();
              } catch {
                applyUrl = h;
              }
            }
          });

          const bodyText = $d.text().replace(/\s+/g, ' ');
          const meta = this.extractFieldsFromText(bodyText);
          const cleanDesc = this.cleanHtmlToText(detailRes.text);

          crawledJobs.push({
            externalJobId: detailUrl,
            title: titleCandidate,
            location: meta.location,
            workMode: meta.workMode,
            employmentType: meta.employmentType,
            experience: meta.experience,
            salary: meta.salary,
            description: cleanDesc,
            applicationUrl: applyUrl || detailUrl,
            detailUrl: detailUrl,
            confidence: 80
          });
        } catch (err: any) {
          logger.warn(`[HtmlJobDiscoveryService] Failed crawling detail page ${detailUrl}: ${err.message}`);
        }
      }

      if (crawledJobs.length >= 1) {
        return {
          strategy: 'DETAIL_PAGES',
          jobs: crawledJobs,
          jobLinksFound: jobDetailUrls.size,
          jobDetailPagesVisited: pagesVisited,
          confidence: 85
        };
      }
    }

    return null;
  }
}
