import { describe, it } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { app } from '../server.js';
import { signAccessToken } from '../utils/jwt.js';
import { UserRole } from '@prisma/client';

describe('Sprint 1 Production API & RBAC Integration Tests', () => {

  describe('GET /api/v1/health', () => {
    it('should return health status JSON envelope', async () => {
      const res = await request(app).get('/api/v1/health');
      assert.ok([200, 503].includes(res.status), `Expected 200 or 503, got ${res.status}`);
      assert.strictEqual(res.body.success, true);
      assert.ok(res.body.data.status);
      assert.strictEqual(res.body.data.database.engine, 'PostgreSQL');
      assert.ok(res.body.meta.requestId);
    });
  });

  describe('POST /api/v1/auth/register input validation', () => {
    it('should return 400 and structured error when payload is invalid', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'not-an-email',
          password: '123'
        });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.error.code, 'VALIDATION_ERROR');
      assert.ok(Array.isArray(res.body.error.details));
      assert.ok(res.body.error.details.some((d: any) => d.field === 'email'));
      assert.ok(res.body.error.details.some((d: any) => d.field === 'password'));
    });
  });

  describe('GET /api/v1/auth/me without token', () => {
    it('should return 401 when Authorization header is missing', async () => {
      const res = await request(app).get('/api/v1/auth/me');
      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
    });

    it('should return 401 when token is invalid', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid-token-string');

      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
    });
  });

  describe('JWT and RBAC Middleware verification', () => {
    it('should decode valid JWT and reach authenticated controller', async () => {
      const token = signAccessToken({
        userId: 'candidate_test_1',
        email: 'test@candidate.com',
        role: UserRole.CANDIDATE
      });

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);

      // Passes JWT middleware; if user is not in live DB or DB unavailable, returns 401 or 500, but NEVER token 401
      assert.ok([200, 401, 500].includes(res.status));
      if (res.status === 401) {
        assert.notStrictEqual(res.body.error.message, 'Invalid access token');
        assert.notStrictEqual(res.body.error.message, 'Authorization header with Bearer token is required');
      }
    });
  });

  describe('Secured Prototype & Transitional Security Boundary', () => {
    it('should serve public /api/jobs without authentication', async () => {
      const jobsRes = await request(app).get('/api/jobs');
      assert.strictEqual(jobsRes.status, 200);
      assert.strictEqual(jobsRes.body.success, true);
      assert.ok(Array.isArray(jobsRes.body.data));
    });

    it('should reject anonymous access to legacy /api/candidates with 401 UNAUTHORIZED', async () => {
      const candidatesRes = await request(app).get('/api/candidates');
      assert.strictEqual(candidatesRes.status, 401);
      assert.strictEqual(candidatesRes.body.success, false);
      assert.strictEqual(candidatesRes.body.error.code, 'UNAUTHORIZED');
    });

    it('should reject anonymous access to legacy /api/applications with 401 UNAUTHORIZED', async () => {
      const appsRes = await request(app).get('/api/applications');
      assert.strictEqual(appsRes.status, 401);
      assert.strictEqual(appsRes.body.success, false);
      assert.strictEqual(appsRes.body.error.code, 'UNAUTHORIZED');
    });

    it('should reject anonymous access to legacy /api/resumes with 401 UNAUTHORIZED', async () => {
      const resumesRes = await request(app).get('/api/resumes');
      assert.strictEqual(resumesRes.status, 401);
      assert.strictEqual(resumesRes.body.success, false);
      assert.strictEqual(resumesRes.body.error.code, 'UNAUTHORIZED');
    });

    it('should block Candidate A from accessing Candidate B profile with 403 FORBIDDEN', async () => {
      const tokenCandidateA = signAccessToken({
        userId: 'candidate_user_A',
        email: 'userA@test.com',
        role: UserRole.CANDIDATE
      });

      const idorRes = await request(app)
        .get('/api/candidates/candidate_user_B')
        .set('Authorization', `Bearer ${tokenCandidateA}`);

      assert.strictEqual(idorRes.status, 403);
      assert.strictEqual(idorRes.body.success, false);
      assert.strictEqual(idorRes.body.error.code, 'FORBIDDEN');
    });

    it('should block Candidate A from modifying Candidate B profile with 403 FORBIDDEN', async () => {
      const tokenCandidateA = signAccessToken({
        userId: 'candidate_user_A',
        email: 'userA@test.com',
        role: UserRole.CANDIDATE
      });

      const idorRes = await request(app)
        .put('/api/candidates/candidate_user_B')
        .set('Authorization', `Bearer ${tokenCandidateA}`)
        .send({ name: 'Hacked Name' });

      assert.strictEqual(idorRes.status, 403);
      assert.strictEqual(idorRes.body.success, false);
      assert.strictEqual(idorRes.body.error.code, 'FORBIDDEN');
    });
  });
});

