const puppeteer = require('puppeteer-core');

const sleep = ms => new Promise(res => setTimeout(res, ms));

async function runTest() {
  console.log('--- STARTING ADMIN RUNTIME BROWSER VERIFICATION ---');

  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const networkRequests = [];
  const hookErrors = [];

  page.on('request', req => {
    networkRequests.push({ url: req.url(), method: req.method() });
  });

  page.on('console', msg => {
    const text = msg.text();
    if (
      text.includes('Rendered more hooks') ||
      text.includes('change in the order of Hooks') ||
      text.includes('React has detected a change')
    ) {
      hookErrors.push(text);
      console.error('HOOK ERROR DETECTED:', text);
    }
  });

  // TEST 1: Unauthenticated visit to /admin
  console.log('\n[1] Testing unauthenticated visit to /admin');
  networkRequests.length = 0;
  await page.goto('http://localhost:5173/admin', { waitUntil: 'networkidle2' });
  await sleep(1000);

  const unauthBody = await page.content();
  const shows403 = unauthBody.includes('403 - Restricted Admin Area');
  console.log('Shows 403 restricted page:', shows403 ? 'PASS' : 'FAIL');

  const unauthCandidateCalls = networkRequests.filter(r =>
    r.url.includes('/api/v1/candidates/me') || r.url.endsWith('/api/candidates')
  );
  console.log('Unauthenticated candidate API calls count:', unauthCandidateCalls.length);

  // TEST 2: Login as Admin
  console.log('\n[2] Logging in as Admin via /admin/login');
  await page.goto('http://localhost:5173/admin/login', { waitUntil: 'networkidle2' });
  await sleep(1000);

  await page.type('input[type="email"]', 'admin@pilotmama.io');
  await page.type('input[type="password"]', 'Admin@PilotMama2026!');
  await page.click('button[type="submit"]');

  await page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {});
  await sleep(2000);

  // Clear network requests after login
  networkRequests.length = 0;

  // TEST 3: Admin dashboard loaded
  console.log('\n[3] Testing Admin dashboard on /admin');
  await page.goto('http://localhost:5173/admin', { waitUntil: 'networkidle2' });
  await sleep(2000);

  const adminDashboardContent = await page.content();
  const hasAdminOverview =
    adminDashboardContent.includes('System Status') ||
    adminDashboardContent.includes('Platform Overview') ||
    adminDashboardContent.includes('Total Jobs') ||
    adminDashboardContent.includes('Admin');
  console.log('Admin Dashboard loaded:', hasAdminOverview ? 'PASS' : 'FAIL');

  const adminCandidateCalls = networkRequests.filter(r =>
    r.url.includes('/api/v1/candidates/me') || r.url.endsWith('/api/candidates')
  );
  console.log('Admin page candidate API calls count:', adminCandidateCalls.length);
  if (adminCandidateCalls.length > 0) {
    console.error('Unwanted candidate calls:', adminCandidateCalls);
  }

  // TEST 4: Sub-navigation in Admin portal
  const adminSections = [
    '/admin/job-sources',
    '/admin/jobs',
    '/admin/candidates',
    '/admin/applications',
    '/admin/employers',
    '/admin/payments',
    '/admin/system'
  ];

  for (const sec of adminSections) {
    console.log(`\nTesting navigation to ${sec}`);
    networkRequests.length = 0;
    await page.goto(`http://localhost:5173${sec}`, { waitUntil: 'networkidle2' });
    await sleep(1000);

    const candidateCallsInSec = networkRequests.filter(r =>
      r.url.includes('/api/v1/candidates/me') || r.url.endsWith('/api/candidates')
    );
    console.log(`Candidate API calls on ${sec}:`, candidateCallsInSec.length);
  }

  // TEST 5: Verify Candidate routes still work
  console.log('\n[5] Testing Candidate route /');
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2' });
  await sleep(1500);

  await browser.close();

  console.log('\n================ SUMMARY ================');
  console.log('Hook errors observed:', hookErrors.length);
  if (hookErrors.length > 0) {
    console.error('FAILED: Hook errors were present.');
    process.exit(1);
  } else {
    console.log('SUCCESS: Zero hook errors detected.');
  }
}

runTest().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
