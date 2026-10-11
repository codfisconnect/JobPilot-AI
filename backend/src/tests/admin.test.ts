import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { app } from '../server.js';
import { prisma } from '../database/prisma.js';
import { signAccessToken } from '../utils/jwt.js';
import { UserRole } from '@prisma/client';

describe('Admin Dashboard Security & API Suite', () => {
  let adminUser: any;
  let candidateUser: any;
  let employerUser: any;
  let adminToken: string;
  let candidateToken: string;
  let employerToken: string;

  before(async () => {
    // Clean up previous test users if any
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [
            'test_admin_suite@pilotmama.com',
            'test_candidate_suite@pilotmama.com',
            'test_employer_suite@pilotmama.com'
          ]
        }
      }
    });

    // Create Admin User
    adminUser = await prisma.user.create({
      data: {
        email: 'test_admin_suite@pilotmama.com',
        passwordHash: '$2b$10$abcdefghijklmnopqrstuv',
        role: UserRole.ADMIN,
        isActive: true,
        emailVerified: true
      }
    });
    adminToken = signAccessToken({
      userId: adminUser.id,
      email: adminUser.email,
      role: adminUser.role
    });

    // Create Candidate User with profile
    candidateUser = await prisma.user.create({
      data: {
        email: 'test_candidate_suite@pilotmama.com',
        passwordHash: '$2b$10$abcdefghijklmnopqrstuv',
        role: UserRole.CANDIDATE,
        isActive: true,
        emailVerified: true,
        candidateProfile: {
          create: {
            fullName: 'Test Candidate Suite',
            headline: 'Full Stack Engineer'
          }
        }
      }
    });
    candidateToken = signAccessToken({
      userId: candidateUser.id,
      email: candidateUser.email,
      role: candidateUser.role
    });

    // Create Employer User
    employerUser = await prisma.user.create({
      data: {
        email: 'test_employer_suite@pilotmama.com',
        passwordHash: '$2b$10$abcdefghijklmnopqrstuv',
        role: UserRole.EMPLOYER,
        isActive: true,
        emailVerified: true
      }
    });
    employerToken = signAccessToken({
      userId: employerUser.id,
      email: employerUser.email,
      role: employerUser.role
    });
  });

  after(async () => {
    // Clean up
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [
            'test_admin_suite@pilotmama.com',
            'test_candidate_suite@pilotmama.com',
            'test_employer_suite@pilotmama.com'
          ]
        }
      }
    });
  });

  describe('1. Security & RBAC Enforcement', () => {
    it('should reject unauthenticated request with 401', async () => {
      const res = await request(app)
        .get('/api/v1/admin/dashboard');

      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.body.success, false);
    });

    it('should reject candidate user with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/v1/admin/dashboard')
        .set('Authorization', `Bearer ${candidateToken}`);

      assert.strictEqual(res.status, 403);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.error.message, /not authorized/);
    });

    it('should reject employer user with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/v1/admin/dashboard')
        .set('Authorization', `Bearer ${employerToken}`);

      assert.strictEqual(res.status, 403);
      assert.strictEqual(res.body.success, false);
    });

    it('should reject invalid Bearer token with 401', async () => {
      const res = await request(app)
        .get('/api/v1/admin/dashboard')
        .set('Authorization', 'Bearer invalid-jwt-token');

      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.body.success, false);
    });
  });

  describe('2. Admin API Endpoints with Valid Admin JWT', () => {
    it('GET /api/v1/admin/dashboard - returns real-time metrics', async () => {
      const res = await request(app)
        .get('/api/v1/admin/dashboard')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(typeof res.body.data.totalCandidates === 'number');
      assert.ok(typeof res.body.data.totalActiveJobs === 'number');
      assert.ok(typeof res.body.data.totalApplications === 'number');
      assert.ok(typeof res.body.data.paymentsSummary === 'object');
      assert.ok(typeof res.body.data.creditsSummary === 'object');
    });

    it('GET /api/v1/admin/candidates - returns paginated candidates', async () => {
      const res = await request(app)
        .get('/api/v1/admin/candidates?page=1&pageSize=10')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(Array.isArray(res.body.data));
      assert.ok(res.body.pagination);
      assert.strictEqual(res.body.pagination.page, 1);
      assert.strictEqual(res.body.pagination.pageSize, 10);
      // Verify no sensitive fields exposed
      if (res.body.data.length > 0) {
        assert.strictEqual(res.body.data[0].passwordHash, undefined);
        assert.strictEqual(res.body.data[0].refreshTokens, undefined);
      }
    });

    it('GET /api/v1/admin/candidates/:id - returns candidate details', async () => {
      const res = await request(app)
        .get(`/api/v1/admin/candidates/${candidateUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.id, candidateUser.id);
      assert.strictEqual(res.body.data.email, candidateUser.email);
      assert.strictEqual(res.body.data.passwordHash, undefined);
    });

    it('GET /api/v1/admin/resumes - returns paginated resumes', async () => {
      const res = await request(app)
        .get('/api/v1/admin/resumes')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(Array.isArray(res.body.data));
      assert.ok(res.body.pagination);
    });

    it('GET /api/v1/admin/jobs - returns paginated jobs with filters', async () => {
      const res = await request(app)
        .get('/api/v1/admin/jobs?status=ALL')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(Array.isArray(res.body.data));
    });

    it('GET /api/v1/admin/applications - returns applications list', async () => {
      const res = await request(app)
        .get('/api/v1/admin/applications')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(Array.isArray(res.body.data));
    });

    it('GET /api/v1/admin/employers - returns employers list', async () => {
      const res = await request(app)
        .get('/api/v1/admin/employers')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(Array.isArray(res.body.data));
    });

    it('GET /api/v1/admin/payments - returns payments list without secrets', async () => {
      const res = await request(app)
        .get('/api/v1/admin/payments')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(Array.isArray(res.body.data));
    });

    it('GET /api/v1/admin/subscriptions - returns subscriptions list', async () => {
      const res = await request(app)
        .get('/api/v1/admin/subscriptions')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(Array.isArray(res.body.data));
    });

    it('GET /api/v1/admin/credits - returns wallets and recent ledger', async () => {
      const res = await request(app)
        .get('/api/v1/admin/credits')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(Array.isArray(res.body.data.wallets));
      assert.ok(Array.isArray(res.body.data.recentActivity));
    });

    it('GET /api/v1/admin/health - returns system health metrics', async () => {
      const res = await request(app)
        .get('/api/v1/admin/health')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(res.body.data.database);
      assert.strictEqual(res.body.data.database.engine, 'PostgreSQL');
      assert.ok(typeof res.body.data.uptimeSeconds === 'number');
    });
  });
});
