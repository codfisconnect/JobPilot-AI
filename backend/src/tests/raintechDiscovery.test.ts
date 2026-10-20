import { describe, it } from 'node:test';
import assert from 'node:assert';
import { UrlNormalizationService } from '../universalDiscovery/urlNormalization.service.js';
import { EmbeddedDataDiscoveryService } from '../services/embeddedDataDiscovery.service.js';
import { HtmlJobDiscoveryService } from '../services/htmlJobDiscovery.service.js';
import { UniversalDiscoveryOrchestrator } from '../universalDiscovery/universalDiscoveryOrchestrator.js';

describe('Raintech Software & Universal HTML/Inertia Discovery Regressions', () => {

  it('Normalizes URL fragment #openings without creating duplicate source targets', () => {
    const rawWithFragment = 'https://raintechsoftware.com/careers#openings';
    const norm = UrlNormalizationService.normalize(rawWithFragment);

    assert.strictEqual(norm.domain, 'raintechsoftware.com');
    assert.strictEqual(norm.hash, 'openings');
    assert.strictEqual(norm.canonicalSourceUrl, 'https://raintechsoftware.com/careers');
  });

  it('Generic Inertia.js data-page extractor parses job cards without company-specific code', () => {
    const mockInertiaHtml = `
      <!DOCTYPE html>
      <html>
        <head><title>careers_portal</title></head>
        <body>
          <div id="app" data-page='{"component":"Careers","props":{"careers":[{"id":1,"title":"Web & Mobile Application Development","type":"Full-time","location":"Infopark, Kochi","description":"Experienced developers to build scalable web applications.","vacancy":"3","experience":"2-4 Years","skills":"Laravel, React, React Native","status":1},{"id":2,"title":"QA & Testing Engineer","type":"Full-time","location":"Infopark, Kochi","description":"Automated test suites and manual validation.","vacancy":"2","experience":"1-3 Years","skills":"Selenium, Cypress","status":1}]}}'></div>
        </body>
      </html>
    `;

    const extracted = EmbeddedDataDiscoveryService.extractEmbeddedJobsFromHtml(mockInertiaHtml);
    assert.ok(extracted, 'Should extract embedded data from Inertia data-page');
    assert.strictEqual(extracted.sourceType, 'INERTIA_PAGE');
    assert.strictEqual(extracted.jobs.length, 2);

    const job1 = extracted.jobs[0];
    assert.strictEqual(job1.title, 'Web & Mobile Application Development');
    assert.strictEqual(job1.vacancy, '3');
    assert.strictEqual(job1.experience, '2-4 Years');
    assert.strictEqual(job1.location, 'Infopark, Kochi');
  });

  it('HTML job structure detection recognizes card headings, opening badges, experience, and action links', async () => {
    const mockCareersHtml = `
      <!DOCTYPE html>
      <html>
        <head><title>Open Positions - Tech Careers</title></head>
        <body>
          <section id="openings">
            <h2>Open Positions</h2>
            <p>Showing 2 active openings</p>

            <div class="job-card">
              <h3>Web & Mobile Application Development</h3>
              <span class="badge">3 Openings</span>
              <div class="meta">
                <span>Full-time</span>
                <span>2–4 Years</span>
                <span>Infopark, Kochi</span>
              </div>
              <p class="description">Experienced engineers to build scalable web and mobile software.</p>
              <div class="skills">
                <span>Laravel</span><span>React</span><span>React Native</span>
              </div>
              <div class="actions">
                <a href="/careers/details/1" class="btn">View Details</a>
                <a href="/careers/apply/1" class="btn btn-primary">Apply Now</a>
              </div>
            </div>

            <div class="job-card">
              <h3>QA & Testing Engineer</h3>
              <span class="badge">2 Openings</span>
              <div class="meta">
                <span>Full-time</span>
                <span>1–3 Years</span>
                <span>Infopark, Kochi</span>
              </div>
              <p class="description">Quality assurance engineering for web and mobile products.</p>
              <div class="skills">
                <span>Selenium</span><span>Manual</span>
              </div>
              <div class="actions">
                <a href="/careers/details/2" class="btn">View Details</a>
                <a href="/careers/apply/2" class="btn btn-primary">Apply Now</a>
              </div>
            </div>
          </section>
        </body>
      </html>
    `;

    const result = await HtmlJobDiscoveryService.extractJobsFromHtml('https://generic-company.com/careers', mockCareersHtml);
    assert.ok(result, 'Expected HTML repeated structures to be discovered');
    assert.strictEqual(result.jobs.length, 2);

    const first = result.jobs[0];
    assert.strictEqual(first.title, 'Web & Mobile Application Development');
    assert.strictEqual(first.openingCount, 3);
    assert.strictEqual(first.location, 'Infopark, Kochi');
    assert.ok(first.applicationUrl?.includes('/careers/apply/1'));
    assert.ok(first.detailUrl?.includes('/careers/details/1'));
  });

  it('Live Raintech discovery verifies complete source ingestion without regression', async () => {
    const url = 'https://raintechsoftware.com/careers#openings';
    const result = await UniversalDiscoveryOrchestrator.discover(url);

    assert.strictEqual(result.sourceType, 'EMBEDDED_DATA');
    assert.strictEqual(result.strategy, 'EMBEDDED_STATE_STRATEGY');
    assert.strictEqual(result.companyName, 'Raintech Software');
    assert.strictEqual(result.officialDomain, 'raintechsoftware.com');
    assert.strictEqual(result.sourceUrl, 'https://raintechsoftware.com/careers');
    assert.strictEqual(result.completeness, 'COMPLETE');
    assert.ok(result.discoveredJobCount >= 4, `Expected at least 4 active openings, got: ${result.discoveredJobCount}`);

    // Verify first job structure
    const sample = result.sampleJobs.find(j => j.title.includes('Web & Mobile Application Development'));
    assert.ok(sample, 'Expected Web & Mobile Application Development job in results');
    assert.strictEqual(sample.location, 'Infopark, Kochi');
    assert.strictEqual(sample.employmentType, 'Full-time');
    assert.strictEqual(sample.experience, '2-4 Years');
    assert.strictEqual(sample.openingCount, 3);
    assert.ok(Array.isArray(sample.skills) && sample.skills.includes('Laravel'));
  });
});
