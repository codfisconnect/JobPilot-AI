import { CompletenessStatus } from './types.js';

export interface CompletenessEvaluation {
  expectedCount: number | null;
  discoveredCount: number;
  completeness: CompletenessStatus;
  notes: string;
}

export class CompletenessEstimatorService {
  /**
   * Distinguishes COMPLETE, PARTIAL, UNKNOWN, FAILED without fabricating values.
   */
  public static evaluate(discoveredCount: number, expectedCount: number | null): CompletenessEvaluation {
    if (discoveredCount === 0) {
      return {
        expectedCount,
        discoveredCount: 0,
        completeness: 'FAILED',
        notes: 'Zero jobs were discovered.'
      };
    }

    if (expectedCount === null || expectedCount === undefined || expectedCount <= 0) {
      return {
        expectedCount: null,
        discoveredCount,
        completeness: 'UNKNOWN',
        notes: `Discovered ${discoveredCount} jobs. No authoritative total count reported by source.`
      };
    }

    if (discoveredCount >= expectedCount) {
      return {
        expectedCount,
        discoveredCount,
        completeness: 'COMPLETE',
        notes: `Discovered ${discoveredCount} of ${expectedCount} reported jobs (100% complete).`
      };
    }

    // discoveredCount < expectedCount
    const ratio = (discoveredCount / expectedCount) * 100;
    return {
      expectedCount,
      discoveredCount,
      completeness: 'PARTIAL',
      notes: `Discovered ${discoveredCount} of ${expectedCount} reported jobs (${ratio.toFixed(1)}% complete).`
    };
  }

  /**
   * Extracts expected job total count from payload if present in common fields.
   */
  public static extractReportedTotal(payload: any): number | null {
    if (!payload || typeof payload !== 'object') return null;

    const candidateKeys = [
      'totalJobCount', 'totalJobs', 'totalCount', 'total', 'count', 'total_count',
      'totalRecords', 'recordsTotal', 'jobCount', 'total_results', 'totalResults'
    ];

    for (const key of candidateKeys) {
      const val = payload[key];
      if (typeof val === 'number' && val >= 0) {
        return val;
      }
      if (typeof val === 'string' && /^\d+$/.test(val.trim())) {
        return parseInt(val.trim(), 10);
      }
    }

    // Check one level deep: payload.meta, payload.pagination, payload.page
    for (const sub of ['meta', 'pagination', 'paging', 'page', 'summary']) {
      if (payload[sub] && typeof payload[sub] === 'object') {
        const found = this.extractReportedTotal(payload[sub]);
        if (found !== null) return found;
      }
    }

    return null;
  }
}
