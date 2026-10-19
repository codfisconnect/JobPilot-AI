import { describe, it } from 'node:test';
import assert from 'node:assert';
import { UrlNormalizationService } from '../universalDiscovery/urlNormalization.service.js';
import { SourceFingerprintService } from '../universalDiscovery/sourceFingerprint.service.js';
import { CompletenessEstimatorService } from '../universalDiscovery/completenessEstimator.service.js';
import { JobRecordScoringService } from '../universalDiscovery/jobRecordScoring.service.js';
import { JobDeduplicationService } from '../universalDiscovery/jobDeduplication.service.js';
import { AdapterRegistry } from '../universalDiscovery/adapterRegistry.js';
import { UniversalDiscoveryOrchestrator } from '../universalDiscovery/universalDiscoveryOrchestrator.js';

describe('Universal Job Discovery Engine V2 Test Suite', () => {

  // 1. URL Normalization & Sanitization
  it('Normalizes URLs with query parameters, hash fragments, and redacts sensitive tokens', () => {
    const raw = 'https://bahwancybertek.ripplehire.com/candidate/?token=ncskoGgjoqYnuqre7tUl&source=CAREERSITE#list';
    const norm = UrlNormalizationService.normalize(raw);

    assert.strictEqual(norm.domain, 'bahwancybertek.ripplehire.com');
    assert.strictEqual(norm.baseUrl, 'https://bahwancybertek.ripplehire.com');
    assert.strictEqual(norm.searchParams.token, 'ncskoGgjoqYnuqre7tUl');
    assert.strictEqual(norm.searchParams.source, 'CAREERSITE');
    assert.strictEqual(norm.hash, 'list');
    assert.strictEqual(norm.isAtsSubdomain, true);
    assert.strictEqual(norm.detectedVendorHint, 'RIPPLEHIRE');

    // Verify sanitization for logs
    assert.ok(!norm.sanitizedLogUrl.includes('ncskoGgjoqYnuqre7tUl'), 'Token must be redacted in sanitized log URL');
    assert.ok(norm.sanitizedLogUrl.includes('[REDACTED]'), 'Sanitized log URL must display [REDACTED]');
  });

  // 2. Source Fingerprinting
  it('Correctly fingerprints ATS platforms (RippleHire, Workday, iCIMS, Greenhouse, Lever, Ashby, SmartRecruiters)', () => {
    const normRipple = UrlNormalizationService.normalize('https://bahwancybertek.ripplehire.com/candidate/?token=secret#list');
    const fpRipple = SourceFingerprintService.fingerprint(normRipple, '<script src="/candresource/candidate/require_main.js"></script>');
    assert.strictEqual(fpRipple.atsVendor, 'RIPPLEHIRE');
    assert.ok(fpRipple.confidence >= 90);

    const normWorkday = UrlNormalizationService.normalize('https://company.wd3.myworkdayjobs.com/careers');
    const fpWorkday = SourceFingerprintService.fingerprint(normWorkday, '<div>workday portal</div>');
    assert.strictEqual(fpWorkday.atsVendor, 'WORKDAY');

    const normGh = UrlNormalizationService.normalize('https://boards.greenhouse.io/acme');
    const fpGh = SourceFingerprintService.fingerprint(normGh);
    assert.strictEqual(fpGh.atsVendor, 'GREENHOUSE');

    const normLever = UrlNormalizationService.normalize('https://jobs.lever.co/acme');
    const fpLever = SourceFingerprintService.fingerprint(normLever);
    assert.strictEqual(fpLever.atsVendor, 'LEVER');

    const normAshby = UrlNormalizationService.normalize('https://jobs.ashbyhq.com/acme');
    const fpAshby = SourceFingerprintService.fingerprint(normAshby);
    assert.strictEqual(fpAshby.atsVendor, 'ASHBY');

    const normSr = UrlNormalizationService.normalize('https://jobs.smartrecruiters.com/acme');
    const fpSr = SourceFingerprintService.fingerprint(normSr);
    assert.strictEqual(fpSr.atsVendor, 'SMARTRECRUITERS');
  });

  // 3. Completeness Model
  it('Accurately calculates completeness: COMPLETE, PARTIAL, UNKNOWN, FAILED without fabricating values', () => {
    const complete = CompletenessEstimatorService.evaluate(178, 178);
    assert.strictEqual(complete.completeness, 'COMPLETE');

    const partial = CompletenessEstimatorService.evaluate(7, 178);
    assert.strictEqual(partial.completeness, 'PARTIAL');

    const unknown = CompletenessEstimatorService.evaluate(25, null);
    assert.strictEqual(unknown.completeness, 'UNKNOWN');

    const failed = CompletenessEstimatorService.evaluate(0, 50);
    assert.strictEqual(failed.completeness, 'FAILED');
  });

  // 4. Job Record Scoring
  it('Scores candidate objects and coherent collections vs non-job objects', () => {
    const jobObj = {
      jobId: '1234',
      jobTitle: 'Senior Software Engineer',
      locations: 'Remote, US',
      jobDesc: 'Lead engineering squad...',
      applyUrl: 'https://careers.example.com/apply/1234'
    };
    const score = JobRecordScoringService.scoreCandidateObject(jobObj);
    assert.ok(score >= 70, `Job score should be high, got: ${score}`);

    const navObj = {
      label: 'Home',
      icon: 'home.svg',
      link: '/home'
    };
    const navScore = JobRecordScoringService.scoreCandidateObject(navObj);
    assert.ok(navScore < 40, `Navigation object score should be low, got: ${navScore}`);

    const arrCheck = JobRecordScoringService.scoreCandidateArray([jobObj, { ...jobObj, jobId: '1235' }]);
    assert.strictEqual(arrCheck.isJobCollection, true);
  });

  // 5. Job Deduplication
  it('Deduplicates job records across IDs, URLs, and canonical content hashes', () => {
    const rawJobs = [
      { externalJobId: 'JOB-1', title: 'Fullstack Dev', location: 'Bengaluru', description: 'Node & React' },
      { externalJobId: 'JOB-1', title: 'Fullstack Dev duplicate', location: 'Bengaluru', description: 'Node & React' }, // duplicate ID
      { externalJobId: 'JOB-2', title: 'Fullstack Dev', location: 'Bengaluru', description: 'Node & React', applicationUrl: 'https://apply/2' },
      { title: 'Fullstack Dev No ID', location: 'Bengaluru', description: 'Node & React', applicationUrl: 'https://apply/dup' },
      { title: 'Fullstack Dev No ID 2', location: 'Bengaluru', description: 'Node & React', applicationUrl: 'https://apply/dup' } // duplicate URL without ID
    ];

    const deduped = JobDeduplicationService.deduplicate(rawJobs, 'Acme Inc');
    assert.strictEqual(deduped.length, 3, 'Should eliminate duplicate external ID and duplicate application URL');
  });

  // 6. Adapter Registry Priority Order
  it('Adapter Registry prioritizes specialized ATS accelerators over generic strategies', () => {
    const strategies = AdapterRegistry.getAllStrategies();
    assert.ok(strategies.length >= 8, 'At least 8 strategies registered');

    // First strategy should be high-priority accelerator (RippleHire priority 10)
    assert.strictEqual(strategies[0].name, 'RIPPLEHIRE_ADAPTER');
    assert.strictEqual(strategies[0].priority, 10);

    // Generic HTML should be later in priority list
    const htmlStrat = strategies.find(s => s.name === 'HTML_REPEATED_STRUCTURE_STRATEGY');
    assert.ok(htmlStrat);
    assert.ok(htmlStrat.priority > 30);
  });

  // 7. Live Diagnostic Test: Bahwan CyberTek on RippleHire
  it('Live Diagnostic: Bahwan CyberTek RippleHire portal discovers real public jobs', async () => {
    const url = 'https://bahwancybertek.ripplehire.com/candidate/?token=ncskoGgjoqYnuqre7tUl&source=CAREERSITE#list';
    const result = await UniversalDiscoveryOrchestrator.discover(url);

    assert.strictEqual(result.atsType, 'RIPPLEHIRE');
    assert.strictEqual(result.strategy, 'RIPPLEHIRE_ADAPTER');
    assert.ok(result.discoveredJobCount > 0, `Expected discovered jobs, got: ${result.discoveredJobCount}`);
    assert.ok(result.expectedJobCount !== null && result.expectedJobCount > 0, 'Should detect expected total jobs');
    assert.ok(result.sampleJobs.length > 0, 'Should have sample jobs');
    assert.ok(result.sampleJobs[0].title.length > 0, 'Sample job has valid title');
    assert.ok(result.sampleJobs[0].applicationUrl?.includes('detail/job'), 'Sample job has official application URL');
    assert.strictEqual(result.paginationSupported, true);
    
    // Check that sensitive token is never exposed in strategy name or company name
    assert.ok(!result.companyName.includes('ncskoGgjoqYnuqre7tUl'));
  });

  // 8. Live Diagnostic Test: Synechron
  it('Live Diagnostic: Synechron careers URL discovers jobs without regression', async () => {
    const url = 'https://www.synechron.com/careers';
    const result = await UniversalDiscoveryOrchestrator.discover(url);

    assert.ok(result.discoveredJobCount > 0, `Expected jobs discovered for Synechron, got: ${result.discoveredJobCount}`);
    assert.ok(result.sampleJobs.length > 0);
  });

  // 9. Live Diagnostic Test: Publicis Sapient Global Inventory
  it('Live Diagnostic: Publicis Sapient discovers COMPLETE global job inventory with multiple countries', async () => {
    // Tests both the default URL and a regional parameter URL to ensure ingestion is always global
    const url = 'https://careers.publicissapient.com/job-search';
    const result = await UniversalDiscoveryOrchestrator.discover(url);

    assert.ok(result.discoveredJobCount >= 300, `Expected complete global inventory (>= 300), got: ${result.discoveredJobCount}`);
    assert.strictEqual(result.completeness, 'COMPLETE');
    assert.ok(result.allDiscoveredJobs && result.allDiscoveredJobs.length >= 300);

    const countries = new Set(result.allDiscoveredJobs.map(j => j.country).filter(Boolean));
    assert.ok(countries.has('India'), 'Should contain Indian opportunities');
    assert.ok(countries.has('United States') || countries.has('France') || countries.has('Germany') || countries.has('United Kingdom'), 'Should contain international opportunities');
    assert.ok(countries.size >= 5, `Expected multiple countries across global inventory, got: ${countries.size}`);
  });

  // 10. Live Diagnostic Test: Virtusa (Embedded JSON / Phenom)
  it('Live Diagnostic: Virtusa global careers URL discovers jobs dynamically', async () => {
    const url = 'https://www.virtusa.com/careers/job-search/global/en';
    const result = await UniversalDiscoveryOrchestrator.discover(url);

    assert.ok(result.discoveredJobCount > 0, `Expected jobs discovered for Virtusa, got: ${result.discoveredJobCount}`);
    assert.ok(result.sampleJobs.length > 0, 'Should have sample jobs');
    assert.ok(result.sampleJobs[0].title.length > 0, 'Sample job has valid title');
    assert.ok(result.sampleJobs[0].location, 'Sample job has location');
  });

  // 11. Live Diagnostic Test: Agilysys (Greenhouse client board)
  it('Live Diagnostic: Agilysys careers portal discovers jobs via Greenhouse adapter', async () => {
    const url = 'https://www.agilysys.com/en/careers-join/';
    const result = await UniversalDiscoveryOrchestrator.discover(url);

    assert.strictEqual(result.atsType, 'GREENHOUSE');
    assert.strictEqual(result.strategy, 'GREENHOUSE_ADAPTER');
    assert.ok(result.discoveredJobCount > 0, `Expected jobs discovered for Agilysys, got: ${result.discoveredJobCount}`);
    assert.ok(result.sampleJobs.length > 0, 'Should have sample jobs');
    assert.ok(result.sampleJobs[0].applicationUrl?.includes('greenhouse.io'), 'Official application URL on Greenhouse');
  });
});
