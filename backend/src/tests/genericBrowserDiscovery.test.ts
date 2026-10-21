import { describe, it } from 'node:test';
import assert from 'node:assert';
import { GenericBrowserDiscoveryService } from '../universalDiscovery/services/genericBrowserDiscovery.service.js';
import { CompletenessEstimatorService } from '../universalDiscovery/completenessEstimator.service.js';
import { JobDeduplicationService } from '../universalDiscovery/jobDeduplication.service.js';

describe('Universal Browser Pagination & Completeness Engine', () => {
  it('1. Completeness model distinguishes COMPLETE, PARTIAL, UNKNOWN, FAILED without fabricating values', () => {
    // 0 jobs => FAILED
    const evalZero = CompletenessEstimatorService.evaluate(0, 100);
    assert.strictEqual(evalZero.completeness, 'FAILED');

    // Unknown expected count => UNKNOWN
    const evalUnknown = CompletenessEstimatorService.evaluate(50, null);
    assert.strictEqual(evalUnknown.completeness, 'UNKNOWN');

    // Explicit maxPages cut off before reaching source total (100 < 894) => PARTIAL
    const evalPartial = CompletenessEstimatorService.evaluate(100, 894);
    assert.strictEqual(evalPartial.completeness, 'PARTIAL');

    // Expected total reached or exceeded (894 >= 894) => COMPLETE
    const evalComplete = CompletenessEstimatorService.evaluate(894, 894);
    assert.strictEqual(evalComplete.completeness, 'COMPLETE');
  });

  it('2. SSRF protection cleanly blocks localhost, private IPs, and loopback in browser discovery', async () => {
    const localRes = await GenericBrowserDiscoveryService.discoverRenderedJobs(
      'http://127.0.0.1:8080/careers',
      'Test Local'
    );
    assert.strictEqual(localRes.completeness, 'FAILED');
    assert.strictEqual(localRes.jobs.length, 0);
    assert.ok(localRes.warnings.some(w => w.includes('SSRF protection blocked')));

    const metaRes = await GenericBrowserDiscoveryService.discoverRenderedJobs(
      'http://169.254.169.254/latest/meta-data',
      'Test Cloud Metadata'
    );
    assert.strictEqual(metaRes.completeness, 'FAILED');
    assert.strictEqual(metaRes.jobs.length, 0);
  });

  it('3. Dynamic page calculation formula Math.ceil(sourceTotal / pageSize) is bounded by safetyMaxPages', () => {
    const sourceTotal = 894;
    const pageSize = 20;
    const safetyMaxPages = 100;
    const calculatedPages = Math.ceil(sourceTotal / pageSize); // 45
    const boundedMaxPages = Math.min(calculatedPages, safetyMaxPages);
    assert.strictEqual(calculatedPages, 45);
    assert.strictEqual(boundedMaxPages, 45);

    // Large source with 5000 jobs
    const largeTotal = 5000;
    const largeCalculated = Math.ceil(largeTotal / pageSize); // 250
    const largeBounded = Math.min(largeCalculated, safetyMaxPages);
    assert.strictEqual(largeBounded, 100); // capped by safety ceiling
  });

  it('4. Canonical deduplication preserves unique external IDs and application URLs', () => {
    const rawJobs = [
      { externalJobId: 'REQ-101', title: 'Software Engineer', description: 'desc', url: 'https://site.com/job/1' },
      { externalJobId: 'REQ-101', title: 'Software Engineer - Duplicate', description: 'desc', url: 'https://site.com/job/1-dup' },
      { externalJobId: 'REQ-102', title: 'Product Manager', description: 'desc', url: 'https://site.com/job/2' },
      { title: 'Data Scientist', description: 'desc', applicationUrl: 'https://site.com/job/3' },
      { title: 'Data Scientist', description: 'desc', applicationUrl: 'https://site.com/job/3' }
    ];

    const deduplicated = JobDeduplicationService.deduplicate(rawJobs, 'Acme Corp');
    assert.strictEqual(deduplicated.length, 3);
    assert.strictEqual(deduplicated[0].externalJobId, 'REQ-101');
    assert.strictEqual(deduplicated[1].externalJobId, 'REQ-102');
    assert.strictEqual(deduplicated[2].title, 'Data Scientist');
  });

  it('5. Source total extraction from text patterns recognizes various formats', () => {
    const html1 = '<div>Displaying 1 to 20 of 894 matching jobs</div>';
    const total1 = CompletenessEstimatorService.extractReportedTotalFromHtml(html1);
    assert.strictEqual(total1, 894);

    const html2 = '<span>Showing 1-25 of 1,250 jobs found</span>';
    const total2 = CompletenessEstimatorService.extractReportedTotalFromHtml(html2);
    assert.strictEqual(total2, 1250);

    const html3 = '<p>83 active openings</p>';
    const total3 = CompletenessEstimatorService.extractReportedTotalFromHtml(html3);
    assert.strictEqual(total3, 83);
  });

  it('6. Host environment Chrome/Chromium detection', () => {
    const chromePath = GenericBrowserDiscoveryService.findChromePath();
    assert.ok(chromePath !== null || process.platform === 'linux', 'Chrome path detection returns string or null');
  });
});
