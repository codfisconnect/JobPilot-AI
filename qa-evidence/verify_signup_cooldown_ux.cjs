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

async function getLatestEmailOtp(email, purpose = 'SIGNUP') {
  const otpRecord = await prisma.emailOtp.findFirst({
    where: { email: email.toLowerCase(), purpose },
    orderBy: { createdAt: 'desc' }
  });
  return otpRecord?.metadata?.debugCode;
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runSignupCooldownUxVerification() {
  console.log('======================================================================');
  console.log('STARTING SIGNUP OTP COOLDOWN UX AND RESPONSIVENESS VERIFICATION');
  console.log('======================================================================');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,850']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 850 });

  const timestamp = Date.now();
  const newEmail = `cooldown_test_${timestamp}@pilotmama.local`;
  const existingVerifiedEmail = 'testuser@pilotmama.local';
  const testPassword = 'Password123!';
  const testFullName = 'Alex QA Tester';

  page.on('console', msg => {
    const text = msg.text();
    if (!text.includes('Download the React DevTools')) {
      console.log('  [Browser Console]:', text);
    }
  });

  try {
    // -------------------------------------------------------------
    // SCENARIO 1: Clean Initial Signup Form
    // -------------------------------------------------------------
    console.log('\n--- Scenario 1: Initial Signup Form Inspection ---');
    await page.goto('http://localhost:5173/register', { waitUntil: 'networkidle0' });
    await sleep(500);

    // Verify form elements exist
    const hasNameInput = await page.$('input#auth-fullName') !== null;
    const hasEmailInput = await page.$('input#auth-email') !== null;
    const hasPassInput = await page.$('input#auth-password') !== null;
    const hasSubmitBtn = await page.$('button[type="submit"]') !== null;

    console.log(`  Full Name input present: ${hasNameInput}`);
    console.log(`  Email input present: ${hasEmailInput}`);
    console.log(`  Password input present: ${hasPassInput}`);
    console.log(`  Create Account button present: ${hasSubmitBtn}`);

    if (!hasNameInput || !hasEmailInput || !hasPassInput || !hasSubmitBtn) {
      throw new Error('Initial signup form missing standard fields');
    }

    // Verify ABSOLUTELY NO cooldown text exists on the page
    const pageText = await page.evaluate(() => document.body.innerText);
    const hasCooldownText = pageText.toLowerCase().includes('before requesting a new code') ||
      pageText.toLowerCase().includes('please wait') ||
      pageText.toLowerCase().includes('resend in');

    console.log(`  Zero cooldown text on initial signup form: ${!hasCooldownText}`);
    if (hasCooldownText) {
      throw new Error('FAILED: Cooldown text detected on initial signup form!');
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01_initial_signup_form_clean.png') });
    console.log('  Saved screenshot: 01_initial_signup_form_clean.png');

    // -------------------------------------------------------------
    // SCENARIO 2: Submit New Registration -> Transition to OTP Screen
    // -------------------------------------------------------------
    console.log('\n--- Scenario 2: Brand New Registration -> Transition to OTP ---');
    await page.type('input#auth-fullName', testFullName);
    await page.type('input#auth-email', newEmail);
    await page.type('input#auth-password', testPassword);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02_signup_form_filled.png') });
    console.log('  Saved screenshot: 02_signup_form_filled.png');

    await page.click('button[type="submit"]');

    // Wait for transition to OTP screen
    await page.waitForFunction(() => {
      return document.querySelector('input.auth-otp-input') !== null ||
        document.body.innerText.includes('Verify Your Email') ||
        document.body.innerText.includes('Enter the 6-digit verification code');
    }, { timeout: 10000 });

    await sleep(500);

    // Verify OTP UI Elements
    const otpHeadline = await page.$eval('.auth-header h1, .auth-title', el => el.textContent.trim());
    const otpNotice = await page.$eval('.auth-subtitle, .auth-otp-notice', el => el.textContent.trim());
    const hasOtpInput = await page.$('input.auth-otp-input') !== null;
    const resendBtnText = await page.$eval('button.auth-link-btn', el => el.textContent.trim());
    const isResendDisabled = await page.$eval('button.auth-link-btn', el => el.disabled);

    console.log(`  OTP Screen Headline: "${otpHeadline}"`);
    console.log(`  OTP Notice: "${otpNotice}"`);
    console.log(`  6-digit OTP input present: ${hasOtpInput}`);
    console.log(`  Resend button label: "${resendBtnText}"`);
    console.log(`  Resend button disabled during cooldown: ${isResendDisabled}`);

    if (!isResendDisabled) {
      throw new Error('FAILED: Resend button should be disabled immediately after OTP dispatch');
    }
    if (!resendBtnText.includes('Resend in')) {
      throw new Error(`FAILED: Resend button should show cooldown countdown, got: ${resendBtnText}`);
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03_otp_screen_with_countdown.png') });
    console.log('  Saved screenshot: 03_otp_screen_with_countdown.png');

    // Test countdown ticking
    console.log('  Observing countdown tick for 3 seconds...');
    await sleep(3000);
    const updatedResendBtnText = await page.$eval('button.auth-link-btn', el => el.textContent.trim());
    console.log(`  Updated resend button label after 3s: "${updatedResendBtnText}"`);

    // -------------------------------------------------------------
    // SCENARIO 3: Back Button Returns to Signup Form cleanly
    // -------------------------------------------------------------
    console.log('\n--- Scenario 3: Back Button from OTP Screen ---');
    await page.click('button.auth-back-btn');
    await sleep(500);

    const backToFormText = await page.evaluate(() => document.body.innerText);
    const backHasCooldown = backToFormText.toLowerCase().includes('before requesting a new code') ||
      backToFormText.toLowerCase().includes('please wait');
    console.log(`  Returned to signup/signin form`);
    console.log(`  Signup form has zero cooldown error: ${!backHasCooldown}`);
    if (backHasCooldown) {
      throw new Error('FAILED: Cooldown error displayed after clicking Back');
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04_returned_to_form_no_cooldown.png') });
    console.log('  Saved screenshot: 04_returned_to_form_no_cooldown.png');

    // -------------------------------------------------------------
    // SCENARIO 4: Submitting Unverified Account with Active Cooldown
    // -------------------------------------------------------------
    console.log('\n--- Scenario 4: Submitting Unverified Account with Active Cooldown ---');
    // Ensure on Sign Up tab
    const signUpTab = await page.$('button.auth-tab:not(.active)');
    const tabs = await page.$$('button.auth-tab');
    for (const tab of tabs) {
      const text = await (await tab.getProperty('textContent')).jsonValue();
      if (text.includes('Sign Up')) {
        await tab.click();
        break;
      }
    }
    await sleep(300);

    // Re-fill form with the SAME unverified email (which is still in OTP cooldown)
    await page.type('input#auth-fullName', testFullName);
    await page.type('input#auth-email', newEmail);
    await page.type('input#auth-password', testPassword);
    await page.click('button[type="submit"]');

    // MUST NOT remain on signup form showing "Please wait X seconds before requesting a new code"
    await page.waitForFunction(() => {
      return document.querySelector('input.auth-otp-input') !== null;
    }, { timeout: 10000 });

    await sleep(500);
    const transitionedToOtp = await page.$('input.auth-otp-input') !== null;
    console.log(`  Smoothly transitioned to OTP screen without signup error: ${transitionedToOtp}`);

    const activeCooldownText = await page.$eval('button.auth-link-btn', el => el.textContent.trim());
    console.log(`  OTP screen shows active cooldown timer on resend button: "${activeCooldownText}"`);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05_unverified_account_seamless_otp.png') });
    console.log('  Saved screenshot: 05_unverified_account_seamless_otp.png');

    // -------------------------------------------------------------
    // SCENARIO 5: Existing Verified Account -> Conflict Notice with [Sign In] Link
    // -------------------------------------------------------------
    console.log('\n--- Scenario 5: Existing Verified Account Conflict Handling ---');
    // Click Back to form
    await page.click('button.auth-back-btn');
    await sleep(500);

    // Switch to Sign Up tab
    const tabs2 = await page.$$('button.auth-tab');
    for (const tab of tabs2) {
      const text = await (await tab.getProperty('textContent')).jsonValue();
      if (text.includes('Sign Up')) {
        await tab.click();
        break;
      }
    }
    await sleep(300);

    // Enter existing verified email
    await page.type('input#auth-fullName', 'Existing User');
    await page.type('input#auth-email', existingVerifiedEmail);
    await page.type('input#auth-password', testPassword);
    await page.click('button[type="submit"]');

    // Wait for conflict error banner
    await page.waitForSelector('.auth-error-banner', { timeout: 8000 });
    const errorBannerText = await page.$eval('.auth-error-banner', el => el.textContent.trim());
    console.log(`  Conflict error banner text: "${errorBannerText}"`);

    if (!errorBannerText.includes('An account already exists with this email. Please sign in.')) {
      throw new Error(`FAILED: Expected conflict error message, got: ${errorBannerText}`);
    }

    const hasSignInActionBtn = await page.$('.auth-error-action-btn') !== null;
    console.log(`  [Sign In] action button present in error banner: ${hasSignInActionBtn}`);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06_existing_verified_account_conflict.png') });
    console.log('  Saved screenshot: 06_existing_verified_account_conflict.png');

    // Click [Sign In] action button
    if (hasSignInActionBtn) {
      await page.click('.auth-error-action-btn');
      await sleep(500);
      const isLoginTabActive = await page.evaluate(() => {
        const activeTab = document.querySelector('.auth-tab.active');
        return activeTab?.textContent?.includes('Sign In');
      });
      console.log(`  Clicking [Sign In] switched directly to Sign In mode: ${isLoginTabActive}`);
      if (!isLoginTabActive) {
        throw new Error('FAILED: [Sign In] button did not switch to Sign In mode');
      }
    }

    // -------------------------------------------------------------
    // SCENARIO 6: Invalid OTP Submission
    // -------------------------------------------------------------
    console.log('\n--- Scenario 6: Invalid OTP Submission ---');
    // Switch back to Sign Up tab and submit unverified email to get back to OTP screen
    const tabs3 = await page.$$('button.auth-tab');
    for (const tab of tabs3) {
      const text = await (await tab.getProperty('textContent')).jsonValue();
      if (text.includes('Sign Up')) {
        await tab.click();
        break;
      }
    }
    await sleep(300);
    await page.type('input#auth-fullName', testFullName);
    await page.type('input#auth-email', newEmail);
    await page.type('input#auth-password', testPassword);
    await page.click('button[type="submit"]');

    await page.waitForSelector('input.auth-otp-input', { timeout: 10000 });
    await sleep(500);

    // Enter wrong OTP: 999999
    await page.type('input.auth-otp-input', '999999');
    await page.click('button.auth-submit-btn');

    await page.waitForSelector('.auth-error-banner', { timeout: 8000 });
    const invalidOtpError = await page.$eval('.auth-error-banner', el => el.textContent.trim());
    console.log(`  Invalid OTP error text: "${invalidOtpError}"`);

    if (!invalidOtpError.includes('Incorrect verification code. Please try again.')) {
      throw new Error(`FAILED: Expected incorrect code error, got: ${invalidOtpError}`);
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07_invalid_otp_error.png') });
    console.log('  Saved screenshot: 07_invalid_otp_error.png');

    // -------------------------------------------------------------
    // SCENARIO 7: Valid OTP Submission & Authoritative Authentication
    // -------------------------------------------------------------
    console.log('\n--- Scenario 7: Valid OTP Submission -> Dashboard ---');
    const validOtp = await getLatestEmailOtp(newEmail, 'SIGNUP');
    console.log(`  Retrieved valid OTP from DB for ${newEmail}: ${validOtp}`);

    if (!validOtp) {
      throw new Error(`FAILED: Could not find valid OTP for ${newEmail}`);
    }

    // Clear input and enter valid OTP
    await page.click('input.auth-otp-input', { clickCount: 3 });
    await page.keyboard.press('Backspace');
    await page.type('input.auth-otp-input', validOtp);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '08_valid_otp_entered.png') });
    console.log('  Saved screenshot: 08_valid_otp_entered.png');

    await page.click('button.auth-submit-btn');

    // Wait for redirect to dashboard
    await page.waitForFunction(() => {
      return window.location.pathname === '/dashboard' ||
        document.body.innerText.includes('Welcome back') ||
        document.body.innerText.includes('Active Pipeline');
    }, { timeout: 12000 });

    await sleep(1000);

    const currentUrl = page.url();
    const dashboardText = await page.evaluate(() => document.body.innerText);
    console.log(`  Redirected URL: ${currentUrl}`);
    console.log(`  Dashboard loaded: ${dashboardText.includes('Welcome back') || dashboardText.includes('Active Pipeline')}`);

    // Verify authenticated state
    const authStorage = await page.evaluate(() => localStorage.getItem('pilotmama_auth_user'));
    console.log(`  Stored Auth User: ${authStorage ? JSON.parse(authStorage).email : 'NONE'}`);

    if (!authStorage || JSON.parse(authStorage).email !== newEmail.toLowerCase()) {
      throw new Error('FAILED: Authenticated candidate session was not authoritatively persisted');
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '09_authenticated_dashboard.png') });
    console.log('  Saved screenshot: 09_authenticated_dashboard.png');

    // -------------------------------------------------------------
    // SCENARIO 8: Responsive Viewport Matrix
    // -------------------------------------------------------------
    console.log('\n--- Scenario 8: Mobile & Responsive Viewport Audits ---');
    const viewports = [
      { width: 320, height: 650, name: '320px_iphone_se' },
      { width: 375, height: 667, name: '375px_mobile' },
      { width: 390, height: 844, name: '390px_iphone_12_14' },
      { width: 414, height: 896, name: '414px_mobile_large' },
      { width: 768, height: 1024, name: '768px_tablet' },
      { width: 1024, height: 768, name: '1024px_laptop_sm' },
      { width: 1440, height: 900, name: '1440px_desktop' }
    ];

    // Log out first so we can view the signup and OTP screens on various viewports
    await page.evaluate(() => {
      localStorage.removeItem('pilotmama_auth_token');
      localStorage.removeItem('pilotmama_auth_user');
    });

    for (const vp of viewports) {
      await page.setViewport({ width: vp.width, height: vp.height });
      await page.goto('http://localhost:5173/register', { waitUntil: 'networkidle0' });
      await sleep(400);

      const metrics = await page.evaluate(() => {
        const body = document.body;
        const html = document.documentElement;
        return {
          hasHorizontalOverflow: html.scrollWidth > html.clientWidth,
          clientWidth: html.clientWidth,
          scrollWidth: html.scrollWidth,
          hasRegisterForm: document.querySelector('#register-form') !== null
        };
      });

      console.log(`  Viewport [${vp.name} (${vp.width}x${vp.height})]: overflow=${metrics.hasHorizontalOverflow}, scrollWidth=${metrics.scrollWidth}`);
      if (metrics.hasHorizontalOverflow) {
        console.warn(`    WARNING: Horizontal overflow at ${vp.width}px!`);
      }

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `10_responsive_${vp.name}.png`) });
    }

    console.log('\n======================================================================');
    console.log('ALL SIGNUP OTP COOLDOWN UX VERIFICATIONS COMPLETED SUCCESSFULLY!');
    console.log('======================================================================\n');

  } catch (error) {
    console.error('\n❌ VERIFICATION TEST FAILED:', error);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'ERROR_failure_state.png') });
    throw error;
  } finally {
    // Cleanup created test records
    await prisma.emailOtp.deleteMany({
      where: { email: { contains: 'cooldown_test_' } }
    }).catch(() => { });
    await prisma.user.deleteMany({
      where: { email: { contains: 'cooldown_test_' } }
    }).catch(() => { });
    await prisma.$disconnect();
    await browser.close();
  }
}

runSignupCooldownUxVerification()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));