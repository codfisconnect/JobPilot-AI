import { describe, it } from 'node:test';
import assert from 'node:assert';
import { safeParseJson } from '../utils/safeJson.js';
import { JobSourceDiscoveryService } from '../services/jobSourceDiscovery.service.js';
import { CompletenessEstimatorService } from '../universalDiscovery/completenessEstimator.service.js';

describe('Universal Job Discovery Robustness Suite', () => {
  it('1. Never blindly parses JSON: safely handles HTML error page without crashing', () => {
    const htmlPayload = '<!DOCTYPE html><html><head><title>Error</title></head><body><h1>404 Not Found</h1></body></html>';
    const result = safeParseJson(htmlPayload, 'text/html');
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.isHtml, true);
    assert.strictEqual(result.data, null);
    assert.ok(result.error?.includes('HTML'));
  });

  it('2. Safely handles malformed JSON without crashing', () => {
    const malformed = '{ "title": "Software Engineer", "jobs": [ ';
    const result = safeParseJson(malformed, 'application/json');
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.isHtml, false);
    assert.strictEqual(result.data, null);
    assert.ok(result.error?.includes('Malformed JSON'));
  });

  it('3. Safely parses valid JSON payloads', () => {
    const valid = JSON.stringify({ total: 42, jobs: [{ id: '1', title: 'Developer' }] });
    const result = safeParseJson(valid, 'application/json');
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.isHtml, false);
    assert.strictEqual(result.data.total, 42);
    assert.strictEqual(result.data.jobs.length, 1);
  });

  it('4. Company name extraction rejects generic marketing slogans and picks verified brand', () => {
    const url = 'https://careers.caterpillar.com/en/jobs/?search=&origin=global';
    const htmlWithSlogan = '<html><head><title>Jobs - Do the Work that Matters | Caterpillar Careers</title></head><body></body></html>';
    const meta = JobSourceDiscoveryService.extractCompanyMetadata(url, htmlWithSlogan);
    assert.strictEqual(meta.companyName, 'Caterpillar');
    assert.strictEqual(meta.domain, 'careers.caterpillar.com');
  });

  it('5. Completeness estimator accurately evaluates PARTIAL and COMPLETE statuses', () => {
    const partial = CompletenessEstimatorService.evaluate(18, 83);
    assert.strictEqual(partial.completeness, 'PARTIAL');

    const complete = CompletenessEstimatorService.evaluate(83, 83);
    assert.strictEqual(complete.completeness, 'COMPLETE');

    const unknown = CompletenessEstimatorService.evaluate(18, null);
    assert.strictEqual(unknown.completeness, 'UNKNOWN');
  });
});
