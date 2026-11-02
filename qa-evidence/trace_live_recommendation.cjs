const puppeteer = require('../backend/node_modules/puppeteer-core');
const jwt = require('../backend/node_modules/jsonwebtoken');
const path = require('path');
const fs = require('fs');

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'pilotmama-super-secret-jwt-access-key-production-ready';
const JWT_ISSUER = 'pilot-mama-auth';

(async () => {
  let browser;
  try {
    console.log('=== STEP 1: Direct Controller / API Check via fetch ===');
    const tokenPayload = {
      userId: '09f01a50-02ea-4fa1-bf01-fa1f3c77c2e3',
      email: 'testuser@pilotmama.local',
      role: 'CANDIDATE'
    };

    const token = jwt.sign(tokenPayload, JWT_ACCESS_SECRET, {
      algorithm: 'HS256',
      expiresIn: '7d',
      jwtid: 'diagnostic-trace-token',
      issuer: JWT_ISSUER
    });

    const apiUrl = 'http://localhost:5000/api/v1/jobs/recommended?page=1&pageSize=12';
    const directRes = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const directJson = await directRes.json();
    console.log(`METHOD: GET`);
    console.log(`URL: ${apiUrl}`);
    console.log(`HTTP STATUS: ${directRes.status}`);
    console.log('RESPONSE JSON TOP-LEVEL KEYS:', Object.keys(directJson));
    console.log('RESPONSE JSON SHAPE:');
    console.log(JSON.stringify({
      success: directJson.success,
      status: directJson.status,
      dataIsArray: Array.isArray(directJson.data),
      dataLength: Array.isArray(directJson.data) ? directJson.data.length : null,
      pagination: directJson.pagination,
      hasProfileData: directJson.hasProfileData,
      profileState: directJson.profileState
    }, null, 2));

    console.log('\n=== STEP 2: Real Chrome Browser Trace via puppeteer-core ===');
    browser = await puppeteer.launch({
      executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    // Intercept and log network requests
    page.on('request', req => {
      const url = req.url();
      if (url.includes('/api/v1/jobs')) {
        console.log(`\n[BROWSER REQUEST] ${req.method()} ${url}`);
        const headers = req.headers();
        console.log(`[REQUEST HEADERS] Authorization present: ${Boolean(headers['authorization'])}`);
      }
    });

    page.on('response', async res => {
      const url = res.url();
      if (url.includes('/api/v1/jobs')) {
        console.log(`[BROWSER RESPONSE] ${res.status()} ${url}`);
        try {
          const body = await res.json();
          console.log(`[RESPONSE BODY SHAPE] Keys: ${Object.keys(body).join(', ')}`);
          if (Array.isArray(body.data)) {
            console.log(`[RESPONSE BODY] body.data length: ${body.data.length}`);
          }
          if (body.pagination) {
            console.log(`[RESPONSE BODY] pagination:`, JSON.stringify(body.pagination));
          }
          if (body.profileState) {
            console.log(`[RESPONSE BODY] profileState: ${body.profileState}`);
          }
        } catch (e) {
          // ignore
        }
      }
    });

    page.on('console', msg => {
      const text = msg.text();
      if (
        text.includes('RECOMMENDATION') ||
        text.includes('PARSED') ||
        text.includes('BEFORE MEMORY') ||
        text.includes('AFTER MEMORY') ||
        text.includes('RECOMMENDED STATE SET') ||
        text.includes('TAB SWITCH')
      ) {
        console.log(`[CLIENT CONSOLE] ${text}`);
      }
    });

    // Seed localStorage with user auth
    await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(({ token, tokenPayload }) => {
      localStorage.setItem('pilotmama_access_token', token);
      localStorage.setItem('jobpilot_auth_user', JSON.stringify({
        id: tokenPayload.userId,
        email: tokenPayload.email,
        role: tokenPayload.role,
        fullName: 'Syed Salman A'
      }));
    }, { token, tokenPayload });

    console.log('\nNavigating to http://localhost:5173/jobs ...');
    await page.goto('http://localhost:5173/jobs', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2000));

    const initialResultsText = await page.evaluate(() => {
      const countEl = document.querySelector('.results-count-text');
      const cards = document.querySelectorAll('.canonical-job-card');
      const emptyState = document.querySelector('.jobs-empty-state');
      const onboardingCard = document.querySelector('.jobs-onboarding-card');
      const cardDetails = Array.from(cards).map(c => {
        const titleEl = c.querySelector('.job-title-heading');
        const companyEl = c.querySelector('.job-company-name');
        const descEl = c.querySelector('.job-card-description-excerpt');
        const scoreBadge = c.querySelector('.recommendation-badge');
        const reasonEl = c.querySelector('.recommendation-reason-text');
        const applyBtn = c.querySelector('button.btn-primary');
        return {
          title: titleEl ? titleEl.innerText : null,
          company: companyEl ? companyEl.innerText : null,
          score: scoreBadge ? scoreBadge.innerText : null,
          reason: reasonEl ? reasonEl.innerText : null,
          excerpt: descEl ? descEl.innerText : null,
          hasApplyButton: Boolean(applyBtn)
        };
      });
      return {
        countText: countEl ? countEl.innerText : null,
        cardsRendered: cards.length,
        emptyStateVisible: Boolean(emptyState),
        onboardingVisible: Boolean(onboardingCard),
        sampleCards: cardDetails.slice(0, 3)
      };
    });

    console.log('\nINITIAL /jobs PAGE EVALUATION:');
    console.log(JSON.stringify(initialResultsText, null, 2));

    const evidenceDir = path.resolve(__dirname, 'screenshots');
    if (!fs.existsSync(evidenceDir)) fs.mkdirSync(evidenceDir, { recursive: true });

    await page.screenshot({ path: path.join(evidenceDir, 'verified_recommended_jobs.png'), fullPage: true });

    // Test Tab Switching: Click "All Jobs"
    console.log('\nClicking "All Jobs" tab...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('.jobs-tab-button'));
      const allJobsBtn = buttons.find(b => b.innerText.includes('All Jobs'));
      if (allJobsBtn) allJobsBtn.click();
    });
    await new Promise(r => setTimeout(r, 2000));

    const allJobsResultsText = await page.evaluate(() => {
      const countEl = document.querySelector('.results-count-text');
      const cards = document.querySelectorAll('.canonical-job-card');
      return {
        countText: countEl ? countEl.innerText : null,
        cardsRendered: cards.length
      };
    });
    console.log('\nALL JOBS TAB EVALUATION:');
    console.log(JSON.stringify(allJobsResultsText, null, 2));

    // Test Tab Switching: Switch back to "Recommended for You"
    console.log('\nClicking "Recommended for You" tab...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('.jobs-tab-button'));
      const recBtn = buttons.find(b => b.innerText.includes('Recommended for You'));
      if (recBtn) recBtn.click();
    });
    await new Promise(r => setTimeout(r, 2000));

    const backToRecResultsText = await page.evaluate(() => {
      const countEl = document.querySelector('.results-count-text');
      const cards = document.querySelectorAll('.canonical-job-card');
      return {
        countText: countEl ? countEl.innerText : null,
        cardsRendered: cards.length
      };
    });
    console.log('\nBACK TO RECOMMENDED TAB EVALUATION:');
    console.log(JSON.stringify(backToRecResultsText, null, 2));

    await page.screenshot({ path: path.join(evidenceDir, 'verified_back_to_recommended.png'), fullPage: true });

  } catch (err) {
    console.error('Trace error:', err);
  } finally {
    if (browser) await browser.close();
  }
})();
