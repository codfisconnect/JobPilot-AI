import { describe, it } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { app } from '../server.js';
import { prisma } from '../database/prisma.js';

describe('Sprint 1 Full Lifecycle: Register -> Login -> Refresh Rotation -> Replay Defense -> Logout -> Refresh Rejection', () => {

  const testEmail = `acceptance_${Date.now()}_${Math.random().toString(36).substring(2, 7)}@pilotmama.local`;
  const testPassword = 'PilotMama@Pass2026!';
  const testFullName = 'Acceptance Candidate';

  let currentAccessToken = '';
  let refreshCookie = '';
  let rotatedRefreshCookie = '';

  it('Step A: Register a unique candidate test user', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: testEmail,
        password: testPassword,
        fullName: testFullName
      });

    assert.strictEqual(res.status, 201, `Expected 201 Created, got ${res.status}`);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.user.email, testEmail.toLowerCase());
    assert.strictEqual(res.body.data.user.role, 'CANDIDATE');
    assert.strictEqual(res.body.data.user.passwordHash, undefined, 'passwordHash must never be returned');
    assert.strictEqual(res.body.data.user.candidateProfile?.fullName, testFullName);
    assert.ok(res.body.data.accessToken, 'Access token must be returned');

    // Verify Set-Cookie header contains pm_refresh_token
    const cookies = res.headers['set-cookie'];
    assert.ok(Array.isArray(cookies), 'set-cookie header array expected');
    const cookieHeader = cookies.find((c: string) => c.startsWith('pm_refresh_token='));
    assert.ok(cookieHeader, 'pm_refresh_token cookie must be set');
    assert.ok(cookieHeader.includes('Path=/api/v1/auth'), 'Cookie Path must be /api/v1/auth');
    assert.ok(cookieHeader.includes('HttpOnly'), 'Cookie must be HttpOnly');
  });

  it('Step B: Login with candidate credentials', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: testEmail,
        password: testPassword
      });

    assert.strictEqual(res.status, 200, `Expected 200 OK, got ${res.status}`);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.user.role, 'CANDIDATE');
    assert.strictEqual(res.body.data.user.passwordHash, undefined, 'passwordHash must never be returned');
    assert.ok(res.body.data.accessToken, 'Access token must be returned');

    currentAccessToken = res.body.data.accessToken;

    const cookies = res.headers['set-cookie'];
    assert.ok(Array.isArray(cookies), 'set-cookie header expected');
    const cookieHeader = cookies.find((c: string) => c.startsWith('pm_refresh_token='));
    assert.ok(cookieHeader, 'pm_refresh_token cookie must be present on login');
    assert.ok(cookieHeader.includes('Path=/api/v1/auth'), 'Path must be /api/v1/auth');
    assert.ok(cookieHeader.includes('HttpOnly'), 'Must be HttpOnly');

    // Extract cookie value for subsequent steps
    refreshCookie = cookieHeader.split(';')[0];
    assert.ok(refreshCookie.startsWith('pm_refresh_token='), 'Valid cookie format');
  });

  it('Step B.1: Verify /api/v1/auth/me works with access token', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${currentAccessToken}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.user.email, testEmail.toLowerCase());
    assert.strictEqual(res.body.data.user.role, 'CANDIDATE');
    assert.strictEqual(res.body.data.user.passwordHash, undefined);
  });

  it('Step C: Refresh using the refresh cookie (rotation test)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', refreshCookie);

    assert.strictEqual(res.status, 200, `Expected 200 OK on refresh, got ${res.status}`);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.data.accessToken, 'New access token must be returned');
    assert.notStrictEqual(res.body.data.accessToken, currentAccessToken, 'Access token must be fresh');

    currentAccessToken = res.body.data.accessToken;

    // Verify newly rotated cookie is issued
    const cookies = res.headers['set-cookie'];
    assert.ok(Array.isArray(cookies), 'set-cookie header expected on refresh');
    const cookieHeader = cookies.find((c: string) => c.startsWith('pm_refresh_token='));
    assert.ok(cookieHeader, 'Rotated pm_refresh_token cookie must be set');

    rotatedRefreshCookie = cookieHeader.split(';')[0];
    assert.notStrictEqual(rotatedRefreshCookie, refreshCookie, 'Refresh token must be rotated');
  });

  it('Step D: Replay protection - previously used refresh token must be rejected', async () => {
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', refreshCookie); // Replaying the first refresh token

    assert.strictEqual(res.status, 401, 'Replaying rotated refresh token must return 401');
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  it('Step E: Logout - invalidates refresh token and clears cookie', async () => {
    const res = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${currentAccessToken}`);

    assert.strictEqual(res.status, 200, `Expected 200 OK on logout, got ${res.status}`);
    assert.strictEqual(res.body.success, true);

    // Verify Set-Cookie clears the refresh cookie (Max-Age=0 or Expires in past)
    const cookies = res.headers['set-cookie'];
    assert.ok(Array.isArray(cookies), 'set-cookie header expected on logout');
    const cookieHeader = cookies.find((c: string) => c.startsWith('pm_refresh_token='));
    assert.ok(cookieHeader, 'pm_refresh_token clear cookie must be sent');
    assert.ok(
      cookieHeader.includes('Max-Age=0') || cookieHeader.includes('Expires=Thu, 01 Jan 1970'),
      'Cookie must be expired on logout'
    );
  });

  it('Step F: Refresh after logout must be rejected with 401', async () => {
    // Attempt refresh using rotated token that was active before logout
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', rotatedRefreshCookie);

    assert.strictEqual(res.status, 401, 'Refresh after logout must return 401 Unauthorized');
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  // Cleanup test user after acceptance run
  it('Cleanup: remove test user and profile from database', async () => {
    await prisma.user.deleteMany({
      where: { email: testEmail.toLowerCase() }
    });
  });
});
