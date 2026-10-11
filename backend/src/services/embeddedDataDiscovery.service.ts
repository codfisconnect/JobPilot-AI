import * as cheerio from 'cheerio';
import { logger } from '../utils/logger.js';

export interface EmbeddedDataResult {
  sourceType: 'NEXT_JS_RSC' | 'NEXT_DATA' | 'EMBEDDED_JSON';
  jobs: any[];
  rootPath?: string;
}

export class EmbeddedDataDiscoveryService {
  private static readonly MAX_SCRIPTS_TO_INSPECT = 60;
  private static readonly MAX_SCRIPT_SIZE_BYTES = 1024 * 1024; // 1MB upper bound per script
  private static readonly MAX_TREE_DEPTH = 8;

  /**
   * Safe extraction of embedded job state from modern web pages:
   * 1. Next.js React Server Component payloads (self.__next_f.push)
   * 2. Next.js pages router state (__NEXT_DATA__)
   * 3. Generic application state script tags (application/json, window.__INITIAL_STATE__, etc.)
   */
  public static extractEmbeddedJobsFromHtml(html: string): EmbeddedDataResult | null {
    if (!html || typeof html !== 'string') return null;

    // 1. Try Next.js React Server Component (RSC) streams: self.__next_f.push(...)
    const rscResult = this.extractFromNextJsRsc(html);
    if (rscResult && rscResult.jobs.length > 0) {
      return rscResult;
    }

    // 2. Try Next.js Pages router: <script id="__NEXT_DATA__" type="application/json">
    const nextDataResult = this.extractFromNextData(html);
    if (nextDataResult && nextDataResult.jobs.length > 0) {
      return nextDataResult;
    }

    // 3. Try generic embedded JSON scripts
    const genericJsonResult = this.extractFromEmbeddedJsonScripts(html);
    if (genericJsonResult && genericJsonResult.jobs.length > 0) {
      return genericJsonResult;
    }

    return null;
  }

  /**
   * Fast, bounded, and safe extraction of React Server Component payloads:
   * Pattern: self.__next_f.push([chunkId, "payload"])
   * Uses safe indexOf & JSON.parse (no regex catastrophic backtracking, no code execution).
   */
  private static extractFromNextJsRsc(html: string): EmbeddedDataResult | null {
    if (!html.includes('self.__next_f.push')) {
      return null;
    }

    const needle = 'self.__next_f.push(';
    let pos = 0;
    let count = 0;

    let bestJobs: any[] = [];
    let bestRoot = '';
    let highestScore = 0;

    while ((pos = html.indexOf(needle, pos)) !== -1 && count < this.MAX_SCRIPTS_TO_INSPECT) {
      count++;
      const start = pos + needle.length;
      const end = html.indexOf('</script>', start);
      const snippet = html.slice(start, end !== -1 ? end : start + 500000);
      const closingParen = snippet.lastIndexOf(')');

      if (closingParen !== -1) {
        const rawArg = snippet.slice(0, closingParen).trim();
        if (rawArg.startsWith('[') && rawArg.endsWith(']')) {
          try {
            const parsedArg = JSON.parse(rawArg);
            if (Array.isArray(parsedArg) && typeof parsedArg[1] === 'string') {
              const chunkStr = parsedArg[1];
              // In Next.js RSC protocol, chunk is formatted as `<id>:<data>`
              const colonIdx = chunkStr.indexOf(':');
              const dataString = colonIdx !== -1 ? chunkStr.slice(colonIdx + 1).trim() : chunkStr.trim();

              if (dataString.startsWith('[') || dataString.startsWith('{')) {
                try {
                  const parsed = JSON.parse(dataString);
                  const found = this.findJobArraysInObject(parsed);
                  for (const cand of found) {
                    if (cand.score > highestScore || (cand.score === highestScore && cand.jobs.length > bestJobs.length)) {
                      bestJobs = cand.jobs;
                      bestRoot = cand.path;
                      highestScore = cand.score;
                    }
                  }
                } catch {
                  // Fallback: check nested substring if root fails
                  const subJobs = this.extractNestedJsonSubstrings(dataString);
                  if (subJobs.length > bestJobs.length) {
                    bestJobs = subJobs;
                    bestRoot = 'rsc_substring';
                    highestScore = 70;
                  }
                }
              }
            }
          } catch {}
        }
      }

      pos = end !== -1 ? end : start + 1;
    }

    if (bestJobs.length > 0) {
      logger.info(`[EmbeddedDataDiscoveryService] Discovered ${bestJobs.length} jobs from Next.js RSC state (Path: ${bestRoot}, Score: ${highestScore})`);
      return {
        sourceType: 'NEXT_JS_RSC',
        jobs: bestJobs,
        rootPath: bestRoot
      };
    }

    return null;
  }

  /**
   * Extracts data from standard Next.js <script id="__NEXT_DATA__" type="application/json">
   */
  private static extractFromNextData(html: string): EmbeddedDataResult | null {
    if (!html.includes('__NEXT_DATA__')) return null;

    try {
      const match = html.match(/<script\s+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
      if (!match || !match[1]) return null;

      const scriptContent = match[1].trim();
      if (scriptContent.length > this.MAX_SCRIPT_SIZE_BYTES) return null;

      const parsed = JSON.parse(scriptContent);
      const candidates = this.findJobArraysInObject(parsed);
      if (candidates.length > 0) {
        candidates.sort((a, b) => b.score - a.score || b.jobs.length - a.jobs.length);
        logger.info(`[EmbeddedDataDiscoveryService] Discovered ${candidates[0].jobs.length} jobs from __NEXT_DATA__`);
        return {
          sourceType: 'NEXT_DATA',
          jobs: candidates[0].jobs,
          rootPath: candidates[0].path
        };
      }
    } catch (err: any) {
      logger.debug(`[EmbeddedDataDiscoveryService] __NEXT_DATA__ parse error: ${err.message}`);
    }

    return null;
  }

  /**
   * Inspects generic <script type="application/json"> tags or window state
   */
  private static extractFromEmbeddedJsonScripts(html: string): EmbeddedDataResult | null {
    const $ = cheerio.load(html);
    let bestJobs: any[] = [];
    let bestRoot = '';
    let highestScore = 0;

    let inspectedCount = 0;
    $('script[type="application/json"], script:not([src])').each((_, el) => {
      if (inspectedCount >= this.MAX_SCRIPTS_TO_INSPECT) return;
      inspectedCount++;

      const content = $(el).html()?.trim() || '';
      if (!content || content.length < 50 || content.length > this.MAX_SCRIPT_SIZE_BYTES) return;

      // Skip non-data JavaScript
      if (content.includes('function(') || content.includes('addEventListener') || content.includes('document.get')) {
        return;
      }

      // Check for JSON assignments e.g. window.__STATE__ = {...}
      let jsonStr = content;
      if (content.includes('=') && !content.startsWith('{') && !content.startsWith('[')) {
        const eqIdx = content.indexOf('=');
        jsonStr = content.slice(eqIdx + 1).replace(/;?\s*$/, '').trim();
      }

      if ((jsonStr.startsWith('{') && jsonStr.endsWith('}')) || (jsonStr.startsWith('[') && jsonStr.endsWith(']'))) {
        try {
          const parsed = JSON.parse(jsonStr);
          const found = this.findJobArraysInObject(parsed);
          for (const cand of found) {
            if (cand.score > highestScore || (cand.score === highestScore && cand.jobs.length > bestJobs.length)) {
              bestJobs = cand.jobs;
              bestRoot = cand.path;
              highestScore = cand.score;
            }
          }
        } catch {}
      }
    });

    if (bestJobs.length > 0) {
      logger.info(`[EmbeddedDataDiscoveryService] Discovered ${bestJobs.length} jobs from embedded JSON script`);
      return {
        sourceType: 'EMBEDDED_JSON',
        jobs: bestJobs,
        rootPath: bestRoot
      };
    }

    return null;
  }

  /**
   * Recursively traverses an object/array to locate arrays of candidate job records.
   * Uses generic scoring based on identity, title, location, status, and URL fields.
   */
  public static findJobArraysInObject(
    root: any,
    depth: number = 0,
    currentPath: string = ''
  ): { jobs: any[]; path: string; score: number }[] {
    if (!root || typeof root !== 'object' || depth > this.MAX_TREE_DEPTH) {
      return [];
    }

    const results: { jobs: any[]; path: string; score: number }[] = [];

    if (Array.isArray(root)) {
      if (root.length > 0 && typeof root[0] === 'object' && root[0] !== null) {
        const score = this.scoreJobCandidateArray(root);
        if (score >= 60) {
          results.push({ jobs: root, path: currentPath || 'root', score });
          // Stop descending into elements of an already verified jobs array
          return results;
        }
      }

      // Traverse children of array (bounded to first 10 items)
      for (let i = 0; i < Math.min(root.length, 10); i++) {
        results.push(...this.findJobArraysInObject(root[i], depth + 1, `${currentPath}[${i}]`));
      }
    } else {
      for (const key of Object.keys(root)) {
        const val = root[key];
        const nextPath = currentPath ? `${currentPath}.${key}` : key;
        results.push(...this.findJobArraysInObject(val, depth + 1, nextPath));
      }
    }

    return results;
  }

  /**
   * Evaluates if an array of objects represents job listings using generic field heuristics.
   */
  public static scoreJobCandidateArray(items: any[]): number {
    if (!Array.isArray(items) || items.length === 0) return 0;

    const sample = items.slice(0, 5);
    let totalScore = 0;

    for (const item of sample) {
      if (!item || typeof item !== 'object') return 0;
      const keys = Object.keys(item).map(k => k.toLowerCase().replace(/[-_]/g, ''));

      let itemScore = 0;

      // 1. Title indicators (+35)
      const hasTitle = keys.some(k =>
        k === 'title' || k === 'jobtitle' || k === 'position' ||
        k === 'role' || k === 'jobrequisition' || k === 'jobname'
      );
      if (hasTitle) itemScore += 35;

      // 2. Identity / Requisition indicators (+25)
      const hasId = keys.some(k =>
        k === 'jobrequisitionid' || k === 'requisitionid' ||
        k === 'jobid' || k === 'externalid' ||
        (k === 'id' && (keys.includes('documentid') || keys.includes('jobfamily') || keys.includes('jobpostinglocation') || keys.includes('jobrequisition')))
      );
      if (hasId) itemScore += 25;

      // 3. Application / Link indicators (+20)
      const hasUrl = keys.some(k =>
        k === 'url' || k === 'applyurl' || k === 'applicationurl' ||
        k === 'joburl' || k === 'href' || k === 'link'
      );
      if (hasUrl) itemScore += 20;

      // 4. Location indicators (+15)
      const hasLocation = keys.some(k =>
        k === 'location' || k === 'jobpostinglocation' || k === 'city' ||
        k === 'country' || k === 'state' || k === 'office'
      );
      if (hasLocation) itemScore += 15;

      // 5. Status indicators (+10)
      const hasStatus = keys.some(k =>
        k === 'isactive' || k === 'active' || k === 'status' ||
        k === 'employmentstatus' || k === 'isopen'
      );
      if (hasStatus) itemScore += 10;

      // 6. Department / Family indicators (+10)
      const hasDept = keys.some(k =>
        k === 'department' || k === 'jobfamily' || k === 'category' ||
        k === 'bu' || k === 'businessunit'
      );
      if (hasDept) itemScore += 10;

      // Deduct score if navigation/menu keywords dominate
      const isNav = keys.some(k => k === 'hassubmenu' || k === 'menuorder' || k === 'isbold');
      if (isNav) itemScore -= 40;

      totalScore += Math.max(0, itemScore);
    }

    return Math.round(totalScore / sample.length);
  }

  /**
   * Helper to safely extract JSON substrings if Next.js serialized state is fragmented
   */
  private static extractNestedJsonSubstrings(raw: string): any[] {
    const candidates: any[] = [];
    const jobsMatch = raw.match(/"jobs"\s*:\s*(\[\s*\{[\s\S]*?\}\s*\])/);
    if (jobsMatch && jobsMatch[1]) {
      try {
        const parsed = JSON.parse(jobsMatch[1]);
        if (Array.isArray(parsed) && this.scoreJobCandidateArray(parsed) >= 60) {
          return parsed;
        }
      } catch {}
    }
    return candidates;
  }
}
