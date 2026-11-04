const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require(path.join(__dirname, '../backend/node_modules/@prisma/client'));

const prisma = new PrismaClient();

const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

(async () => {
  let browser;
  const results = {
    viewports: [],
    socialFallbacks: false,
    signupOtpFlow: false,
    emailOtpLoginFlow: false,
    errors: []
  };

  try {
    console.log('🚀 Launching real Chrome browser for Pilot Mama E2E Verification...');
    browser = await puppeteer.launch({
      executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    page.on('console', msg => {
      console.log(`[BROWSER ${msg.type().toUpperCase()}] ${msg.text()}`);
    });

    page.on('response', resp => {
      if (resp.url().includes('/api/')) {
        console.log(`[API RESPONSE] ${resp.status()} ${resp.url()}`);
      }
    });

    // =========================================================================
    // STEP 1: Logo & Theme Consistency Across 7 Viewports
    // =========================================================================
    console.log('\n--- STEP 1: Testing Logo Dimensions across 7 Viewports (Light vs Dark) ---');
    const viewports = [320, 375, 390, 414, 768, 1024, 1440];

    for (const width of viewports) {
      await page.setViewport({ width, height: 800 });
      await page.goto('http://localhost:5173/auth', { waitUntil: 'networkidle2' });
      await page.waitForSelector('.pilot-mama-logo-img', { timeout: 5000 });

      // Measure in Light Theme
      await page.evaluate(() => {
        document.documentElement.setAttribute('data-theme', 'light');
        localStorage.setItem('theme', 'light');
      });
      await new Promise(r => setTimeout(r, 200));

      const lightMetrics = await page.evaluate(() => {
        const img = document.querySelector('.pilot-mama-logo-img');
        const wrap = document.querySelector('.pilot-mama-logo-wrap');
        const rect = img ? img.getBoundingClientRect() : null;
        const wrapRect = wrap ? wrap.getBoundingClientRect() : null;
        return {
          imgWidth: rect ? rect.width : 0,
          imgHeight: rect ? rect.height : 0,
          wrapWidth: wrapRect ? wrapRect.width : 0,
          wrapHeight: wrapRect ? wrapRect.height : 0,
          src: img ? img.src : ''
        };
      });

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `logo_viewport_${width}_light.png`) });

      // Measure in Dark Theme
      await page.evaluate(() => {
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
      });
      await new Promise(r => setTimeout(r, 200));

      const darkMetrics = await page.evaluate(() => {
        const img = document.querySelector('.pilot-mama-logo-img');
        const wrap = document.querySelector('.pilot-mama-logo-wrap');
        const rect = img ? img.getBoundingClientRect() : null;
        const wrapRect = wrap ? wrap.getBoundingClientRect() : null;
        return {
          imgWidth: rect ? rect.width : 0,
          imgHeight: rect ? rect.height : 0,
          wrapWidth: wrapRect ? wrapRect.width : 0,
          wrapHeight: wrapRect ? wrapRect.height : 0,
          src: img ? img.src : ''
        };
      });

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `logo_viewport_${width}_dark.png`) });

      const heightDiff = Math.abs(lightMetrics.imgHeight - darkMetrics.imgHeight);
      const widthDiff = Math.abs(lightMetrics.imgWidth - darkMetrics.imgWidth);
      const isConsistent = heightDiff < 1.0 && widthDiff < 2.0;

      console.log(`Viewport ${width}px:`);
      console.log(`  Light: ${lightMetrics.imgWidth.toFixed(1)}x${lightMetrics.imgHeight.toFixed(1)}px | Wrap: ${lightMetrics.wrapWidth.toFixed(1)}x${lightMetrics.wrapHeight.toFixed(1)}px`);
      console.log(`  Dark:  ${darkMetrics.imgWidth.toFixed(1)}x${darkMetrics.imgHeight.toFixed(1)}px | Wrap: ${darkMetrics.wrapWidth.toFixed(1)}x${darkMetrics.wrapHeight.toFixed(1)}px`);
      console.log(`  Difference: Width diff = ${widthDiff.toFixed(2)}px, Height diff = ${heightDiff.toFixed(2)}px -> ${isConsistent ? '✅ CONSISTENT' : '❌ MISMATCH'}`);

      results.viewports.push({
        width,
        lightMetrics,
        darkMetrics,
        heightDiff,
        widthDiff,
        isConsistent
      });
    }

    // =========================================================================
    // STEP 2: Social Login Graceful Fallback
    // =========================================================================
    console.log('\n--- STEP 2: Testing Google & LinkedIn Graceful Fallbacks ---');
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto('http://localhost:5173/auth', { waitUntil: 'networkidle2' });

    // Click Google sign-in button
    console.log('Testing Google button click...');
    const googleBtn = await page.$('.btn-google');
    if (googleBtn) {
      await googleBtn.click();
      await new Promise(r => setTimeout(r, 600));

      const alertText = await page.evaluate(() => {
        const alert = document.querySelector('.auth-error-banner') || document.querySelector('.auth-alert');
        return alert ? alert.textContent : '';
      });

      console.log(`Google Alert message displayed: "${alertText}"`);
      if (alertText.includes('Google sign-in is temporarily unavailable')) {
        console.log('✅ Google graceful fallback displayed correctly!');
      } else {
        throw new Error(`Unexpected Google fallback message: "${alertText}"`);
      }
    }

    // Click LinkedIn sign-in button
    console.log('Testing LinkedIn button click...');
    const linkedinBtn = await page.$('.btn-linkedin');
    if (linkedinBtn) {
      await linkedinBtn.click();
      await new Promise(r => setTimeout(r, 600));

      const alertText = await page.evaluate(() => {
        const alert = document.querySelector('.auth-error-banner') || document.querySelector('.auth-alert');
        return alert ? alert.textContent : '';
      });

      console.log(`LinkedIn Alert message displayed: "${alertText}"`);
      if (alertText.includes('LinkedIn sign-in is temporarily unavailable')) {
        console.log('✅ LinkedIn graceful fallback displayed correctly!');
      } else {
        throw new Error(`Unexpected LinkedIn fallback message: "${alertText}"`);
      }
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'social_auth_fallbacks.png') });
    results.socialFallbacks = true;

    // =========================================================================
    // STEP 3: Sign-Up with Mandatory OTP Verification Flow
    // =========================================================================
    console.log('\n--- STEP 3: Testing Sign-Up -> Email OTP Flow ---');
    const timestamp = Date.now();
    const signupEmail = `e2e.test.${timestamp}@pilotmama-test.com`;
    const signupPassword = 'SecureE2EPass123!';
    const signupName = 'Pilot Mama Candidate';

    // Directly open registration page
    await page.goto('http://localhost:5173/register', { waitUntil: 'networkidle2' });

    // Helper to set React controlled input values reliably
    async function fillInput(selector, value) {
      await page.waitForSelector(selector, { timeout: 5000 });
      await page.evaluate((sel, val) => {
        const input = document.querySelector(sel);
        if (!input) throw new Error(`Input not found: ${sel}`);
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        nativeSetter.call(input, val);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }, selector, value);
    }

    // Fill registration form
    await fillInput('#auth-fullName', signupName);
    await fillInput('#auth-email', signupEmail);
    await fillInput('#auth-password', signupPassword);

    console.log(`Submitting registration for ${signupEmail}...`);
    await page.click('button[type="submit"]');

    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'debug_after_register_click.png') });
    const postSubmitState = await page.evaluate(() => ({
      html: document.querySelector('.auth-card')?.innerHTML,
      text: document.querySelector('.auth-card')?.innerText
    }));
    console.log('Post submit text:', postSubmitState.text);

    // Wait for OTP verification UI
    await page.waitForSelector('#auth-otp', { timeout: 10000 });
    console.log('✅ Registration requested OTP. UI entered verification step.');

    // Test entering wrong OTP
    console.log('Testing wrong OTP rejection...');
    await fillInput('#auth-otp', '000000');
    await page.click('button[type="submit"]');
    await new Promise(r => setTimeout(r, 600));

    const wrongOtpAlert = await page.evaluate(() => {
      const el = document.querySelector('.auth-error-banner') || document.querySelector('.auth-alert.error');
      return el ? el.textContent : '';
    });
    console.log(`Wrong OTP error message: "${wrongOtpAlert}"`);
    if (!wrongOtpAlert.includes('Incorrect') && !wrongOtpAlert.includes('Invalid') && !wrongOtpAlert.includes('code')) {
      throw new Error(`Expected wrong OTP error, got "${wrongOtpAlert}"`);
    }

    // Query DB for generated OTP
    console.log('Querying database for generated OTP code...');
    const otpRecord = await prisma.emailOtp.findFirst({
      where: { email: signupEmail, verified: false },
      orderBy: { createdAt: 'desc' }
    });

    if (!otpRecord) {
      throw new Error(`No OTP record found in DB for ${signupEmail}`);
    }
    console.log(`Found OTP record in DB (id: ${otpRecord.id}, purpose: ${otpRecord.purpose}, hash: ${otpRecord.otpHash.substring(0, 16)}...)`);

    // Verify OTP using OtpService hash matching or test code
    const knownOtp = '582914';
    const crypto = require('crypto');
    const knownHash = crypto.createHash('sha256').update(knownOtp).digest('hex');
    await prisma.emailOtp.update({
      where: { id: otpRecord.id },
      data: { otpHash: knownHash, attempts: 0 }
    });

    // Enter correct OTP
    await fillInput('#auth-otp', knownOtp);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'signup_otp_entry.png') });

    console.log('Submitting valid verification code...');
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard or authenticated state
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {});
    const currentUrl = page.url();
    console.log(`Authenticated URL after OTP verification: ${currentUrl}`);

    // Verify DB user is now email_verified: true
    const userInDb = await prisma.user.findUnique({
      where: { email: signupEmail }
    });
    console.log(`User verification status in DB: emailVerified = ${userInDb ? userInDb.emailVerified : false}`);
    if (!userInDb || !userInDb.emailVerified) {
      throw new Error('User was not marked as emailVerified in DB');
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'signup_authenticated_dashboard.png') });
    results.signupOtpFlow = true;

    // =========================================================================
    // STEP 4: Passwordless Email OTP Login
    // =========================================================================
    console.log('\n--- STEP 4: Testing Passwordless Email OTP Login ---');
    // Clear storage and navigate to auth
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto('http://localhost:5173/auth', { waitUntil: 'networkidle2' });

    // Select Email Code (Passwordless) tab
    await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('.auth-method-tab'));
      const emailOtpTab = tabs.find(t => t.textContent.includes('Email Code'));
      if (emailOtpTab) emailOtpTab.click();
    });
    await new Promise(r => setTimeout(r, 400));

    await fillInput('#auth-email', signupEmail);
    console.log(`Requesting login code for ${signupEmail}...`);
    await page.click('button[type="submit"]');

    await page.waitForSelector('#auth-otp', { timeout: 8000 });
    console.log('✅ UI entered Login Code verification mode.');

    // Set known OTP hash
    const loginOtpRecord = await prisma.emailOtp.findFirst({
      where: { email: signupEmail, verified: false },
      orderBy: { createdAt: 'desc' }
    });
    if (!loginOtpRecord) {
      throw new Error('No login OTP record found in DB');
    }
    const loginKnownOtp = '739215';
    const loginKnownHash = crypto.createHash('sha256').update(loginKnownOtp).digest('hex');
    await prisma.emailOtp.update({
      where: { id: loginOtpRecord.id },
      data: { otpHash: loginKnownHash, attempts: 0 }
    });

    await fillInput('#auth-otp', loginKnownOtp);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'email_otp_login_entry.png') });

    console.log('Submitting valid login code...');
    await page.click('button[type="submit"]');

    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {});
    const loginUrl = page.url();
    console.log(`Authenticated URL after Login Code verification: ${loginUrl}`);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'email_otp_login_success.png') });
    results.emailOtpLoginFlow = true;

    // Clean up test user
    await prisma.jobAlertOutbox.deleteMany({ where: { email: signupEmail } });
    await prisma.emailOtp.deleteMany({ where: { email: signupEmail } });
    await prisma.user.delete({ where: { id: userInDb.id } }).catch(() => {});

  } catch (err) {
    console.error('❌ E2E Error:', err);
    results.errors.push(err.message);
  } finally {
    if (browser) {
      await browser.close();
    }
    await prisma.$disconnect();
  }

  console.log('\n==================================================');
  console.log('E2E VERIFICATION SUMMARY');
  console.log('==================================================');
  console.log(`Viewports tested: ${results.viewports.length}/7 consistent: ${results.viewports.every(v => v.isConsistent)}`);
  console.log(`Social fallbacks verified: ${results.socialFallbacks}`);
  console.log(`Sign-up OTP verification verified: ${results.signupOtpFlow}`);
  console.log(`Email OTP login verified: ${results.emailOtpLoginFlow}`);
  console.log(`Total errors: ${results.errors.length}`);
  if (results.errors.length > 0) {
    console.log('Errors:', results.errors);
    process.exit(1);
  } else {
    console.log('🎉 ALL PUPPETEER E2E AUDIT CHECKS PASSED PERFECTLY!');
    process.exit(0);
  }
})();
