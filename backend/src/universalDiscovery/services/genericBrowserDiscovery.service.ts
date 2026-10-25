import { DiscoveredJobRaw, CompletenessStatus } from '../types.js';
import { logger } from '../../utils/logger.js';
import { validateSafeUrl } from '../../utils/safeFetch.js';
import puppeteer from 'puppeteer-core';
import fs from 'fs';

export interface BrowserJobExtractionResult {
  jobs: DiscoveredJobRaw[];
  sourceTotal: number | null;
  pageSize: number;
  pagesFetched: number;
  pagesFailed: number;
  strategyUsed: string;
  completeness: CompletenessStatus;
  rawRecords: number;
  uniqueRecords: number;
  duplicatesRemoved: number;
  lastPageReached: boolean;
  warnings: string[];
}

export interface BrowserDiscoveryOptions {
  maxPages?: number;
  safetyMaxPages?: number;
  timeoutMs?: number;
}

export class GenericBrowserDiscoveryService {
  public static findChromePath(): string | null {
    if (process.env.PUPPETEER_EXECUTABLE_PATH && fs.existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
      return process.env.PUPPETEER_EXECUTABLE_PATH;
    }

    const candidates = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }
    return null;
  }

  /**
   * Universal browser fallback:
   * 1. SSRF check on target URL.
   * 2. Navigates using a standard realistic browser session without bypassing CAPTCHA or security controls.
   * 3. Dynamic pagination limit calculation based on sourceTotal / pageSize with high safety ceiling.
   * 4. Bounded page retries and robust termination evidence.
   * 5. Canonical deduplication and truthful completeness reporting (COMPLETE, PARTIAL, UNKNOWN, FAILED).
   */
  public static async discoverRenderedJobs(
    url: string,
    companyName: string,
    options: BrowserDiscoveryOptions = {}
  ): Promise<BrowserJobExtractionResult> {
    const warnings: string[] = [];
    const requestedMaxPages = options.maxPages;
    const safetyMaxPages = options.safetyMaxPages || 100;
    let maxPages = requestedMaxPages ?? safetyMaxPages;

    // SSRF Validation
    const ssrfCheck = await validateSafeUrl(url);
    if (!ssrfCheck.safe) {
      const errMsg = `SSRF protection blocked browser discovery URL: ${ssrfCheck.error || 'Blocked host'}`;
      logger.warn(`[GenericBrowserDiscoveryService] ${errMsg}`);
      return {
        jobs: [],
        sourceTotal: null,
        pageSize: 0,
        pagesFetched: 0,
        pagesFailed: 0,
        strategyUsed: 'BROWSER_UNAVAILABLE',
        completeness: 'FAILED',
        rawRecords: 0,
        uniqueRecords: 0,
        duplicatesRemoved: 0,
        lastPageReached: false,
        warnings: [errMsg]
      };
    }

    const chromePath = this.findChromePath();
    if (!chromePath) {
      logger.warn('[GenericBrowserDiscoveryService] Chrome executable not found on host environment.');
      return {
        jobs: [],
        sourceTotal: null,
        pageSize: 0,
        pagesFetched: 0,
        pagesFailed: 0,
        strategyUsed: 'BROWSER_UNAVAILABLE',
        completeness: 'FAILED',
        rawRecords: 0,
        uniqueRecords: 0,
        duplicatesRemoved: 0,
        lastPageReached: false,
        warnings: ['Chrome executable not found on host environment.']
      };
    }

    let browser: any = null;
    const allJobs: DiscoveredJobRaw[] = [];
    const seenJobIds = new Set<string>();
    const seenUrlsInRun = new Set<string>();
    let rawRecords = 0;
    let duplicatesRemoved = 0;
    let sourceTotal: number | null = null;
    let pageSize = 20;
    let pagesFetched = 0;
    let pagesFailed = 0;
    let lastPageReached = false;
    let consecutiveZeroYields = 0;

    try {
      logger.info(`[GenericBrowserDiscoveryService] Launching browser fallback for ${url}`);
      browser = await puppeteer.launch({
        executablePath: chromePath,
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--window-size=1440,900',
          '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        ]
      });

      const page = await browser.newPage();
      await page.setViewport({ width: 1440, height: 900 });
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9'
      });

      let currentUrl = url;

      while (pagesFetched < maxPages) {
        pagesFetched++;
        logger.info(`[GenericBrowserDiscoveryService] Loading page ${pagesFetched}/${maxPages}: ${currentUrl}`);

        let pageLoadSuccess = false;
        let lastErrorMsg = '';

        // Bounded page retry (up to 2 attempts per page)
        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            await page.goto(currentUrl, {
              waitUntil: 'domcontentloaded',
              timeout: options.timeoutMs || 15000
            });
            pageLoadSuccess = true;
            break;
          } catch (navErr: any) {
            lastErrorMsg = navErr.message;
            logger.warn(`[GenericBrowserDiscoveryService] Page ${pagesFetched} attempt ${attempt} failed: ${lastErrorMsg}`);
            if (attempt < 2) {
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          }
        }

        if (!pageLoadSuccess) {
          pagesFailed++;
          warnings.push(`Page ${pagesFetched} failed after 2 attempts: ${lastErrorMsg}`);
          logger.warn(`[GenericBrowserDiscoveryService] Skipping page ${pagesFetched} due to navigation failure.`);
          break;
        }

        // Bounded readiness wait for dynamic rendering or job signals (max 2500ms)
        try {
          await page.waitForFunction(
            () => {
              const b = document.body ? document.body.innerText : '';
              return (
                b.includes('matching jobs') ||
                b.includes('results') ||
                b.includes('Requisition ID') ||
                b.includes('Just a moment') ||
                b.includes('security verification') ||
                document.querySelectorAll('a[href*="career_job_req_id"]').length > 0 ||
                document.querySelectorAll('.card-job, [data-id], a[href*="job"], tr').length > 5
              );
            },
            { timeout: 2500 }
          );
        } catch {
          // Proceed with current DOM state if timeout occurs
        }

        // Brief stabilization for DOM hydration (300ms)
        await new Promise(resolve => setTimeout(resolve, 300));

        // Evaluate page contents and pagination cues
        const pageData = await page.evaluate(() => {
          const bodyText = document.body ? document.body.innerText : '';

          // 1. Detect source total pattern e.g. "Displaying 1 to 20 of 894 matching jobs" or "894 jobs found"
          let detectedTotal: number | null = null;
          let detectedPageSize = 20;

          const matchRange =
            bodyText.match(/Displaying\s+(\d+)\s+to\s+(\d+)\s+of\s+([0-9,]+)\s+matching\s+jobs/i) ||
            bodyText.match(/showing\s+(\d+)\s*-\s*(\d+)\s+of\s+([0-9,]+)/i);

          if (matchRange) {
            const start = parseInt(matchRange[1].replace(/,/g, ''), 10);
            const end = parseInt(matchRange[2].replace(/,/g, ''), 10);
            detectedPageSize = Math.max(1, end - start + 1);
            detectedTotal = parseInt(matchRange[3].replace(/,/g, ''), 10);
          } else {
            const matchSimple = bodyText.match(/([0-9,]+)\s+(?:matching\s+jobs|jobs\s+found|openings)/i);
            if (matchSimple) {
              detectedTotal = parseInt(matchSimple[1].replace(/,/g, ''), 10);
            }
          }

          // 2. Discover job elements / cards
          const extracted: Array<{ id: string; title: string; href: string; location: string }> = [];

          // Pattern A: Card / Item based
          const cardNodes = Array.from(
            document.querySelectorAll(
              '.card-job, .card[data-id], .job-item, [class*="jobItem"], tr[class*="job"], [data-ph-at-id="job-link-item"]'
            )
          );
          for (const card of cardNodes) {
            const linkEl = card.querySelector(
              'a.stretched-link, h2 a, h3 a, a[href*="/job/"], a[href*="career_job_req_id"], a[data-ph-at-id="job-link"]'
            );
            if (linkEl) {
              const title = (linkEl as HTMLElement).innerText.trim();
              const href = (linkEl as HTMLAnchorElement).href;
              const id =
                card.getAttribute('data-id') ||
                (href.match(/\/(r[0-9]+|[0-9]+)\//i) || [])[1] ||
                (href.match(/job[_\-/]([0-9A-Za-z]+)/i) || [])[1] ||
                '';

              const metaEl = card.querySelector('.job-meta, .location, [class*="location"]');
              const location = metaEl ? (metaEl as HTMLElement).innerText.trim() : '';

              if (title && href) {
                extracted.push({ id, title, href, location });
              }
            }
          }

          // Pattern B: Table / List links if cards are empty
          if (extracted.length === 0) {
            const links = Array.from(
              document.querySelectorAll('a[href*="/job/"], a[href*="career_job_req_id"]')
            );
            for (const a of links) {
              const title = (a as HTMLElement).innerText.trim();
              const href = (a as HTMLAnchorElement).href;
              if (title.length > 3 && !title.toLowerCase().includes('save') && !title.toLowerCase().includes('share')) {
                const idMatch = href.match(/career_job_req_id=([0-9]+)/i) || href.match(/\/(r[0-9]+|[0-9]+)\//i);
                const id = idMatch ? idMatch[1] : '';

                let location = '';
                const row = a.closest('tr') || a.closest('div');
                if (row) {
                  const rowText = (row as HTMLElement).innerText || '';
                  const locMatch = rowText.match(/-\s*([A-Za-z\s]+)\s*-\s*(?:Engineering|Human Resources|Consulting|IT)/i);
                  if (locMatch) {
                    location = locMatch[1].trim();
                  }
                }
                extracted.push({ id, title, href, location });
              }
            }
          }

          // 3. Find Next Page URL
          let nextUrl: string | null = null;
          const nextLink = document.querySelector(
            'a[aria-label="Next"], a.next, a[rel="next"], a[aria-label*="Next page"], a[data-ph-at-id="pagination-next-link"]'
          );
          if (nextLink && (nextLink as HTMLAnchorElement).href) {
            nextUrl = (nextLink as HTMLAnchorElement).href;
          }

          return { detectedTotal, detectedPageSize, jobs: extracted, nextUrl };
        });

        // Dynamic Source Total and Page Size Handling
        if (pageData.detectedTotal !== null) {
          if (sourceTotal === null) {
            sourceTotal = pageData.detectedTotal;
            logger.info(`[GenericBrowserDiscoveryService] Authoritative source total discovered: ${sourceTotal}`);
          } else if (pageData.detectedTotal !== sourceTotal) {
            logger.info(`[GenericBrowserDiscoveryService] Source total revised from ${sourceTotal} to ${pageData.detectedTotal}`);
            sourceTotal = pageData.detectedTotal;
          }
        }

        if (pageData.detectedPageSize && pageData.detectedPageSize > 0) {
          pageSize = pageData.detectedPageSize;
        }

        // Dynamically calculate requiredPages when sourceTotal and pageSize are known and no explicit caller maxPages override was passed
        if (sourceTotal !== null && pageSize > 0 && !requestedMaxPages) {
          const requiredPages = Math.ceil(sourceTotal / pageSize);
          maxPages = Math.min(requiredPages, safetyMaxPages);
          logger.info(`[GenericBrowserDiscoveryService] Dynamic required pages calculated: ${requiredPages} (Bounded maxPages: ${maxPages})`);
        }

        // Process jobs on current page with canonical deduplication
        let newRecordsCount = 0;
        for (const item of pageData.jobs) {
          rawRecords++;
          const canonicalKey = (item.id && item.id.trim()) ? `id:${item.id.trim().toLowerCase()}` : `url:${item.href.trim().toLowerCase()}`;
          if (seenJobIds.has(canonicalKey)) {
            duplicatesRemoved++;
            continue;
          }
          seenJobIds.add(canonicalKey);
          let description = item.description || item.snippet;
          if (!description || description.trim().toLowerCase() === item.title.trim().toLowerCase()) {
            const descParts = [
              `${item.title} at ${companyName}.`,
              item.location ? `Location: ${item.location}.` : '',
              'Review full requirements and submit your application on the employer careers site.'
            ].filter(Boolean);
            description = descParts.join(' ');
          }
          allJobs.push({
            externalJobId: item.id || undefined,
            title: item.title,
            location: item.location || undefined,
            description,
            applicationUrl: item.href,
            url: item.href
          });
          newRecordsCount++;
        }

        logger.info(
          `[GenericBrowserDiscoveryService] Page ${pagesFetched} yielded ${newRecordsCount} new jobs (Raw: ${rawRecords}, Unique: ${allJobs.length}, Duplicates removed: ${duplicatesRemoved})`
        );

        // Check if authoritative source total has been met
        if (sourceTotal !== null && allJobs.length >= sourceTotal) {
          logger.info(`[GenericBrowserDiscoveryService] Reached reported source total: ${allJobs.length}/${sourceTotal}`);
          lastPageReached = true;
          break;
        }

        // Evaluate next URL & termination evidence
        const nextUrl = pageData.nextUrl;
        if (!nextUrl || nextUrl === currentUrl || seenUrlsInRun.has(nextUrl)) {
          logger.info(`[GenericBrowserDiscoveryService] Definitive pagination exhaustion reached (No valid next URL: ${nextUrl})`);
          lastPageReached = true;
          break;
        }

        if (newRecordsCount === 0) {
          consecutiveZeroYields++;
          // Bounded tolerance: allow 1 zero-yield transition page if nextUrl is distinctly different
          if (consecutiveZeroYields > 1) {
            logger.info(`[GenericBrowserDiscoveryService] Terminating after ${consecutiveZeroYields} consecutive zero-yield pages.`);
            lastPageReached = true;
            break;
          }
        } else {
          consecutiveZeroYields = 0;
        }

        seenUrlsInRun.add(currentUrl);
        currentUrl = nextUrl;
      }
    } catch (err: any) {
      logger.warn(`[GenericBrowserDiscoveryService] Browser discovery error: ${err.message}`);
      warnings.push(`Browser discovery encountered error: ${err.message}`);
    } finally {
      if (browser) {
        await browser.close().catch(() => {});
      }
    }

    // Truthful completeness evaluation
    let completeness: CompletenessStatus = 'UNKNOWN';
    if (allJobs.length === 0) {
      completeness = 'FAILED';
    } else if (sourceTotal !== null && sourceTotal > 0) {
      if (allJobs.length >= sourceTotal) {
        completeness = 'COMPLETE';
      } else {
        completeness = 'PARTIAL';
      }
    } else if (lastPageReached) {
      completeness = 'COMPLETE';
    } else {
      completeness = 'UNKNOWN';
    }

    return {
      jobs: allJobs,
      sourceTotal,
      pageSize,
      pagesFetched,
      pagesFailed,
      strategyUsed: 'BROWSER_RENDERED',
      completeness,
      rawRecords,
      uniqueRecords: allJobs.length,
      duplicatesRemoved,
      lastPageReached,
      warnings
    };
  }
}
