import { DiscoveredJobRaw } from '../types.js';
import { logger } from '../../utils/logger.js';
import { safeFetchUrl } from '../../utils/safeFetch.js';
import * as cheerio from 'cheerio';
import puppeteer from 'puppeteer-core';
import fs from 'fs';

export interface BrowserJobExtractionResult {
  jobs: DiscoveredJobRaw[];
  sourceTotal: number | null;
  pageSize: number;
  pagesFetched: number;
  strategyUsed: string;
}

export class GenericBrowserDiscoveryService {
  private static findChromePath(): string | null {
    const candidates = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      '/usr/bin/google-chrome',
      '/usr/bin/chromium-browser',
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }
    return null;
  }

  /**
   * Universal browser fallback:
   * 1. Navigates using a standard realistic browser session without bypassing CAPTCHA or security controls.
   * 2. Waits for bounded readiness signals (networkidle, job count text, job card presence).
   * 3. Extracts structured jobs, application URLs, external IDs, and pagination metadata.
   * 4. Paginates across public pages within safe bounds (up to maxPages).
   */
  public static async discoverRenderedJobs(
    url: string,
    companyName: string,
    options: { maxPages?: number } = {}
  ): Promise<BrowserJobExtractionResult> {
    const maxPages = options.maxPages || 5;
    const chromePath = this.findChromePath();

    if (!chromePath) {
      logger.warn('[GenericBrowserDiscoveryService] Chrome executable not found on host environment.');
      return { jobs: [], sourceTotal: null, pageSize: 0, pagesFetched: 0, strategyUsed: 'BROWSER_UNAVAILABLE' };
    }

    let browser: any = null;
    const allJobs: DiscoveredJobRaw[] = [];
    const seenJobIds = new Set<string>();
    let sourceTotal: number | null = null;
    let pageSize = 20;
    let pagesFetched = 0;

    try {
      logger.info(`[GenericBrowserDiscoveryService] Launching browser fallback for ${url}`);
      browser = await puppeteer.launch({
        executablePath: chromePath,
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
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
        logger.info(`[GenericBrowserDiscoveryService] Loading page ${pagesFetched}: ${currentUrl}`);

        const resp = await page.goto(currentUrl, {
          waitUntil: 'networkidle2',
          timeout: 30000
        });

        // Bounded readiness wait for dynamic rendering or job signals
        try {
          await page.waitForFunction(
            () => {
              const b = document.body ? document.body.innerText : '';
              return (
                b.includes('matching jobs') ||
                b.includes('results') ||
                b.includes('Requisition ID') ||
                document.querySelectorAll('a[href*="career_job_req_id"]').length > 0 ||
                document.querySelectorAll('.card-job, [data-id], a[href*="job"], tr').length > 5
              );
            },
            { timeout: 7000 }
          );
        } catch {
          // Proceed with current DOM state if timeout occurs
        }

        // Additional brief stabilization for DWR/JUIC hydration
        await new Promise(resolve => setTimeout(resolve, 2000));

        const pageData = await page.evaluate(() => {
          const bodyText = document.body ? document.body.innerText : '';
          
          // 1. Detect source total pattern e.g. "Displaying 1 to 20 of 873 matching jobs" or "83 jobs found"
          let detectedTotal: number | null = null;
          let detectedPageSize = 20;

          const matchRange = bodyText.match(/Displaying\s+(\d+)\s+to\s+(\d+)\s+of\s+([0-9,]+)\s+matching\s+jobs/i) ||
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
          const extracted: any[] = [];
          
          // Pattern A: Card / Item based
          const cardNodes = Array.from(document.querySelectorAll('.card-job, .card[data-id], .job-item, [class*="jobItem"], tr[class*="job"]'));
          for (const card of cardNodes) {
            const linkEl = card.querySelector('a.stretched-link, h2 a, h3 a, a[href*="/job/"], a[href*="career_job_req_id"]');
            if (linkEl) {
              const title = (linkEl as HTMLElement).innerText.trim();
              const href = (linkEl as HTMLAnchorElement).href;
              const id = card.getAttribute('data-id') || (href.match(/\/(r[0-9]+|[0-9]+)\//i) || [])[1] || '';
              
              const metaEl = card.querySelector('.job-meta, .location, [class*="location"]');
              const location = metaEl ? (metaEl as HTMLElement).innerText.trim() : '';

              if (title && href) {
                extracted.push({ id, title, href, location });
              }
            }
          }

          // Pattern B: Table / List links if cards are empty
          if (extracted.length === 0) {
            const links = Array.from(document.querySelectorAll('a[href*="/job/"], a[href*="career_job_req_id"]'));
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
                  // e.g. "Chennai - Engineering No Travel"
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
          const nextLink = document.querySelector('a[aria-label="Next"], a.next, a[rel="next"], a[aria-label*="Next page"]');
          if (nextLink && (nextLink as HTMLAnchorElement).href) {
            nextUrl = (nextLink as HTMLAnchorElement).href;
          }

          return { detectedTotal, detectedPageSize, jobs: extracted, nextUrl };
        });

        if (pageData.detectedTotal !== null && sourceTotal === null) {
          sourceTotal = pageData.detectedTotal;
        }
        if (pageData.detectedPageSize) {
          pageSize = pageData.detectedPageSize;
        }

        let newRecordsCount = 0;
        for (const item of pageData.jobs) {
          const key = item.id || item.href;
          if (key && !seenJobIds.has(key)) {
            seenJobIds.add(key);
            allJobs.push({
              externalJobId: item.id || undefined,
              title: item.title,
              location: item.location || undefined,
              description: item.title,
              applicationUrl: item.href,
              url: item.href
            });
            newRecordsCount++;
          }
        }

        logger.info(`[GenericBrowserDiscoveryService] Page ${pagesFetched} yielded ${newRecordsCount} new jobs (Total collected: ${allJobs.length})`);

        // Check completion criteria
        if (sourceTotal !== null && allJobs.length >= sourceTotal) {
          logger.info(`[GenericBrowserDiscoveryService] Reached reported source total: ${allJobs.length}/${sourceTotal}`);
          break;
        }

        if (!pageData.nextUrl || pageData.nextUrl === currentUrl || newRecordsCount === 0) {
          // Try standard query pagination ?page=N or offset=N if URL can be incremented
          try {
            const nextUrlObj = new URL(currentUrl);
            const currentPage = parseInt(nextUrlObj.searchParams.get('page') || '1', 10);
            const nextPageNum = currentPage + 1;
            nextUrlObj.searchParams.set('page', String(nextPageNum));
            if (nextUrlObj.toString() !== currentUrl && (!sourceTotal || allJobs.length < sourceTotal)) {
              currentUrl = nextUrlObj.toString();
              continue;
            }
          } catch {}
          break;
        }

        currentUrl = pageData.nextUrl;
      }
    } catch (err: any) {
      logger.warn(`[GenericBrowserDiscoveryService] Browser discovery error: ${err.message}`);
    } finally {
      if (browser) {
        await browser.close().catch(() => {});
      }
    }

    return {
      jobs: allJobs,
      sourceTotal,
      pageSize,
      pagesFetched,
      strategyUsed: 'BROWSER_RENDERED'
    };
  }
}
