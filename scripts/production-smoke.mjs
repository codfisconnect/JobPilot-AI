#!/usr/bin/env node

/**
 * Production Smoke Test Suite for PilotMama / JobPilot AI
 * 
 * Verifies live production health, readiness, read-only APIs,
 * JWT authentication protection, and frontend SPA delivery without mutating data.
 */

const FRONTEND_URL = (process.env.SMOKE_FRONTEND_URL || 'https://pilotmama.in').replace(/\/+$/, '');
const BACKEND_URL = (process.env.SMOKE_BACKEND_URL || 'https://pilotmama-api-318878936821.asia-south1.run.app').replace(/\/+$/, '');
const TIMEOUT_MS = parseInt(process.env.SMOKE_TIMEOUT_MS || '10000', 10);

console.log('====================================================');
console.log('       PilotMama Production Smoke Test Suite        ');
console.log('====================================================');
console.log(`Target Frontend: ${FRONTEND_URL}`);
console.log(`Target Backend:  ${BACKEND_URL}`);
console.log(`Request Timeout: ${TIMEOUT_MS}ms\n`);

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    return res;
  } finally {
    clearTimeout(timeoutId);
  }
}

let passedCount = 0;
let failedCount = 0;
const results = [];

async function runCheck(name, fn) {
  process.stdout.write(`[TEST] ${name} ... `);
  const startTime = Date.now();
  try {
    await fn();
    const duration = Date.now() - startTime;
    console.log(`PASS (${duration}ms)`);
    passedCount++;
    results.push({ name, status: 'PASS', duration });
  } catch (err) {
    const duration = Date.now() - startTime;
    console.log(`FAIL (${duration}ms)`);
    console.error(`       Error: ${err.message}`);
    failedCount++;
    results.push({ name, status: 'FAIL', duration, error: err.message });
  }
}

async function main() {
  // Check 1: Backend Health
  await runCheck('Backend Health (/api/v1/health)', async () => {
    const res = await fetchWithTimeout(`${BACKEND_URL}/api/v1/health`);
    if (res.status !== 200) {
      throw new Error(`Expected HTTP 200, got ${res.status}`);
    }
    const json = await res.json();
    if (!json || json.success !== true) {
      throw new Error('Response success flag is not true');
    }
    const data = json.data;
    if (!data) throw new Error('Missing data field in response');
    if (data.status !== 'healthy') throw new Error(`Expected status "healthy", got "${data.status}"`);
    if (data.environment !== 'production') throw new Error(`Expected environment "production", got "${data.environment}"`);
    if (!data.database || data.database.connected !== true) throw new Error('Database is not connected');
    if (!data.storage || data.storage.status !== 'READY') throw new Error(`Storage status is not READY: ${data.storage?.status}`);
    if (data.storage.provider !== 'gcs') throw new Error(`Expected storage provider "gcs", got "${data.storage?.provider}"`);
  });

  // Check 2: Backend Readiness
  await runCheck('Backend Readiness (/api/v1/ready)', async () => {
    const res = await fetchWithTimeout(`${BACKEND_URL}/api/v1/ready`);
    if (res.status !== 200) {
      throw new Error(`Expected HTTP 200, got ${res.status}`);
    }
    const json = await res.json();
    if (!json || json.success !== true) {
      throw new Error('Response success flag is not true');
    }
    if (json.data?.status !== 'ready') {
      throw new Error(`Expected readiness status "ready", got "${json.data?.status}"`);
    }
  });

  // Check 3: Public Jobs API
  await runCheck('Public Jobs API (/api/v1/jobs)', async () => {
    const res = await fetchWithTimeout(`${BACKEND_URL}/api/v1/jobs`);
    if (res.status !== 200) {
      throw new Error(`Expected HTTP 200, got ${res.status}`);
    }
    const json = await res.json();
    if (!json || json.success !== true) {
      throw new Error('Response success flag is not true');
    }
    if (!Array.isArray(json.data)) {
      throw new Error('Expected data to be an array of jobs');
    }
  });

  // Check 4: Authentication Protection (/api/v1/auth/me without token)
  await runCheck('Authentication Guard (/api/v1/auth/me)', async () => {
    const res = await fetchWithTimeout(`${BACKEND_URL}/api/v1/auth/me`);
    if (res.status !== 401) {
      throw new Error(`Expected HTTP 401 for unauthenticated request, got ${res.status}`);
    }
    const json = await res.json().catch(() => ({}));
    if (json.success !== false) {
      throw new Error('Expected success: false for unauthenticated request');
    }
  });

  // Check 5: Frontend Root SPA
  await runCheck('Frontend Root Landing (https://pilotmama.in)', async () => {
    const res = await fetchWithTimeout(`${FRONTEND_URL}/`);
    if (res.status !== 200) {
      throw new Error(`Expected HTTP 200, got ${res.status}`);
    }
    const html = await res.text();
    if (!html.includes('<div id="root">') && !html.includes('id="root"')) {
      throw new Error('Expected HTML to contain Vite SPA mount root element: <div id="root"></div>');
    }
  });

  // Check 6: Frontend SPA Route Handling (/jobs)
  await runCheck('Frontend SPA Routing (https://pilotmama.in/jobs)', async () => {
    const res = await fetchWithTimeout(`${FRONTEND_URL}/jobs`);
    if (res.status !== 200) {
      throw new Error(`Expected HTTP 200, got ${res.status}`);
    }
    const html = await res.text();
    if (!html.includes('<div id="root">') && !html.includes('id="root"')) {
      throw new Error('Expected HTML to contain Vite SPA mount root element for /jobs route rewrite');
    }
  });

  console.log('\n====================================================');
  console.log(`Smoke Test Summary: ${passedCount} passed, ${failedCount} failed`);
  console.log('====================================================');

  if (failedCount > 0) {
    console.error('FAILED: One or more production smoke checks did not succeed.\n');
    process.exit(1);
  } else {
    console.log('SUCCESS: All production smoke checks passed cleanly!\n');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('\nFatal smoke test suite runner error:', err.message);
  process.exit(1);
});

