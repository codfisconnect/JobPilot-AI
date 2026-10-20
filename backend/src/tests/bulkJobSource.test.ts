import { test } from 'node:test';
import assert from 'node:assert';
import { BulkJobSourceService } from '../services/bulkJobSource.service.js';

test('BulkJobSourceService: resolveUrlIdentities handles hash routing, query params and deduplication', () => {
  // 1. Hexaware hash SPA route
  const hexaware = BulkJobSourceService.resolveUrlIdentities('https://jobs.hexaware.com/#en/sites/CX_1/jobs');
  assert.strictEqual(hexaware.isValid, true);
  assert.strictEqual(hexaware.domain, 'jobs.hexaware.com');
  assert.strictEqual(hexaware.normalizedUrl.includes('#en/sites/CX_1/jobs'), true, 'Discovery URL must preserve hash');
  assert.strictEqual(hexaware.sourceIdentityUrl, 'https://jobs.hexaware.com/', 'Identity URL must strip hash');

  // 2. Raintech fragment
  const raintech1 = BulkJobSourceService.resolveUrlIdentities('https://raintechsoftware.com/careers#openings');
  const raintech2 = BulkJobSourceService.resolveUrlIdentities('https://raintechsoftware.com/careers/');
  assert.strictEqual(raintech1.isValid, true);
  assert.strictEqual(raintech1.sourceIdentityUrl, raintech2.sourceIdentityUrl, 'Identical source identities must match');

  // 3. SAP SuccessFactors query parameters preserved in identity
  const sap = BulkJobSourceService.resolveUrlIdentities('https://career44.sapsf.com/career?company=mavericsys&career_ns=job_listing_summary&navBarLevel=JOB_SEARCH');
  assert.strictEqual(sap.isValid, true);
  assert.strictEqual(sap.sourceIdentityUrl.includes('company=mavericsys'), true, 'Source identity must preserve company parameter');

  // 4. Invalid URLs
  const invalid = BulkJobSourceService.resolveUrlIdentities('not-a-valid-url');
  assert.strictEqual(invalid.isValid, false);
});

test('BulkJobSourceService: validateBatchPreview flags duplicates, invalid URLs, and existing sources', async () => {
  const urls = [
    'https://careers.caterpillar.com/en/jobs/',
    'https://careers.caterpillar.com/en/jobs', // duplicate
    'not-a-real-url', // invalid
    'https://raintechsoftware.com/careers#openings'
  ];

  const preview = await BulkJobSourceService.validateBatchPreview(urls);
  assert.strictEqual(preview.totalInput, 4);
  assert.strictEqual(preview.invalidCount, 1);
  assert.strictEqual(preview.duplicateCount, 1);
  assert.strictEqual(preview.validCount + preview.alreadyConnectedCount, 2);
});
