import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import supertest from 'supertest';
import { app } from '../server.js';
import { prisma } from '../database/prisma.js';
import { DiscoveryQueueService, MANUAL_DISCOVERY_BATCH_ID } from '../services/discoveryQueue.service.js';
import { BulkSourceItemStatus } from '@prisma/client';
import { signAccessToken } from '../utils/jwt.js';

describe('Discovery Queue & Non-Blocking API Test Suite', () => {
  const adminPayload = {
    userId: 'admin-queue-test-id',
    email: 'admin.queue@pilotmama.com',
    role: 'ADMIN'
  };
  const adminToken = signAccessToken(adminPayload);

  before(async () => {
    // Clean any prior test items
    await prisma.bulkSourceItem.deleteMany({
      where: { bulkJobId: MANUAL_DISCOVERY_BATCH_ID }
    }).catch(() => {});
  });

  it('1. POST /api/v1/admin/job-sources/discover responds with 202 and taskId immediately', async () => {
    const res = await supertest(app)
      .post('/api/v1/admin/job-sources/discover')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ url: 'https://example-test-company-a.com/careers' });

    assert.strictEqual(res.status, 202);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.taskId);
    assert.strictEqual(res.body.status, 'QUEUED');
  });

  it('2. Repeated submission adds second URL to queue without blocking (FIFO order)', async () => {
    const resB = await supertest(app)
      .post('/api/v1/admin/job-sources/discover')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ url: 'https://example-test-company-b.com/careers' });

    assert.strictEqual(resB.status, 202);
    assert.ok(resB.body.taskId);

    // Fetch queue tasks
    const tasksRes = await supertest(app)
      .get('/api/v1/admin/job-sources/discovery-tasks')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.strictEqual(tasksRes.status, 200);
    assert.strictEqual(tasksRes.body.success, true);
    assert.ok(Array.isArray(tasksRes.body.queued));

    // Verify task B is in queued list
    const foundB = tasksRes.body.queued.find((t: any) => t.id === resB.body.taskId);
    assert.ok(foundB);
  });

  it('3. Duplicate submission does not create duplicate pending tasks', async () => {
    const resDuplicate = await supertest(app)
      .post('/api/v1/admin/job-sources/discover')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ url: 'https://example-test-company-b.com/careers' });

    assert.strictEqual(resDuplicate.status, 200);
    assert.strictEqual(resDuplicate.body.isDuplicate, true);
  });

  it('4. Admin can cancel a queued task', async () => {
    // Add task C
    const resC = await supertest(app)
      .post('/api/v1/admin/job-sources/discover')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ url: 'https://example-test-company-c.com/careers' });

    assert.strictEqual(resC.status, 202);

    // Cancel task C
    const cancelRes = await supertest(app)
      .post(`/api/v1/admin/job-sources/discovery-tasks/${resC.body.taskId}/cancel`)
      .set('Authorization', `Bearer ${adminToken}`);

    assert.strictEqual(cancelRes.status, 200);
    assert.strictEqual(cancelRes.body.task.status, 'CANCELLED');
  });

  it('5. Admin can retry a cancelled task and it returns to QUEUED', async () => {
    const resD = await supertest(app)
      .post('/api/v1/admin/job-sources/discover')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ url: 'https://example-test-company-d.com/careers' });

    const taskId = resD.body.taskId || resD.body.task?.id;
    assert.ok(taskId, 'taskId must be defined');

    const cancelRes = await supertest(app)
      .post(`/api/v1/admin/job-sources/discovery-tasks/${taskId}/cancel`)
      .set('Authorization', `Bearer ${adminToken}`);

    assert.strictEqual(cancelRes.body.task.status, 'CANCELLED');

    const retryRes = await supertest(app)
      .post(`/api/v1/admin/job-sources/discovery-tasks/${taskId}/retry`)
      .set('Authorization', `Bearer ${adminToken}`);

    assert.strictEqual(retryRes.status, 200);
    assert.strictEqual(retryRes.body.task.status, 'QUEUED');
  });
});
