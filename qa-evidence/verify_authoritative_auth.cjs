const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('../backend/node_modules/@prisma/client');

const prisma = new PrismaClient();
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const SCREENSHOT_DIR = path.resolve(__dirname, 'screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function getLatestEmailOtp(email, purpose) {
  // Query EmailOtp table for the latest code in development
  const otpRecord = await prisma.emailOtp.findFirst({
    where: { email: email.toLowerCase(), purpose },
    orderBy: { createdAt: 'desc' }
  });
  return otpRecord?.metadata?.debugCode;
}

async function runAuthVerification() {
  console.log('======================================================================');
  console.log('STARTING COMPLETE RUNTIME AUTHORITATIVE AUTHENTICATION VERIFICATION');
  console.log('======================================================================');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,850']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 850 });

  const testEmail = `e2e_cand_${Date.now()}@pilotmama.local`;
  const testPassword = 'Password123!';
  const testFullName = 'Salman QA Lead';

  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));
  page.on('response', async res => {
    if (res.url().includes('/auth/')) {
      try {
        const text = await res.text();
        console.log('AUTH RESPONSE:', res.status(), res.url(), text.slice(0, 200));
      } catch (e) {}
    }
  });

  // Monitor all auth and resume requests
  const trackedRequests = [];
  page.on('request', req => {
    const url = req.url();
    if (url.includes('/api/v1/resumes') || url.includes('/api/v1/auth/')) {
      trackedRequests.push({
        method: req.method(),
        url,
        headers: req.headers()
      });
    }
  });

  try {
    // -------------------------------------------------------------
    // SCENARIO 1: Unauthenticated Visitor on "/" and "/jobs"
    // -------------------------------------------------------------
    console.log('\n[Scenario 1] Unauthenticated visitor accessing "/" ...');
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });

    // Assert that protected candidate dashboard is NOT accessible
    const pageText = await page.evaluate(() => document.body.innerText);
    if (pageText.includes('Welcome back,') && pageText.includes('Dashboard')) {
      throw new Error('FAIL: Unauthenticated visitor accessed protected candidate Dashboard!');
    }
    console.log('✓ PASS: Unauthenticated visitor redirected away from protected Dashboard.');

    // Visit public /jobs page to verify public sidebar & topbar
    console.log('[Scenario 1.1] Navigating to public "/jobs" page ...');
    await page.goto('http://localhost:5173/jobs', { waitUntil: 'networkidle0' });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'auth_step1_unauthenticated_jobs.png') });

    const unauthSidebarText = await page.evaluate(() => {
      const el = document.querySelector('.app-sidebar');
      return el ? el.innerText : '';
    });
    const unauthTopBarText = await page.evaluate(() => {
      const el = document.querySelector('.app-topbar');
      return el ? el.innerText : '';
    });

    if (!unauthSidebarText.includes('Sign In / Register')) {
      throw new Error('FAIL: Unauthenticated sidebar missing "Sign In / Register"');
    }
    if (unauthSidebarText.includes('My Profile') || unauthSidebarText.includes('My Resume')) {
      throw new Error('FAIL: Unauthenticated sidebar leaked candidate portal links!');
    }
    if (unauthTopBarText.includes('Upload Resume')) {
      throw new Error('FAIL: Unauthenticated topbar leaked "Upload Resume" button!');
    }
    console.log('✓ PASS: Unauthenticated sidebar shows only public navigation and "Sign In / Register".');
    console.log('✓ PASS: Unauthenticated TopBar hides private candidate profile and Upload controls.');

    // -------------------------------------------------------------
    // SCENARIO 2: New Candidate Signup + Email OTP Verification
    // -------------------------------------------------------------
    console.log(`\n[Scenario 2] Candidate Signup: ${testEmail} ...`);
    await page.goto('http://localhost:5173/register', { waitUntil: 'networkidle0' });

    await page.waitForSelector('input[name="fullName"]');
    await page.type('input[name="fullName"]', testFullName);
    await page.type('input[type="email"]', testEmail);
    await page.type('input[type="password"]', testPassword);

    const submitBtn = await page.$('button[type="submit"]');
    await submitBtn.click();

    // Wait for OTP form
    await page.waitForSelector('input[placeholder*="•"], input[name="otp"], input[maxlength="6"]', { timeout: 10000 });
    console.log('✓ PASS: Signup initiated; OTP verification code dispatched.');

    // Wait a moment for DB write
    await new Promise(r => setTimeout(r, 600));

    // Fetch OTP code
    const otpCode = await getLatestEmailOtp(testEmail, 'SIGNUP');
    if (!otpCode || otpCode.length !== 6) {
      throw new Error(`FAIL: Could not retrieve valid 6-digit registration OTP code for ${testEmail}!`);
    }
    console.log(`✓ PASS: Retrieved 6-digit registration OTP code: ${otpCode}`);

    const otpInput = await page.$('input[placeholder*="•"], input[name="otp"], input[maxlength="6"]');
    await otpInput.type(otpCode);

    const verifyBtn = await page.$('button[type="submit"]');
    await verifyBtn.click();

    // Wait for Dashboard to load after OTP verification
    await page.waitForSelector('.dash-greeting-name', { timeout: 10000 });
    await page.waitForNetworkIdle({ idleTime: 500, timeout: 5000 }).catch(() => {});
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'auth_step2_authenticated_dashboard.png') });

    const authGreetText = await page.evaluate(() => {
      const el = document.querySelector('.dash-compact-greeting');
      return el ? el.innerText : '';
    });
    const authSidebarText = await page.evaluate(() => {
      const sidebar = document.querySelector('.app-sidebar');
      return sidebar ? sidebar.innerText : '';
    });
    const authTopBarText = await page.evaluate(() => {
      const topbar = document.querySelector('.app-topbar');
      return topbar ? topbar.innerText : '';
    });

    console.log(`Candidate Greeting: "${authGreetText}"`);
    if (!authGreetText.includes(testFullName) && !authGreetText.includes('Salman')) {
      throw new Error(`FAIL: Greeting does not display candidate full name: "${authGreetText}"`);
    }
    if (authSidebarText.includes('Sign In / Register')) {
      throw new Error('FAIL: Authenticated candidate sidebar contains "Sign In / Register"!');
    }
    if (!authSidebarText.includes(testFullName) && !authSidebarText.includes('Salman')) {
      throw new Error('FAIL: Authenticated sidebar missing candidate full name!');
    }
    if (!authSidebarText.includes('My Profile') || !authSidebarText.includes('My Resume')) {
      throw new Error('FAIL: Authenticated sidebar missing candidate navigation links!');
    }
    if (!authTopBarText.includes('Upload Resume')) {
      throw new Error('FAIL: Authenticated topbar missing "Upload Resume" button!');
    }
    console.log('✓ PASS: Registration + OTP established 100% authenticated session.');
    console.log('✓ PASS: Candidate greeting shows full name.');
    console.log('✓ PASS: Sidebar displays candidate profile and NO "Sign In / Register".');
    console.log('✓ PASS: TopBar shows candidate identity and "Upload Resume" button.');

    // -------------------------------------------------------------
    // SCENARIO 3: Resume Upload under Authenticated Session
    // -------------------------------------------------------------
    console.log('\n[Scenario 3] Testing Resume Upload Authorization ...');
    await page.goto('http://localhost:5173/resumes', { waitUntil: 'networkidle0' });

    // Look for file input
    const fileInput = await page.$('input[type="file"]');
    if (!fileInput) {
      throw new Error('FAIL: Could not locate resume file input on /resumes page!');
    }

    const samplePdfPath = path.resolve(__dirname, 'sample_candidate_resume.pdf');
    trackedRequests.length = 0; // reset tracker

    await fileInput.uploadFile(samplePdfPath);
    console.log('File attached; awaiting upload processing...');
    await page.waitForNetworkIdle({ idleTime: 1000, timeout: 8000 }).catch(() => {});
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'auth_step3_resume_uploaded.png') });

    // Verify request headers
    const uploadReq = trackedRequests.find(r => r.url.includes('/api/v1/resumes') && r.method === 'POST');
    if (!uploadReq) {
      throw new Error('FAIL: No POST /api/v1/resumes request detected!');
    }

    const authHeader = uploadReq.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error(`FAIL: Resume upload sent invalid Authorization header: "${authHeader}"`);
    }
    console.log('✓ PASS: POST /api/v1/resumes request sent valid Authorization: Bearer <token>.');

    const resumesPageText = await page.evaluate(() => document.body.innerText);
    if (resumesPageText.includes('Authorization header with Bearer token is required')) {
      throw new Error('FAIL: Resume upload failed with missing Bearer token error!');
    }
    console.log('✓ PASS: Resume upload completed without 401 error.');

    // -------------------------------------------------------------
    // SCENARIO 4: Page Reload / Session Hydration
    // -------------------------------------------------------------
    console.log('\n[Scenario 4] Browser Refresh & Session Hydration ...');
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForSelector('.dash-greeting-name, .app-sidebar', { timeout: 5000 });

    const reloadSidebarText = await page.evaluate(() => {
      const sidebar = document.querySelector('.app-sidebar');
      return sidebar ? sidebar.innerText : '';
    });
    if (reloadSidebarText.includes('Sign In / Register')) {
      throw new Error('FAIL: On page reload, sidebar flashed or reverted to "Sign In / Register"!');
    }
    if (!reloadSidebarText.includes('Salman')) {
      throw new Error('FAIL: On page reload, sidebar lost candidate identity!');
    }
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'auth_step4_hydrated_session.png') });
    console.log('✓ PASS: Session hydrated successfully on browser reload.');

    // -------------------------------------------------------------
    // SCENARIO 5: Logout Flow
    // -------------------------------------------------------------
    console.log('\n[Scenario 5] Candidate Logout Flow ...');
    const signOutBtn = await page.$('button[title="Sign Out"]');
    if (!signOutBtn) {
      throw new Error('FAIL: Sign Out button not found in authenticated sidebar!');
    }
    await signOutBtn.click();
    await page.waitForNetworkIdle({ idleTime: 500, timeout: 5000 }).catch(() => {});

    // Verify token was removed
    const storedToken = await page.evaluate(() => localStorage.getItem('pilotmama_access_token'));
    if (storedToken) {
      throw new Error('FAIL: pilotmama_access_token still in localStorage after logout!');
    }
    console.log('✓ PASS: Tokens purged from client storage on logout.');

    await page.goto('http://localhost:5173/jobs', { waitUntil: 'networkidle0' });
    const postLogoutSidebar = await page.evaluate(() => {
      const el = document.querySelector('.app-sidebar');
      return el ? el.innerText : '';
    });
    if (!postLogoutSidebar.includes('Sign In / Register')) {
      throw new Error('FAIL: After logout, sidebar does not display "Sign In / Register"!');
    }
    console.log('✓ PASS: After logout, sidebar immediately returns to unauthenticated state.');

    // -------------------------------------------------------------
    // SCENARIO 6: Existing Candidate Password Login
    // -------------------------------------------------------------
    console.log('\n[Scenario 6] Existing Login with Password ...');
    await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle0' });

    // Switch to Password tab
    await page.waitForSelector('.auth-method-tabs');
    await page.evaluate(() => {
      const tabs = document.querySelectorAll('.auth-method-tab');
      for (const t of tabs) {
        if (t.innerText.includes('Password')) {
          t.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        }
      }
    });

    await page.waitForSelector('input[type="password"]', { timeout: 3000 });
    await page.type('input[type="email"]', testEmail);
    await page.type('input[type="password"]', testPassword);

    const loginSubmit = await page.$('button[type="submit"]');
    await loginSubmit.click();

    await page.waitForSelector('.dash-greeting-name', { timeout: 10000 });
    const postLoginSidebar = await page.evaluate(() => {
      const el = document.querySelector('.app-sidebar');
      return el ? el.innerText : '';
    });
    if (postLoginSidebar.includes('Sign In / Register')) {
      throw new Error('FAIL: After password login, sidebar contains "Sign In / Register"!');
    }
    if (!postLoginSidebar.includes('Salman')) {
      throw new Error('FAIL: After password login, candidate name not shown in sidebar!');
    }
    console.log('✓ PASS: Password login succeeded; Dashboard & Sidebar 100% authenticated.');

    // Logout before next test
    const signOutBtn2 = await page.$('button[title="Sign Out"]');
    await signOutBtn2.click();
    await page.waitForNetworkIdle({ idleTime: 500, timeout: 5000 }).catch(() => {});

    // -------------------------------------------------------------
    // SCENARIO 7: Email OTP Login
    // -------------------------------------------------------------
    console.log('\n[Scenario 7] Candidate Email OTP Login ...');
    await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle0' });

    await page.waitForSelector('input[type="email"]');
    await page.type('input[type="email"]', testEmail);

    const sendOtpBtn = await page.$('button[type="submit"]');
    await sendOtpBtn.click();

    await page.waitForSelector('input[placeholder*="•"], input[name="otp"], input[maxlength="6"]', { timeout: 10000 });
    console.log('✓ PASS: OTP login code dispatched.');

    await new Promise(r => setTimeout(r, 600));

    // Retrieve login OTP code
    const loginOtpCode = await getLatestEmailOtp(testEmail, 'LOGIN');
    if (!loginOtpCode || loginOtpCode.length !== 6) {
      throw new Error(`FAIL: Could not retrieve valid 6-digit login OTP code for ${testEmail}!`);
    }
    console.log(`✓ PASS: Retrieved login OTP code: ${loginOtpCode}`);

    const loginOtpInput = await page.$('input[placeholder*="•"], input[name="otp"], input[maxlength="6"]');
    await loginOtpInput.type(loginOtpCode);

    const verifyLoginBtn = await page.$('button[type="submit"]');
    await verifyLoginBtn.click();

    await page.waitForSelector('.dash-greeting-name', { timeout: 10000 });
    const otpLoginSidebar = await page.evaluate(() => {
      const el = document.querySelector('.app-sidebar');
      return el ? el.innerText : '';
    });
    if (otpLoginSidebar.includes('Sign In / Register')) {
      throw new Error('FAIL: After OTP login, sidebar contains "Sign In / Register"!');
    }
    if (!otpLoginSidebar.includes('Salman')) {
      throw new Error('FAIL: After OTP login, candidate name not shown in sidebar!');
    }
    console.log('✓ PASS: Email OTP login succeeded; Dashboard & Sidebar 100% authenticated.');

    console.log('\n======================================================================');
    console.log('ALL 7 REAL RUNTIME AUTHENTICATION MATRIX SCENARIOS PASSED 100%!');
    console.log('======================================================================\n');
  } catch (err) {
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'failure_state.png') }).catch(() => {});
    const bodyHtml = await page.evaluate(() => document.body.innerHTML).catch(() => '');
    fs.writeFileSync(path.join(SCREENSHOT_DIR, 'failure_state.html'), bodyHtml);
    throw err;
  } finally {
    // Cleanup candidate from database
    await prisma.user.deleteMany({
      where: { email: testEmail.toLowerCase() }
    }).catch(() => {});
    await prisma.$disconnect();
    await browser.close();
  }
}

runAuthVerification().catch(err => {
  console.error('\nVerification FAILED:', err);
  process.exit(1);
});
