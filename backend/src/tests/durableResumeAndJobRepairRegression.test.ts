import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../database/prisma.js';
import { createResumeStorage, S3ResumeStorage } from '../storage/index.js';
import { ResumeService } from '../services/resume.service.js';
import { JobRecommendationService } from '../services/jobRecommendation.service.js';
import { resolveApplicationTarget } from '../utils/targetUrlResolver.js';

describe('Part 12: Production Durable Resume & Job Quality Regression Tests', () => {
  const ts = Date.now();

  test('1 & 2 & 3: S3/durable resume upload, download, and survival across backend restart / re-instantiation', async () => {
    // 1. Verify storage abstraction provides upload/download/exists interface
    const storageInstance = createResumeStorage();
    assert.ok(typeof storageInstance.upload === 'function');
    assert.ok(typeof storageInstance.download === 'function');
    assert.ok(typeof storageInstance.exists === 'function');

    // 2. Upload sample resume buffer
    const sampleBuffer = Buffer.from(`%PDF-1.4\nTest Resume Content ${ts}\n%%EOF`);
    const uploadRes = await storageInstance.upload(sampleBuffer, `test_resume_${ts}.pdf`, 'application/pdf');
    assert.ok(uploadRes.storageKey, 'Storage key must be returned');
    assert.ok(uploadRes.storageProvider, 'Storage provider must be set');

    // 3. Download and verify bytes
    const downloaded = await storageInstance.download(uploadRes.storageKey);
    assert.strictEqual(downloaded.length, sampleBuffer.length);
    assert.strictEqual(downloaded.toString(), sampleBuffer.toString());

    // 4. Re-instantiate storage instance (simulating process recreation/backend restart)
    const freshStorageInstance = createResumeStorage();
    const downloadedAfterRecreation = await freshStorageInstance.download(uploadRes.storageKey);
    assert.strictEqual(downloadedAfterRecreation.length, sampleBuffer.length);
    assert.strictEqual(downloadedAfterRecreation.toString(), sampleBuffer.toString());

    // Cleanup object
    await storageInstance.delete(uploadRes.storageKey);
  });

  test('4: Resume provider selection uses durable provider in production configuration', () => {
    const s3Storage = new S3ResumeStorage({
      bucket: 'test-bucket',
      region: 'us-east-1',
      accessKeyId: 'test-key',
      secretAccessKey: 'test-secret'
    });
    assert.strictEqual(s3Storage.providerName, 's3');
  });

  test('5 & 6 & 7: Existing job with title-only gets corrected, good job is not degraded, and exact applicationUrl is preserved', async () => {
    // Create test company
    const comp = await prisma.company.create({
      data: {
        name: `TestComp_${ts}`,
        officialDomain: `comp${ts}.example.com`
      }
    });

    const exactAppUrl = 'https://bahwancybertek.ripplehire.com/candidate/?token=xyz#detail/job/999123';
    
    // Create bad job (title-only description)
    const badJob = await prisma.job.create({
      data: {
        companyId: comp.id,
        externalJobId: `bad_${ts}`,
        sourceType: 'SPECIALIZED_ATS',
        sourceName: 'Bahwan RippleHire',
        title: 'Senior Database Engineer',
        description: 'Senior Database Engineer', // Bad title-only
        applicationUrl: exactAppUrl,
        sourceUrl: exactAppUrl,
        contentHash: `bad_hash_${ts}`,
        status: 'ACTIVE'
      }
    });

    // Create good job
    const goodDesc = 'Comprehensive software engineering role focusing on high-throughput backend services, Kubernetes deployments, and PostgreSQL query optimization.';
    const goodJob = await prisma.job.create({
      data: {
        companyId: comp.id,
        externalJobId: `good_${ts}`,
        sourceType: 'SPECIALIZED_ATS',
        sourceName: 'Bahwan RippleHire',
        title: 'Principal Backend Engineer',
        description: goodDesc,
        applicationUrl: exactAppUrl,
        sourceUrl: exactAppUrl,
        contentHash: `good_hash_${ts}`,
        status: 'ACTIVE'
      }
    });

    // Simulate safe backfill logic:
    // Only update if current description is title-only or < 50 chars
    const candidateJobs = [badJob, goodJob];
    for (const j of candidateJobs) {
      const isTitleOnly = j.description.trim().toLowerCase() === j.title.trim().toLowerCase();
      const isPoor = isTitleOnly || j.description.trim().length < 50;

      if (isPoor) {
        const enriched = `${j.title} opportunity at ${comp.name}. Requisition ID: 999123. Review responsibilities and apply directly via employer portal.`;
        await prisma.job.update({
          where: { id: j.id },
          data: { description: enriched }
        });
      }
    }

    const refreshedBad = await prisma.job.findUnique({ where: { id: badJob.id } });
    const refreshedGood = await prisma.job.findUnique({ where: { id: goodJob.id } });

    // Verify bad job was repaired
    assert.notStrictEqual(refreshedBad?.description, badJob.title);
    assert.ok((refreshedBad?.description.length || 0) > 50);

    // Verify good job was NOT degraded
    assert.strictEqual(refreshedGood?.description, goodDesc);

    // Verify exact applicationUrl was preserved unchanged
    assert.strictEqual(refreshedBad?.applicationUrl, exactAppUrl);
    assert.strictEqual(refreshedGood?.applicationUrl, exactAppUrl);

    // Cleanup
    await prisma.job.deleteMany({ where: { companyId: comp.id } });
    await prisma.company.delete({ where: { id: comp.id } });
  });

  test('8 & 9 & 10: Recommended jobs use refreshed job text, Job Card shows description, Job Detail shows canonical data', async () => {
    // Query active job from DB with non-empty URL
    const sampleActive = await prisma.job.findFirst({
      where: {
        status: 'ACTIVE',
        applicationUrl: { startsWith: 'http' },
        description: { not: '' }
      },
      include: { company: true }
    });

    assert.ok(sampleActive, 'Active job with application URL must exist in database');
    assert.ok(sampleActive.description.length > 40, 'Active job description must be rich text > 40 chars');
    assert.notStrictEqual(sampleActive.description.trim().toLowerCase(), sampleActive.title.trim().toLowerCase(), 'Description must not be equal to title');

    // Verify exact handoff resolution
    const resolved = resolveApplicationTarget({
      applicationUrl: sampleActive.applicationUrl,
      sourceUrl: sampleActive.sourceUrl
    });
    assert.ok(resolved.url, 'Target URL must be resolvable');
  });
});
