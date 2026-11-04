const puppeteer = require('../backend/node_modules/puppeteer-core');
const fs = require('fs');
const path = require('path');
const jwt = require('../backend/node_modules/jsonwebtoken');

(async () => {
  let browser;
  try {
    const JWT_SECRET = process.env.JWT_SECRET || 'jobpilot-dev-jwt-secret-do-not-use-in-production-change-in-env';
    const testUser = {
      id: '09f01a50-02ea-4fa1-bf01-fa1f3c77c2e3',
      email: 'testuser@pilotmama.local',
      role: 'CANDIDATE',
      fullName: 'Syed Salman A'
    };
    const token = jwt.sign(testUser, JWT_SECRET, { expiresIn: '7d' });

    browser = await puppeteer.launch({
      executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    page.on('console', msg => {
      const text = msg.text();
      if (!text.includes('Failed to load resource') && !text.includes('favicon')) {
        console.log(`[BROWSER ${msg.type().toUpperCase()}] ${text}`);
      }
    });

    console.log('--- Step 1: Navigating to http://localhost:5173/jobs ---');
    await page.goto('http://localhost:5173/jobs', { waitUntil: 'networkidle2', timeout: 30000 });

    // Set localStorage credentials
    await page.evaluate(({ token, testUser }) => {
      localStorage.setItem('auth_token', token);
      localStorage.setItem('auth_user', JSON.stringify(testUser));
      localStorage.setItem('jobpilot_auth', JSON.stringify({ token, user: testUser }));
      localStorage.setItem('pilotmama_auth_token', token);
    }, { token, testUser });

    // Click "All Jobs" tab
    console.log('--- Step 2: Clicking "All Jobs" tab ---');
    await page.evaluate(() => {
      const allJobsTab = Array.from(document.querySelectorAll('.jobs-tab-button'))
        .find(b => b.innerText.includes('All Jobs'));
      if (allJobsTab) allJobsTab.click();
    });

    await page.waitForSelector('.canonical-job-card', { timeout: 20000 });
    console.log('Jobs loaded successfully in "All Jobs" view.');

    // Helper function to step through Application Agent for any job
    async function testJobApplicationHandoff(companyFilter, jobKeyword) {
      console.log(`\n==================================================`);
      console.log(`TESTING TARGET HANDOFF: ${companyFilter} (${jobKeyword})`);
      console.log(`==================================================`);

      // Search for company in the search input
      await page.evaluate((comp) => {
        const input = document.querySelector('.search-input');
        if (input) {
          input.value = comp;
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }, companyFilter);
      await new Promise(r => setTimeout(r, 2000));

      // Find job card and click its Apply button directly
      const found = await page.evaluate(({ companyFilter, jobKeyword }) => {
        const cards = Array.from(document.querySelectorAll('.canonical-job-card'));
        for (const card of cards) {
          const title = card.querySelector('.job-title-heading')?.innerText || '';
          const company = card.querySelector('.job-company-name')?.innerText || '';
          const applyBtn = Array.from(card.querySelectorAll('button')).find(b => 
            b.innerText.toLowerCase().includes('apply')
          );
          if (applyBtn) {
            applyBtn.click();
            return { found: true, title, company };
          }
        }
        return { found: false };
      }, { companyFilter, jobKeyword });

      console.log('Triggered Application Modal for Card:', found);
      await new Promise(r => setTimeout(r, 2500));

      // Mock window.open to intercept destination URL
      await page.evaluate(() => {
        window.lastOpenedUrl = null;
        window.open = function(url) {
          window.lastOpenedUrl = url;
          console.log('INTERCEPTED window.open URL:', url);
          return { closed: false, focus: () => {} };
        };
      });

      // Step 1: Click "Continue to Resume Selection"
      console.log('Step 1: Navigating from Readiness to Resume Selection...');
      const step1Clicked = await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => 
          b.innerText.includes('Continue to Resume Selection')
        );
        if (btn) {
          btn.click();
          return true;
        }
        return false;
      });
      console.log('Step 1 Advance result:', step1Clicked);
      await new Promise(r => setTimeout(r, 1500));

      // Step 2: Click "Continue to Application Form"
      console.log('Step 2: Navigating from Resume Selection to Application Form...');
      const step2Clicked = await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => 
          b.innerText.includes('Continue to Application Form')
        );
        if (btn) {
          btn.click();
          return true;
        }
        return false;
      });
      console.log('Step 2 Advance result:', step2Clicked);
      await new Promise(r => setTimeout(r, 1500));

      // Step 3: Click "Continue to Confirmation Gate"
      console.log('Step 3: Navigating from Application Form to Confirmation Gate...');
      const step3Clicked = await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => 
          b.innerText.includes('Continue to Confirmation Gate')
        );
        if (btn) {
          btn.click();
          return true;
        }
        return false;
      });
      console.log('Step 3 Advance result:', step3Clicked);
      await new Promise(r => setTimeout(r, 2000));

      // Step 4: Evaluate Confirmation Gate and Final CTA Button
      console.log('Step 4: Evaluating Confirmation Gate State...');
      const step4State = await page.evaluate(() => {
        const ctaBtn = Array.from(document.querySelectorAll('.modal-actions-bar button, .action-right-group button')).find(b => 
          b.innerText.includes('Continue to Employer Application') || 
          b.innerText.includes('Open Employer Careers Page') ||
          b.innerText.includes('Submit Application')
        );
        const targetContainer = document.querySelector('.summary-row .row-val')?.innerText || '';
        return {
          ctaLabel: ctaBtn ? ctaBtn.innerText.trim() : 'BUTTON NOT FOUND',
          ctaDisabled: ctaBtn ? ctaBtn.disabled : true,
          targetContainerText: targetContainer
        };
      });
      console.log('Step 4 Gate State:', step4State);

      // Click the final CTA button
      console.log('Clicking Final External Handoff CTA Button...');
      await page.evaluate(() => {
        const ctaBtn = Array.from(document.querySelectorAll('.modal-actions-bar button, .action-right-group button')).find(b => 
          b.innerText.includes('Continue to Employer Application') || 
          b.innerText.includes('Open Employer Careers Page')
        );
        if (ctaBtn) ctaBtn.click();
      });
      await new Promise(r => setTimeout(r, 2000));

      const interceptedUrl = await page.evaluate(() => window.lastOpenedUrl);
      console.log(`>>> INTERCEPTED DESTINATION URL for ${companyFilter}:`, interceptedUrl);
      return { ...found, ...step4State, interceptedUrl };
    }

    // A. TEST BAHWAN CYBERTEK
    const bahwanResult = await testJobApplicationHandoff('Bahwan', 'SAP GRC Lead');
    const bahwanExactHash = bahwanResult.interceptedUrl && bahwanResult.interceptedUrl.includes('#detail/job/');
    console.log(`\n========================================`);
    console.log(`A. BAHWAN VERIFICATION RESULT: ${bahwanExactHash ? 'PASS' : 'FAIL'}`);
    console.log(`   - Pre-click CTA Label: "${bahwanResult.ctaLabel}"`);
    console.log(`   - Intercepted URL: ${bahwanResult.interceptedUrl}`);
    console.log(`   - Preserved #detail/job/: ${bahwanExactHash}`);
    console.log(`========================================\n`);

    // Reload jobs page for next test
    await page.goto('http://localhost:5173/jobs', { waitUntil: 'networkidle2', timeout: 30000 });
    await page.evaluate(() => {
      const allJobsTab = Array.from(document.querySelectorAll('.jobs-tab-button'))
        .find(b => b.innerText.includes('All Jobs'));
      if (allJobsTab) allJobsTab.click();
    });
    await page.waitForSelector('.canonical-job-card', { timeout: 20000 });

    // B. TEST SYNECHRON WORKDAY
    const synechronResult = await testJobApplicationHandoff('Synechron', 'Lead ServiceNow');
    const synechronWorkday = synechronResult.interceptedUrl && 
      (synechronResult.interceptedUrl.includes('myworkdayjobs.com') || synechronResult.interceptedUrl.includes('synechron'));
    console.log(`\n========================================`);
    console.log(`B. SYNECHRON VERIFICATION RESULT: ${synechronWorkday ? 'PASS' : 'FAIL'}`);
    console.log(`   - Pre-click CTA Label: "${synechronResult.ctaLabel}"`);
    console.log(`   - Intercepted URL: ${synechronResult.interceptedUrl}`);
    console.log(`   - Workday requisition preserved: ${synechronWorkday}`);
    console.log(`========================================\n`);

    console.log('\n=== LIVE BROWSER VERIFICATION COMPLETE ===');

  } catch (err) {
    console.error('Puppeteer verification failed:', err);
  } finally {
    if (browser) await browser.close();
  }
})();
