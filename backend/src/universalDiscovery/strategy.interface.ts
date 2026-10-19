import { NormalizedUrlResult } from './urlNormalization.service.js';
import { SourceFingerprint } from './sourceFingerprint.service.js';
import { DiscoveredJobRaw, CompletenessStatus } from './types.js';

export interface StrategyContext {
  normalizedUrl: NormalizedUrlResult;
  fingerprint: SourceFingerprint;
  initialHtml?: string;
  initialResponseHeaders?: Record<string, string>;
}

export interface StrategyExecutionResult {
  matched: boolean;
  strategyName: string;
  sourceType: string;
  atsType?: string;
  jobsEndpoint: string;
  httpMethod: 'GET' | 'POST';
  companyName: string;
  officialDomain: string;
  jobs: DiscoveredJobRaw[];
  expectedJobCount: number | null;
  completeness: CompletenessStatus;
  paginationSupported: boolean;
  paginationConfig?: any;
  mappingConfig?: any;
  error?: string;
}

export interface IJobSourceStrategy {
  readonly name: string;
  readonly priority: number; // lower number runs earlier

  canHandle(context: StrategyContext): Promise<boolean> | boolean;
  execute(context: StrategyContext): Promise<StrategyExecutionResult>;
}
