import { IJobSourceStrategy, StrategyContext, StrategyExecutionResult } from '../strategy.interface.js';
import { safeFetchUrl } from '../../utils/safeFetch.js';
import { CompletenessEstimatorService } from '../completenessEstimator.service.js';
import { DiscoveredJobRaw } from '../types.js';
import { logger } from '../../utils/logger.js';
import * as cheerio from 'cheerio';

export class GreenhouseAdapter implements IJobSourceStrategy {
  public readonly name = 'GREENHOUSE_ADAPTER';
  public readonly priority = 12;

  public canHandle(context: StrategyContext): boolean {
    if (context.fingerprint.atsVendor === 'GREENHOUSE') return true;
    if (context.normalizedUrl.domain.includes('greenhouse.io')) return true;
    if (
      context.initialHtml &&
      (context.initialHtml.includes('boards.greenhouse.io') ||
        context.initialHtml.includes('boards-api.greenhouse.io') ||
        context.initialHtml.includes('grnh.se') ||
        context.initialHtml.includes('data-board-token') ||
        context.initialHtml.includes('careers-job-listing'))
    ) {
      return true;
    }
    return false;
  }

  public async execute(context: StrategyContext): Promise<StrategyExecutionResult> {
    const { normalizedUrl } = context;
    let boardToken = '';

    // Extract board token from path or query or HTML/scripts
    const match = normalizedUrl.normalizedUrl.match(/boards\.greenhouse\.io\/(?:embed\/job_board\?for=)?([^/?#]+)/i);
    if (match && match[1]) {
      boardToken = match[1];
    } else if (context.initialHtml) {
      // Look for data-board-token or boards-api.greenhouse.io or boards.greenhouse.io in HTML and referenced scripts
      const htmlTokenMatch =
        context.initialHtml.match(/data-board-token(?:-display)?=["']([^"']+)["']/i) ||
        context.initialHtml.match(/boards(?:-api)?\.greenhouse\.io\/(?:v1\/boards\/|embed\/job_app\?for=|embed\/job_board\?for=)?([a-zA-Z0-9_-]+)/i);
      if (htmlTokenMatch && htmlTokenMatch[1]) {
        boardToken = htmlTokenMatch[1];
      }
    }

    if (!boardToken && context.initialHtml) {
      // Inspect scripts in initialHtml for boards-api.greenhouse.io
      const scriptMatches = context.initialHtml.match(/<script[^>]*src=["']([^"']+)["'][^>]*>/gi) || [];
      for (const tag of scriptMatches) {
        const srcMatch = tag.match(/src=["']([^"']+)["']/i);
        if (srcMatch && srcMatch[1] && (srcMatch[1].includes('career') || srcMatch[1].includes('job') || srcMatch[1].includes('cjl'))) {
          try {
            const resolvedSrc = new URL(srcMatch[1], normalizedUrl.normalizedUrl).toString();
            const sRes = await safeFetchUrl(resolvedSrc, { timeoutMs: 5000 });
            if (sRes.status === 200 && sRes.text) {
              const inScriptMatch =
                sRes.text.match(/boards(?:-api)?\.greenhouse\.io\/v1\/boards\/([a-zA-Z0-9_-]+)/i) ||
                sRes.text.match(/data-board-token.*?['"]([a-zA-Z0-9_-]+)['"]/i) ||
                sRes.text.match(/boards\.greenhouse\.io\/embed\/job_app\?for=([a-zA-Z0-9_-]+)/i) ||
                sRes.text.match(/BOARD_TOKEN(?:_LC)?\s*=\s*['"]([a-zA-Z0-9_-]+)['"]/i);
              if (inScriptMatch && inScriptMatch[1]) {
                boardToken = inScriptMatch[1];
                break;
              }
            }
          } catch {}
        }
      }
    }

    if (!boardToken) {
      const parts = normalizedUrl.normalizedUrl.split('/').filter(Boolean);
      boardToken = parts[parts.length - 1];
    }

    const endpoint = `https://boards-api.greenhouse.io/v1/boards/${boardToken}/jobs?content=true`;
    logger.info(`[GreenhouseAdapter] Querying Greenhouse API at ${endpoint}`);

    const allJobs: DiscoveredJobRaw[] = [];
    let expectedCount: number | null = null;
    let companyName = boardToken.charAt(0).toUpperCase() + boardToken.slice(1);

    try {
      const res = await safeFetchUrl(endpoint, { timeoutMs: 10000 });
      if (res.status === 200) {
        const payload = JSON.parse(res.text);
        const rawJobs = payload.jobs || [];
        expectedCount = rawJobs.length;

        for (const item of rawJobs) {
          allJobs.push({
            externalJobId: String(item.id || ''),
            title: item.title || 'Job Opening',
            location: item.location?.name || undefined,
            description: item.content || undefined,
            applicationUrl: item.absolute_url || undefined,
            postedAt: item.updated_at || undefined,
            rawPayload: item
          });
        }
      }
    } catch (err: any) {
      logger.warn(`[GreenhouseAdapter] Failed to fetch board ${boardToken}: ${err.message}`);
    }

    if (allJobs.length === 0) {
      return { matched: false } as any;
    }

    const completeness = CompletenessEstimatorService.evaluate(allJobs.length, expectedCount);

    return {
      matched: true,
      strategyName: this.name,
      sourceType: 'GREENHOUSE',
      atsType: 'GREENHOUSE',
      jobsEndpoint: endpoint,
      httpMethod: 'GET',
      companyName,
      officialDomain: normalizedUrl.domain,
      jobs: allJobs,
      expectedJobCount: expectedCount,
      completeness: completeness.completeness,
      paginationSupported: false,
      mappingConfig: {
        externalJobIdField: 'id',
        titleField: 'title',
        locationField: 'location.name',
        applicationUrlField: 'absolute_url'
      }
    };
  }
}
