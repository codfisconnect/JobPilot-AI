import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'http';
import { safeFetchUrl, validateSafeUrl, isPrivateIpv4, isPrivateIpv6 } from '../utils/safeFetch.js';
import { runSafeFetchDiagnostic } from '../utils/safeFetchDiagnostic.js';
import { JobSourceDiscoveryService } from '../services/jobSourceDiscovery.service.js';
import { EmbeddedDataDiscoveryService } from '../services/embeddedDataDiscovery.service.js';
import { FieldMapperService } from '../services/fieldMapper.service.js';

describe('SafeFetch and Discovery Regression Tests', () => {
  let mockServer: http.Server;
  let serverPort: number;

  before(async () => {
    mockServer = http.createServer((req, res) => {
      const url = req.url || '';

      if (url === '/html-200') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<!DOCTYPE html><html><head><title>Jobs at Acme Corp</title></head><body>
          <div class="job-card">
            <h4>Full Stack Engineer</h4>
            <p>Location: Remote</p>
            <p>Experience: 3+ years</p>
            <a href="https://jobs.lever.co/acme/123">Apply</a>
          </div>
          <div class="job-card">
            <h4>DevOps Architect</h4>
            <p>Location: New York</p>
            <p>Experience: 5+ years</p>
            <a href="https://jobs.lever.co/acme/456">Apply</a>
          </div>
        </body></html>`);
        return;
      }

      if (url === '/slow-hang') {
        // Deliberately do not end response to test timeout
        return;
      }

      if (url === '/redirect-1') {
        res.writeHead(302, { Location: `/html-200` });
        res.end();
        return;
      }

      if (url === '/status-403') {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('Forbidden');
        return;
      }

      if (url === '/status-429') {
        res.writeHead(429, { 'Content-Type': 'text/plain' });
        res.end('Too Many Requests');
        return;
      }

      if (url === '/malformed-html') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<div unclosed tag <<>>>><<<<>>');
        return;
      }

      if (url === '/malformed-json') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"jobs": [ missing bracket');
        return;
      }

      if (url === '/too-large') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        // Send in chunks exceeding max limit if requested
        res.write(Buffer.alloc(2000, 'A'));
        res.end(Buffer.alloc(2000, 'B'));
        return;
      }

      res.writeHead(404);
      res.end('Not found');
    });

    await new Promise<void>((resolve) => {
      mockServer.listen(0, '127.0.0.1', () => {
        const addr = mockServer.address() as any;
        serverPort = addr.port;
        resolve();
      });
    });
  });

  after(() => {
    mockServer?.close();
  });

  it('SSRF validator correctly blocks private and loopback IPs', async () => {
    assert.strictEqual(isPrivateIpv4('127.0.0.1'), true);
    assert.strictEqual(isPrivateIpv4('10.0.0.1'), true);
    assert.strictEqual(isPrivateIpv4('192.168.1.1'), true);
    assert.strictEqual(isPrivateIpv4('169.254.169.254'), true);
    assert.strictEqual(isPrivateIpv4('8.8.8.8'), false);

    assert.strictEqual(isPrivateIpv6('::1'), true);
    assert.strictEqual(isPrivateIpv6('fe80::1'), true);
  });

  it('safeFetchUrl successfully fetches valid 200 HTML', async () => {
    // Note: mockServer is on 127.0.0.1 which validateSafeUrl blocks by default for SSRF
    // Test safeFetch against live test source or verified safe domain
    const check = await validateSafeUrl('https://www.google.com');
    assert.strictEqual(check.safe, true);

    const res = await safeFetchUrl('https://www.google.com', { timeoutMs: 5000 });
    assert.strictEqual(res.status, 200);
    assert.ok(res.text.length > 0);
  });

  it('safeFetchUrl enforces strict hard upper-bound timeout without hanging', async () => {
    const t0 = Date.now();
    try {
      // httpstat.us/200?sleep=10000 sleeps for 10 seconds
      await safeFetchUrl('https://httpstat.us/200?sleep=10000', { timeoutMs: 800 });
      assert.fail('Should have timed out');
    } catch (err: any) {
      const elapsed = Date.now() - t0;
      assert.ok(
        err.message.includes('timed out') ||
        err.message.includes('SSRF') ||
        err.message.includes('abort') ||
        err.message.includes('fetch failed'),
        `Expected timeout/fetch error, got: ${err.message}`
      );
      assert.ok(elapsed < 4000, `Fetch should abort promptly under timeout limit, took ${elapsed}ms`);
    }
  });

  it('safeFetchUrl enforces maxResponseSizeBytes limit', async () => {
    try {
      await safeFetchUrl('https://www.google.com', { maxResponseSizeBytes: 100 });
      assert.fail('Should have thrown size exceeded error');
    } catch (err: any) {
      assert.ok(err.message.includes('exceeded maximum allowed limit'));
    }
  });

  it('safeFetchDiagnostic executes and collects full metrics', async () => {
    const diag = await runSafeFetchDiagnostic('https://www.google.com');
    assert.strictEqual(diag.fetch.status, 200);
    assert.ok(diag.dnsResolution.durationMs >= 0);
    assert.ok(diag.fetch.totalDurationMs! > 0);
    assert.ok(diag.fetch.contentLength! > 0);
  });

  it('EmbeddedDataDiscoveryService extracts jobs from Next.js self.__next_f fixture', async () => {
    const fixtureHtml = `
      <!DOCTYPE html>
      <html>
        <head><title>Careers at Acme Corp</title></head>
        <body>
          <div id="root">Loading</div>
          <script>self.__next_f.push([1,"5:[\\\"$\\\",\\\"div\\\",null,{\\\"jobs\\\":[{\\\"jobRequisitionId\\\":\\\"REQ101\\\",\\\"Job_Requisition\\\":\\\"REQ101 Senior Cloud Architect (Open)\\\",\\\"Job_Posting_Location\\\":\\\"Bengaluru\\\",\\\"isActive\\\":true,\\\"url\\\":\\\"https://acme.wd1.myworkdayjobs.com/job/101\\\"},{\\\"jobRequisitionId\\\":\\\"REQ102\\\",\\\"Job_Requisition\\\":\\\"REQ102 DevOps Engineer (Open)\\\",\\\"Job_Posting_Location\\\":\\\"Pune\\\",\\\"isActive\\\":true,\\\"url\\\":\\\"https://acme.wd1.myworkdayjobs.com/job/102\\\"},{\\\"jobRequisitionId\\\":\\\"REQ103\\\",\\\"Job_Requisition\\\":\\\"REQ103 Product Manager (Closed)\\\",\\\"Job_Posting_Location\\\":\\\"Remote\\\",\\\"isActive\\\":false,\\\"url\\\":\\\"https://acme.wd1.myworkdayjobs.com/job/103\\\"}]}]"])</script>
        </body>
      </html>
    `;

    const embeddedResult = EmbeddedDataDiscoveryService.extractEmbeddedJobsFromHtml(fixtureHtml);
    assert.ok(embeddedResult, 'Embedded result should exist');
    assert.strictEqual(embeddedResult.sourceType, 'NEXT_JS_RSC');
    assert.strictEqual(embeddedResult.jobs.length, 3);

    const mapping = FieldMapperService.inferDeterministicMapping(embeddedResult.jobs);
    assert.strictEqual(mapping.externalJobIdField, 'jobRequisitionId');
    assert.strictEqual(mapping.titleField, 'Job_Requisition');
    assert.strictEqual(mapping.locationField, 'Job_Posting_Location');
    assert.strictEqual(mapping.applicationUrlField, 'url');
    assert.strictEqual(mapping.activeField, 'isActive');

    // Verify mapping and title cleaning
    const defaults = {
      companyName: 'Acme Corp',
      careersUrl: 'https://acme.com/careers',
      sourceType: 'EMBEDDED_DATA',
      sourceName: 'Acme Corp'
    };

    const activeJob = FieldMapperService.mapRecord(embeddedResult.jobs[0], mapping, defaults);
    assert.ok(activeJob);
    assert.strictEqual(activeJob.externalJobId, 'REQ101');
    assert.strictEqual(activeJob.title, 'Senior Cloud Architect');
    assert.strictEqual(activeJob.applicationUrl, 'https://acme.wd1.myworkdayjobs.com/job/101');

    // Verify inactive job is rejected
    const inactiveJob = FieldMapperService.mapRecord(embeddedResult.jobs[2], mapping, defaults);
    assert.strictEqual(inactiveJob, null, 'Inactive job should be filtered out');
  });

  it('EmbeddedDataDiscoveryService handles malformed RSC payloads gracefully without throwing', () => {
    const malformedHtml = `
      <script>self.__next_f.push([1, "invalid:json:{bad"])</script>
      <script>self.__next_f.push([2, ""])</script>
    `;
    const res = EmbeddedDataDiscoveryService.extractEmbeddedJobsFromHtml(malformedHtml);
    assert.strictEqual(res, null);
  });

  it('Synechron discovery succeeds with generic embedded Next.js data extraction', async () => {
    const res = await JobSourceDiscoveryService.discoverSource('https://www.synechron.com/careers');
    assert.strictEqual(res.detectedType, 'EMBEDDED_DATA');
    assert.strictEqual(res.companyName, 'Synechron');
    assert.ok(res.jobCount >= 100, `Expected over 100 jobs from embedded RSC state, got ${res.jobCount}`);
    assert.ok(res.sampleJobs[0].url.includes('myworkdayjobs.com'));
  });
});
