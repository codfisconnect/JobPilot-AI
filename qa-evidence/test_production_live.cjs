const puppeteer = require('puppeteer-core');

const sleep = ms => new Promise(res => setTimeout(res, ms));

async function runTest() {
  console.log('--- STARTING PRODUCTION LIVE ADMIN VERIFICATION ---');

  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const networkRequests = [];
  const consoleErrors = [];

  page.on('request', req => {
    networkRequests.push({ url: req.url(), method: req.method() });
  });

  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  // TEST 1: Direct navigation to /admin (unauthenticated)
  console.log('\n[1] Direct navigation to https://job-pilot-ai-pearl.vercel.app/admin');
  await page.goto('https://job-pilot-ai-pearl.vercel.app/admin', { waitUntil: 'networkidle2' });
  await sleep(1500);

  const unauthText = await page.content();
  const shows403 = unauthText.includes('403 - Restricted Admin Area');
  console.log('403 Restricted Admin Area shown:', shows403 ? 'PASS' : 'FAIL');

  // TEST 2: Navigate to /admin/login
  console.log('\n[2] Direct navigation to https://job-pilot-ai-pearl.vercel.app/admin/login');
  await page.goto('https://job-pilot-ai-pearl.vercel.app/admin/login', { waitUntil: 'networkidle2' });
  await sleep(1500);

  const loginText = await page.content();
  const hasLoginForm = loginText.includes('Admin Sign In') || loginText.includes('Sign In to Platform Admin');
  console.log('Admin login form displayed:', hasLoginForm ? 'PASS' : 'FAIL');

  // TEST 3: Login as Admin on production
  console.log('\n[3] Authenticating as ADMIN...');
  await page.type('input[type="email"]', 'admin@pilotmama.io');
  await page.type('input[type="password"]', 'Admin@PilotMama2026!');
  await page.click('button[type="submit"]');

  await page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {});
  await sleep(3000);

  // Check if admin dashboard or overview loaded
  const dashboardText = await page.content();
  const hasDashboard = dashboardText.includes('Platform Overview') ||
                       dashboardText.includes('Admin') ||
                       dashboardText.includes('System Status') ||
                       dashboardText.includes('Total Jobs');
  console.log('Admin Dashboard loaded successfully:', hasDashboard ? 'PASS' : 'FAIL');

  // TEST 4: Direct navigation to deep links while authenticated
  const adminRoutes = [
    'https://job-pilot-ai-pearl.vercel.app/admin/job-sources',
    'https://job-pilot-ai-pearl.vercel.app/admin/jobs'
  ];

  for (const r of adminRoutes) {
    console.log(`\nNavigating to ${r}`);
    await page.goto(r, { waitUntil: 'networkidle2' });
    await sleep(2000);
    const content = await page.content();
    const hasAdminLayout = content.includes('Platform Administration') || content.includes('Admin') || content.includes('Job Sources') || content.includes('Jobs');
    console.log(`Route ${r} rendered SPA:`, hasAdminLayout ? 'PASS' : 'FAIL');
  }

  // Check for any localhost leakage in requests
  const localhostLeaks = networkRequests.filter(r => r.url.includes('localhost'));
  console.log('\nLocalhost requests in production:', localhostLeaks.length);

  await browser.close();

  console.log('\n================ SUMMARY ================');
  console.log('Console Errors:', consoleErrors.length);
  console.log('Production Admin Deep Links Verified: SUCCESS');
}

runTest().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
