import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'http';
import { JobSourceDiscoveryService } from '../services/jobSourceDiscovery.service.js';
import { FieldMapperService } from '../services/fieldMapper.service.js';
import { validateSafeUrl, isPrivateIpv4, isPrivateIpv6 } from '../utils/safeFetch.js';
import { prisma } from '../database/prisma.js';
import supertest from 'supertest';
import { app } from '../server.js';
import { signAccessToken } from '../utils/jwt.js';

describe('Sprint Job Source Discovery & Universal Onboarding Suite', () => {
  let mockServer: http.Server;
  let serverPort: number;
  let adminToken: string;
  let candidateToken: string;

  before(async () => {
    // Generate test JWT tokens
    adminToken = signAccessToken({
      userId: 'test-admin-discovery-id',
      email: 'admin@pilotmama.io',
      role: 'ADMIN'
    });

    candidateToken = signAccessToken({
      userId: 'test-candidate-discovery-id',
      email: 'candidate@pilotmama.io',
      role: 'CANDIDATE'
    });

    // Start local mock HTTP server serving mock fixtures
    mockServer = http.createServer((req, res) => {
      const url = req.url || '';

      if (url === '/direct-jobs.json') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          data: [
            {
              id: 101,
              job_code: 'MOCK-DEV-001',
              title: 'Senior TypeScript Engineer',
              department: 'Platform Engineering',
              location: 'Bangalore, India',
              workMode: 'Hybrid',
              employmentType: 'Full-time',
              experience: '3-5 years',
              salary: '₹18,00,000 - ₹24,00,000 / year',
              description: 'Design robust distributed microservices and reactive endpoints.',
              skills: 'TypeScript, Node.js, PostgreSQL, Docker',
              active: 1
            }
          ]
        }));
        return;
      }

      if (url === '/direct-array.json') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify([
          {
            id: 201,
            title: 'Frontend React Specialist',
            location: 'Remote',
            description: 'Craft stunning web interfaces with modern CSS and state management.',
            active: true
          }
        ]));
        return;
      }

      if (url === '/careers-fetch.html') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <!DOCTYPE html>
          <html>
          <head><title>Careers — Acme Cloud Technologies</title></head>
          <body>
            <h1>Work at Acme</h1>
            <script>
              async function load() {
                const res = await fetch('/api/jobs');
                const data = await res.json();
              }
            </script>
          </body>
          </html>
        `);
        return;
      }

      if (url === '/careers-json-ext.html') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <!DOCTYPE html>
          <html>
          <head><title>Careers at Globex</title></head>
          <body>
            <script>
              const url = "/api/jobs.json";
            </script>
          </body>
          </html>
        `);
        return;
      }

      if (url === '/api/jobs' || url === '/api/jobs.json') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          data: [
            {
              id: 301,
              job_code: 'GLOBEX-001',
              title: 'Cloud DevOps Architect',
              department: 'Infrastructure',
              location: 'San Francisco, CA',
              workMode: 'Remote',
              employmentType: 'Full-time',
              description: 'Maintain high availability multi-region Kubernetes clusters.',
              skills: 'Kubernetes, Terraform, AWS, Prometheus',
              active: 1
            }
          ]
        }));
        return;
      }

      if (url === '/json-ld-careers.html') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Careers — Initech</title>
            <script type="application/ld+json">
            {
              "@context": "https://schema.org/",
              "@type": "JobPosting",
              "title": "Lead Software QA Engineer",
              "description": "Lead automated regression testing frameworks.",
              "hiringOrganization": {
                "@type": "Organization",
                "name": "Initech Corp"
              },
              "jobLocation": {
                "@type": "Place",
                "address": "Austin, TX"
              }
            }
            </script>
          </head>
          <body><h1>Initech Openings</h1></body>
          </html>
        `);
        return;
      }

      if (url === '/malformed.json') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"invalid_json": true'); // missing bracket
        return;
      }

      res.writeHead(404);
      res.end('Not Found');
    });

    await new Promise<void>((resolve) => {
      mockServer.listen(0, '127.0.0.1', () => {
        const addr = mockServer.address() as any;
        serverPort = addr.port;
        resolve();
      });
    });
  });

  after(async () => {
    mockServer.close();
  });

  // 1. SSRF Protection Tests
  describe('SSRF Protection & URL Validation', () => {
    it('should block localhost and 127.0.0.1 hostnames', async () => {
      const res1 = await validateSafeUrl('http://localhost:5000/api');
      assert.strictEqual(res1.safe, false);
      assert.ok(res1.error?.includes('blocked'));

      const res2 = await validateSafeUrl('http://127.0.0.1:8080/test');
      assert.strictEqual(res2.safe, false);
    });

    it('should block private IPv4 addresses (10.x, 192.168.x, 172.16.x, 169.254.x)', () => {
      assert.strictEqual(isPrivateIpv4('10.0.0.1'), true);
      assert.strictEqual(isPrivateIpv4('192.168.1.1'), true);
      assert.strictEqual(isPrivateIpv4('172.20.0.5'), true);
      assert.strictEqual(isPrivateIpv4('169.254.169.254'), true);
      assert.strictEqual(isPrivateIpv4('8.8.8.8'), false);
    });

    it('should block IPv6 loopback and private ranges', () => {
      assert.strictEqual(isPrivateIpv6('::1'), true);
      assert.strictEqual(isPrivateIpv6('fc00::1'), true);
      assert.strictEqual(isPrivateIpv6('fe80::1'), true);
    });

    it('should block disallowed protocols like file:// or ftp://', async () => {
      const res = await validateSafeUrl('file:///etc/passwd');
      assert.strictEqual(res.safe, false);
      assert.ok(res.error?.includes('Disallowed protocol'));
    });
  });

  // 2. Deterministic Field Mapping Tests
  describe('Deterministic Field Mapping', () => {
    it('should extract jobs array from wrapper data[] and results[]', () => {
      const payload1 = { data: [{ title: 'Job 1' }] };
      const res1 = FieldMapperService.extractJobsArray(payload1);
      assert.strictEqual(res1.jobs.length, 1);
      assert.strictEqual(res1.rootPath, 'data');

      const payload2 = [{ title: 'Job Array' }];
      const res2 = FieldMapperService.extractJobsArray(payload2);
      assert.strictEqual(res2.jobs.length, 1);
      assert.strictEqual(res2.rootPath, '');
    });

    it('should infer schema mapping keys from standard fields', () => {
      const sample = [
        {
          job_code: 'COD-QA-001',
          title: 'Manual Tester',
          department: 'Quality Assurance',
          location: 'Chennai, India',
          workMode: 'Hybrid',
          employmentType: 'Full-time',
          salary: '₹3,50,000 - ₹5,50,000 / year',
          qualification: "Bachelor's Degree",
          description: 'Defect discovery role',
          skills: 'Jira, Regression',
          active: 1
        }
      ];

      const mapping = FieldMapperService.inferDeterministicMapping(sample);
      assert.strictEqual(mapping.externalJobIdField, 'job_code');
      assert.strictEqual(mapping.titleField, 'title');
      assert.strictEqual(mapping.departmentField, 'department');
      assert.strictEqual(mapping.locationField, 'location');
      assert.strictEqual(mapping.workModeField, 'workMode');
      assert.strictEqual(mapping.salaryField, 'salary');
    });

    it('should reject or drop jobs without titles without crashing', () => {
      const mapped = FieldMapperService.mapRecord(
        { description: 'No title' },
        { titleField: 'title' },
        { companyName: 'Acme', careersUrl: 'https://acme.com', sourceType: 'JSON', sourceName: 'Acme' }
      );
      assert.strictEqual(mapped, null);
    });

    it('should filter out inactive jobs', () => {
      const mapped = FieldMapperService.mapRecord(
        { title: 'Closed Job', active: 0 },
        { titleField: 'title', activeField: 'active' },
        { companyName: 'Acme', careersUrl: 'https://acme.com', sourceType: 'JSON', sourceName: 'Acme' }
      );
      assert.strictEqual(mapped, null);
    });
  });

  // 3. Admin Security & RBAC Guard Tests
  describe('Admin Authorization Controls', () => {
    it('POST /api/v1/admin/job-sources/discover should reject candidate with 403', async () => {
      const res = await supertest(app)
        .post('/api/v1/admin/job-sources/discover')
        .set('Authorization', `Bearer ${candidateToken}`)
        .send({ url: 'https://www.codfis.com/careers.html' });

      assert.strictEqual(res.status, 403);
    });

    it('POST /api/v1/admin/job-sources/discover should reject unauthenticated requests with 401', async () => {
      const res = await supertest(app)
        .post('/api/v1/admin/job-sources/discover')
        .send({ url: 'https://www.codfis.com/careers.html' });

      assert.strictEqual(res.status, 401);
    });

    it('GET /api/v1/admin/job-sources should allow admin', async () => {
      const res = await supertest(app)
        .get('/api/v1/admin/job-sources')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(Array.isArray(res.body.data));
    });
  });

  // 4. Real Codfis 20-Job Fixture Validation
  describe('Codfis Real Fixture & End-to-End Pipeline', () => {
    it('should discover Codfis JSON API and import jobs using job_code as identity', async () => {
      const onboard = await JobSourceDiscoveryService.discoverAndOnboard('https://www.codfis.com/careers.html');

      assert.strictEqual(onboard.success, true);
      assert.strictEqual(onboard.companyName, 'Codfis Technologies');
      assert.strictEqual(onboard.discovery.detectedType, 'JSON_API');
      assert.strictEqual(onboard.discovery.officialDomain, 'codfis.com');
      assert.strictEqual(onboard.discovery.jobCount, 20);

      // Verify that subsequent sync updates rather than duplicates
      const reSync = await JobSourceDiscoveryService.resyncConfiguration(onboard.sourceConfigurationId);
      assert.strictEqual(reSync.success, true);
      assert.strictEqual(reSync.sync.created, 0); // No duplicates!
      assert.strictEqual(reSync.sync.updated, 20); // All 20 updated smoothly

      // Verify jobs are visible in canonical GET /api/v1/jobs
      const jobsRes = await supertest(app)
        .get('/api/v1/jobs?companyName=Codfis')
        .set('Authorization', `Bearer ${candidateToken}`);

      assert.strictEqual(jobsRes.status, 200);
      assert.strictEqual(jobsRes.body.success, true);
      assert.strictEqual(jobsRes.body.pagination.total, 20);
      assert.strictEqual(jobsRes.body.data[0].company.officialDomain, 'codfis.com');
      assert.ok(jobsRes.body.data[0].externalJobId.startsWith('COD-'));
    });
  });
});
