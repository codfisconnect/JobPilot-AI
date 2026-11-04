const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const SCREENSHOT_DIR = path.resolve(__dirname, 'screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function auditProductionRuntime() {
  console.log('======================================================================');
  console.log('STARTING REAL PRODUCTION RUNTIME AUDIT (VERCEL & RENDER)');
  console.log('======================================================================');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,850']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 850 });

  const networkLog = [];
  page.on('request', req => {
    networkLog.push({
      type: 'REQUEST',
      url: req.url(),
      method: req.method(),
      headers: req.headers(),
      postData: req.postData() ? '[PRESENT]' : '[NONE]'
    });
  });

  page.on('response', async res => {
    const url = res.url();
    if (url.includes('/api/') || url.includes('/auth/')) {
      let bodySnippet = '';
      try {
        const text = await res.text();
        // Sanitize: do not log tokens or sensitive data
        bodySnippet = text.replace(/"accessToken":"[^"]+"/g, '"accessToken":"[REDACTED]"')
                          .replace(/"refreshToken":"[^"]+"/g, '"refreshToken":"[REDACTED]"')
                          .slice(0, 300);
      } catch (e) {
        bodySnippet = `[Error reading response: ${e.message}]`;
      }
      networkLog.push({
        type: 'RESPONSE',
        url,
        status: res.status(),
        statusText: res.statusText(),
        body: bodySnippet
      });
      console.log(`  [PROD API RESPONSE] ${res.status()} ${req_method(url)} ${url} -> ${bodySnippet.slice(0, 150)}`);
    }
  });

  function req_method(url) {
    const found = networkLog.slice().reverse().find(n => n.type === 'REQUEST' && n.url === url);
    return found ? found.method : 'GET';
  }

  try {
    // -----------------------------------------------------------------
    // AUDIT 1: Inspect https://job-pilot-ai-pearl.vercel.app/settings
    // -----------------------------------------------------------------
    console.log('\n[Audit 1] Opening https://job-pilot-ai-pearl.vercel.app/settings ...');
    await page.goto('https://job-pilot-ai-pearl.vercel.app/settings', { waitUntil: 'networkidle0' });
    await sleep(1000);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'prod_audit_01_settings_page.png') });
    console.log('  Saved screenshot: prod_audit_01_settings_page.png');

    const settingsDom = await page.evaluate(() => {
      const sidebar = document.querySelector('.app-sidebar')?.innerText || '';
      const emailInputs = Array.from(document.querySelectorAll('input[type="email"], input[name="email"], input#email, input#account-email'))
        .map(i => ({ id: i.id, name: i.name, value: i.value, placeholder: i.placeholder, disabled: i.disabled, readOnly: i.readOnly }));
      const allInputs = Array.from(document.querySelectorAll('input')).map(i => ({ id: i.id, name: i.name, value: i.value, type: i.type }));
      const bodyText = document.body.innerText;
      return {
        sidebarHasSignInRegister: sidebar.includes('Sign In / Register'),
        sidebarSnippet: sidebar.slice(0, 200),
        emailInputs,
        allInputs,
        hasEmailInText: bodyText.includes('Email Address')
      };
    });

    console.log('  Sidebar shows "Sign In / Register":', settingsDom.sidebarHasSignInRegister);
    console.log('  Email inputs found on Settings:', JSON.stringify(settingsDom.emailInputs));
    console.log('  All inputs found on Settings:', JSON.stringify(settingsDom.allInputs));

    // -----------------------------------------------------------------
    // AUDIT 2: Inspect Initial Token & Candidate State on Production
    // -----------------------------------------------------------------
    console.log('\n[Audit 2] Checking production storage and environment ...');
    const storageState = await page.evaluate(() => {
      return {
        localStorageKeys: Object.keys(localStorage),
        hasAccessToken: Boolean(localStorage.getItem('pilotmama_access_token')),
        hasRefreshToken: Boolean(localStorage.getItem('pilotmama_refresh_token')),
        activeCandidateId: localStorage.getItem('jobpilot_active_candidate_id')
      };
    });
    console.log('  Storage State:', storageState);

    // -----------------------------------------------------------------
    // AUDIT 3: Attempt New User Signup on Production
    // -----------------------------------------------------------------
    console.log('\n[Audit 3] Navigating to Production Sign-up ...');
    const testSignupEmail = `prod_test_${Date.now()}@pilotmama.local`;
    const testPassword = 'Password123!';
    const testFullName = 'Production QA Audit';

    await page.goto('https://job-pilot-ai-pearl.vercel.app/login', { waitUntil: 'networkidle0' });
    await sleep(1000);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'prod_audit_02_auth_page.png') });
    console.log('  Saved screenshot: prod_audit_02_auth_page.png');

    const authPageDom = await page.evaluate(() => {
      return {
        bodyTextSnippet: document.body.innerText.slice(0, 300),
        inputs: Array.from(document.querySelectorAll('input')).map(i => ({ id: i.id, name: i.name, type: i.type })),
        buttons: Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim())
      };
    });
    console.log('  Auth page buttons:', authPageDom.buttons);
    console.log('  Auth page inputs:', authPageDom.inputs);

    // Look for Sign Up tab / switch
    const signUpBtn = await page.evaluateHandle(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.find(b => b.textContent.trim().toLowerCase().includes('sign up') || b.textContent.trim().toLowerCase() === 'create account');
    });

    if (signUpBtn && (await signUpBtn.asElement())) {
      console.log('  Clicking Sign Up tab/button...');
      await signUpBtn.asElement().click();
      await sleep(500);
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'prod_audit_03_signup_form.png') });
    console.log('  Saved screenshot: prod_audit_03_signup_form.png');

    // Fill signup inputs if available
    const hasName = await page.$('input#auth-fullName, input[name="fullName"], input#name') !== null;
    const hasEmail = await page.$('input#auth-email, input[name="email"], input[type="email"]') !== null;
    const hasPass = await page.$('input#auth-password, input[name="password"], input[type="password"]') !== null;

    console.log(`  Signup form fields: name=${hasName}, email=${hasEmail}, pass=${hasPass}`);

    if (hasName) await page.type('input#auth-fullName, input[name="fullName"], input#name', testFullName);
    if (hasEmail) await page.type('input#auth-email, input[name="email"], input[type="email"]', testSignupEmail);
    if (hasPass) await page.type('input#auth-password, input[name="password"], input[type="password"]', testPassword);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'prod_audit_04_signup_filled.png') });

    const submitBtn = await page.$('button[type="submit"]');
    if (submitBtn) {
      console.log('  Submitting production signup form...');
      await submitBtn.click();
      await sleep(3000);
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'prod_audit_05_after_signup_submit.png') });
    console.log('  Saved screenshot: prod_audit_05_after_signup_submit.png');

    const afterSubmitText = await page.evaluate(() => document.body.innerText);
    console.log('  After submit page text snippet:\n', afterSubmitText.slice(0, 400));

    // Check if OTP input appeared
    const hasOtpInput = await page.$('input.auth-otp-input, input[name="otp"], input[placeholder*="•"]') !== null;
    console.log('  Did OTP screen appear in browser?:', hasOtpInput);

    // Dump all backend requests captured
    console.log('\n--- ALL BACKEND REQUESTS CAPTURED ---');
    networkLog.filter(n => n.type === 'RESPONSE').forEach(r => {
      console.log(`  [${r.status}] ${r.url}`);
      console.log(`    Body: ${r.body.slice(0, 200)}`);
    });

  } catch (error) {
    console.error('Audit encountered error:', error);
  } finally {
    await browser.close();
  }
}

auditProductionRuntime().catch(console.error);
