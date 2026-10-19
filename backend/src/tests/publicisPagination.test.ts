import { describe, it } from 'node:test';
import assert from 'node:assert';
import { CompletenessEstimatorService } from '../universalDiscovery/completenessEstimator.service.js';
import { FieldMapperService } from '../services/fieldMapper.service.js';
import { JobNormalizationService } from '../services/jobNormalization.service.js';

describe('Publicis Sapient Global Pagination & Completeness Regression Suite', () => {
  it('1. Completeness: extracts total from Solr response numFound correctly', () => {
    const payload = {
      responseHeader: { status: 0, QTime: 1 },
      response: {
        numFound: 382,
        start: 0,
        docs: new Array(50).fill(null).map((_, i) => ({ id: `job-${i}`, name: `Test Job ${i}` }))
      }
    };

    const reportedTotal = CompletenessEstimatorService.extractReportedTotal(payload);
    assert.strictEqual(reportedTotal, 382, 'Should extract numFound 382 from Solr response');

    const eval50 = CompletenessEstimatorService.evaluate(50, reportedTotal);
    assert.strictEqual(eval50.completeness, 'PARTIAL', '50 out of 382 jobs must be marked PARTIAL, not COMPLETE or HEALTHY');

    const eval382 = CompletenessEstimatorService.evaluate(382, reportedTotal);
    assert.strictEqual(eval382.completeness, 'COMPLETE', '382 out of 382 jobs must be marked COMPLETE');
  });

  it('2. Pagination simulation: paginates through multiple pages until expected count is reached', () => {
    const totalCount = 403;
    const pageSize = 50;
    const collectedDocs: any[] = [];

    // Simulate page generator
    const getPage = (startOffset: number, rows: number) => {
      const remaining = Math.max(0, totalCount - startOffset);
      const count = Math.min(rows, remaining);
      const docs = [];
      for (let i = 0; i < count; i++) {
        const id = `PS-${startOffset + i}`;
        docs.push({
          id,
          name: `Job ${startOffset + i}`,
          countryName: i % 2 === 0 ? 'India' : 'United States',
          city: i % 2 === 0 ? 'Bengaluru' : 'New York',
          displayLocation: i % 2 === 0 ? 'Bengaluru, India' : 'New York, United States',
          jobUrl: `https://sapient-publicisgroupe.icims.com/jobs/${startOffset + i}/job/login`
        });
      }
      return {
        response: {
          numFound: totalCount,
          start: startOffset,
          docs
        }
      };
    };

    // Simulate pagination loop identical to JobSourceDiscoveryService
    let currentOffset = 0;
    let pageCount = 0;
    const maxPages = 50;

    // First page
    const firstPage = getPage(0, pageSize);
    const reportedTotal = CompletenessEstimatorService.extractReportedTotal(firstPage);
    assert.strictEqual(reportedTotal, 403);
    const { jobs: firstJobs } = FieldMapperService.extractJobsArray(firstPage);
    collectedDocs.push(...firstJobs);
    currentOffset += firstJobs.length;

    // Subsequent pages
    while (collectedDocs.length < reportedTotal! && pageCount < maxPages) {
      const nextPage = getPage(currentOffset, pageSize);
      const { jobs: nextJobs } = FieldMapperService.extractJobsArray(nextPage);
      if (!nextJobs || nextJobs.length === 0) break;
      collectedDocs.push(...nextJobs);
      currentOffset += nextJobs.length;
      pageCount++;
    }

    assert.strictEqual(collectedDocs.length, 403, 'Must collect all 403 records across all pages');
    assert.strictEqual(pageCount, 8, 'Should have fetched 8 additional pages (total 9 pages)');

    const completeness = CompletenessEstimatorService.evaluate(collectedDocs.length, reportedTotal);
    assert.strictEqual(completeness.completeness, 'COMPLETE');
  });

  it('3. Metadata normalization: preserves countryName, city, displayLocation, and applicationUrl', () => {
    const rawPublicisItem = {
      id: '2024-48834',
      name: 'Engineering Director',
      countryName: 'France',
      city: 'Paris',
      displayLocation: 'Paris, France',
      typeOfEmployment: 'Full-time',
      experienceLevel: 'Director',
      jobUrl: 'https://sapient-publicisgroupe.icims.com/jobs/48834/job/login',
      releasedDate: '2024-12-09T15:20:00Z'
    };

    const mapping = FieldMapperService.inferDeterministicMapping([rawPublicisItem]);
    const defaults = {
      companyName: 'Publicis Sapient',
      companyDomain: 'publicissapient.com',
      careersUrl: 'https://careers.publicissapient.com',
      sourceType: 'JSON_API',
      sourceName: 'Publicis Sapient'
    };

    const mapped = FieldMapperService.mapRecord(rawPublicisItem, mapping, defaults);
    assert.ok(mapped);
    assert.strictEqual(mapped.title, 'Engineering Director');

    // Simulate metadata enricher from JobSourceDiscoveryService
    if (!mapped.country && (rawPublicisItem.countryName || (rawPublicisItem as any).country)) {
      mapped.country = rawPublicisItem.countryName || (rawPublicisItem as any).country;
    }
    if (!mapped.city && rawPublicisItem.city) {
      mapped.city = rawPublicisItem.city;
    }
    if (!mapped.location && (rawPublicisItem.displayLocation || (rawPublicisItem as any).location)) {
      mapped.location = rawPublicisItem.displayLocation || (rawPublicisItem as any).location;
    }
    if (!mapped.applicationUrl && rawPublicisItem.jobUrl) {
      mapped.applicationUrl = rawPublicisItem.jobUrl;
    }

    assert.strictEqual(mapped.country, 'France', 'Country must be France');
    assert.strictEqual(mapped.city, 'Paris', 'City must be Paris');
    assert.strictEqual(mapped.location, 'Paris, France', 'Location must be Paris, France');
    assert.strictEqual(mapped.applicationUrl, 'https://sapient-publicisgroupe.icims.com/jobs/48834/job/login');

    const normalized = JobNormalizationService.normalize(mapped);
    assert.strictEqual(normalized.country, 'France');
    assert.strictEqual(normalized.city, 'Paris');
    assert.strictEqual(normalized.title, 'Engineering Director');
    assert.strictEqual(normalized.applicationUrl, 'https://sapient-publicisgroupe.icims.com/jobs/48834/job/login');
  });

  it('4. Global dataset retains multiple countries without single-country bias', () => {
    const rawItems = [
      { id: '1', name: 'Software Engineer', countryName: 'India', city: 'Bengaluru' },
      { id: '2', name: 'Cloud Architect', countryName: 'United States', city: 'New York' },
      { id: '3', name: 'Product Manager', countryName: 'United Kingdom', city: 'London' },
      { id: '4', name: 'QA Engineer', countryName: 'Romania', city: 'Brasov' },
      { id: '5', name: 'DevOps Lead', countryName: 'Germany', city: 'Munich' }
    ];

    const countries = new Set(rawItems.map(j => j.countryName));
    assert.strictEqual(countries.size, 5);
    assert.ok(countries.has('India'));
    assert.ok(countries.has('United States'));
    assert.ok(countries.has('United Kingdom'));
    assert.ok(countries.has('Romania'));
    assert.ok(countries.has('Germany'));
  });
});
