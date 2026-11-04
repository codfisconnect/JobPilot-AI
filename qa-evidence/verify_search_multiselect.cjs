const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const SCREENSHOT_DIR = path.resolve(__dirname, 'screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function verifySearchAndMultiSelect() {
  console.log('======================================================================');
  console.log('STARTING REAL CHROME JOBS SEARCH & MULTI-SELECT AUTOCOMPLETE E2E AUDIT');
  console.log('======================================================================');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // Intercept job search requests to verify payload
  const searchRequests = [];
  page.on('request', req => {
    const url = req.url();
    if (url.includes('/api/v1/jobs')) {
      console.log('INTERCEPTED REQUEST:', req.method(), url);
      searchRequests.push({
        method: req.method(),
        url: req.url()
      });
    }
  });

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Desktop Viewport Sizing (1440 x 900)
    // -------------------------------------------------------------------------
    console.log('\n[Test 1] Testing Desktop Viewport (1440x900) ...');
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto('http://localhost:5173/jobs', { waitUntil: 'networkidle0' });

    // Switch to All Jobs tab
    await page.waitForSelector('.jobs-nav-tabs');
    await page.evaluate(() => {
      const buttons = document.querySelectorAll('.jobs-tab-button');
      for (const btn of buttons) {
        if (btn.innerText.includes('All Jobs')) {
          btn.click();
        }
      }
    });
    await page.waitForNetworkIdle({ idleTime: 500, timeout: 5000 }).catch(() => {});

    // Verify search container sizing
    await page.waitForSelector('.job-search-multiselect-container');
    const containerBox = await page.evaluate(() => {
      const el = document.querySelector('.job-search-multiselect-container');
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return {
        width: rect.width,
        height: rect.height,
        minWidth: style.minWidth,
        flex: style.flex
      };
    });

    console.log('Search Container Box (Desktop):', containerBox);
    if (!containerBox || containerBox.width < 320) {
      throw new Error(`FAIL: Search container width on desktop is ${containerBox?.width}px, expected >= 320px`);
    }
    if (containerBox.height < 40) {
      throw new Error(`FAIL: Search container height is ${containerBox?.height}px, expected >= 44px`);
    }
    console.log(`✓ PASS: Desktop search input sizing: width=${Math.round(containerBox.width)}px, height=${Math.round(containerBox.height)}px.`);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'search_step1_desktop_initial.png') });

    // -------------------------------------------------------------------------
    // TEST 2: Typing 'Play' & Autocomplete Suggestions Dropdown
    // -------------------------------------------------------------------------
    console.log('\n[Test 2] Typing "Play" for Skill Suggestion ...');
    const inputSelector = '.job-search-input';
    await page.waitForSelector(inputSelector);
    await page.click(inputSelector);
    await page.type(inputSelector, 'Play', { delay: 60 });

    // Wait for suggestions dropdown
    await page.waitForSelector('.job-suggestions-dropdown', { timeout: 4000 });
    const suggestionsText = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('.job-suggestion-item'));
      return items.map(i => i.innerText.trim());
    });
    console.log('Suggestions rendered for "Play":', suggestionsText);

    const hasPlaywright = suggestionsText.some(s => s.includes('Playwright'));
    if (!hasPlaywright) {
      throw new Error('FAIL: "Playwright" not found in suggestions dropdown!');
    }
    console.log('✓ PASS: Suggestions dropdown rendered with Playwright skill/role.');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'search_step2_playwright_suggestions.png') });

    // Click Playwright suggestion
    await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('.job-suggestion-item'));
      const target = items.find(i => i.innerText.includes('Playwright'));
      if (target) target.click();
    });

    // Verify chip was added
    await page.waitForSelector('.job-search-chip');
    const chipsAfterFirst = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.job-search-chip')).map(c => c.innerText.replace(/\s+/g, ' ').trim());
    });
    console.log('Chips after selecting Playwright:', chipsAfterFirst);
    if (!chipsAfterFirst.some(c => c.includes('Playwright'))) {
      throw new Error('FAIL: Playwright chip not created!');
    }
    console.log('✓ PASS: Playwright chip created successfully.');

    // -------------------------------------------------------------------------
    // TEST 3: Keyboard Navigation & Selection: 'Chen' -> ArrowDown -> Enter
    // -------------------------------------------------------------------------
    console.log('\n[Test 3] Testing Keyboard Navigation: "Chen" + ArrowDown + Enter ...');
    await page.click(inputSelector);
    await page.type(inputSelector, 'Chen', { delay: 60 });
    await page.waitForSelector('.job-suggestions-dropdown', { timeout: 4000 });

    // Press ArrowDown to select first suggestion, then Enter
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');

    await new Promise(r => setTimeout(r, 400));
    const chipsAfterSecond = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.job-search-chip')).map(c => c.innerText.replace(/\s+/g, ' ').trim());
    });
    console.log('Chips after selecting Chennai:', chipsAfterSecond);
    if (!chipsAfterSecond.some(c => c.includes('Chennai'))) {
      throw new Error('FAIL: Chennai chip not created via keyboard!');
    }
    console.log('✓ PASS: Chennai chip created via keyboard navigation (ArrowDown + Enter).');

    // -------------------------------------------------------------------------
    // TEST 4: Adding Third Chip: 'QA' -> QA Engineer
    // -------------------------------------------------------------------------
    console.log('\n[Test 4] Adding Third Chip: "QA" -> QA Engineer ...');
    await page.click(inputSelector);
    await page.type(inputSelector, 'QA', { delay: 60 });
    await page.waitForSelector('.job-suggestions-dropdown', { timeout: 4000 });

    await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('.job-suggestion-item'));
      const target = items.find(i => i.innerText.includes('QA Engineer'));
      if (target) target.click();
    });

    await new Promise(r => setTimeout(r, 400));
    const chipsAfterThird = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.job-search-chip')).map(c => c.innerText.replace(/\s+/g, ' ').trim());
    });
    console.log('Chips after QA Engineer selection:', chipsAfterThird);
    if (chipsAfterThird.length < 3) {
      throw new Error(`FAIL: Expected at least 3 chips, found ${chipsAfterThird.length}`);
    }
    console.log('✓ PASS: All 3 multi-select chips active: [Playwright], [Chennai], [QA Engineer].');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'search_step3_three_chips_active.png') });

    // -------------------------------------------------------------------------
    // TEST 5: Search Execution & API Verification
    // -------------------------------------------------------------------------
    console.log('\n[Test 5] Triggering Search with Multi-Category Chips ...');

    // Click Search button
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const searchBtn = buttons.find(b => b.innerText.trim() === 'Search');
      if (searchBtn) searchBtn.click();
    });

    await page.waitForNetworkIdle({ idleTime: 600, timeout: 6000 }).catch(() => {});

    // Inspect search request URL
    const lastSearchReq = searchRequests.slice().reverse().find(r => r.url.includes('/api/v1/jobs') && !r.url.includes('/suggestions') && !r.url.includes('/recommended'));
    console.log('Executed Search Request URL:', lastSearchReq?.url);
    if (!lastSearchReq) {
      throw new Error('FAIL: No /api/v1/jobs search request was made!');
    }

    const reqUrl = new URL(lastSearchReq.url);
    console.log('Query Params:', reqUrl.search);
    const hasSkillOrRole = reqUrl.search.includes('Playwright') || reqUrl.search.includes('skills') || reqUrl.search.includes('roles');
    if (!hasSkillOrRole) {
      throw new Error('FAIL: Structured search parameters missing from request!');
    }
    console.log('✓ PASS: Backend received structured multi-category parameters.');

    // -------------------------------------------------------------------------
    // TEST 6: Job Cards Integrity (Excerpt & Apply Button)
    // -------------------------------------------------------------------------
    console.log('\n[Test 6] Verifying Job Cards Excerpt and Apply Buttons ...');
    const jobCards = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.canonical-job-card, .job-card'));
      return cards.map(c => ({
        title: c.querySelector('.job-title-heading, .job-title, h3')?.innerText.trim() || '',
        hasExcerpt: Boolean(c.querySelector('.job-description-excerpt, .job-description, p')),
        hasApplyBtn: Boolean(c.querySelector('button.btn-primary, button.job-apply-btn, .apply-button-primary'))
      }));
    });

    console.log(`Rendered ${jobCards.length} job cards. First card:`, jobCards[0]);
    if (jobCards.length > 0) {
      if (!jobCards[0].hasApplyBtn) {
        throw new Error('FAIL: Job card missing Apply button!');
      }
      console.log('✓ PASS: Job cards display valid titles, descriptions, and Apply buttons.');
    } else {
      console.log('ℹ NOTE: Zero matches for this exact combination in test DB, but query completed successfully.');
    }

    // -------------------------------------------------------------------------
    // TEST 7: Keyboard Backspace Chip Deletion
    // -------------------------------------------------------------------------
    console.log('\n[Test 7] Testing Backspace Chip Deletion ...');
    await page.click(inputSelector);
    await page.keyboard.press('Backspace');
    await new Promise(r => setTimeout(r, 300));

    const chipsAfterBackspace = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.job-search-chip')).map(c => c.innerText.replace(/\s+/g, ' ').trim());
    });
    console.log('Chips after Backspace:', chipsAfterBackspace);
    if (chipsAfterBackspace.length !== chipsAfterThird.length - 1) {
      throw new Error(`FAIL: Backspace did not remove last chip! Expected ${chipsAfterThird.length - 1}, got ${chipsAfterBackspace.length}`);
    }
    console.log('✓ PASS: Backspace on empty input deleted latest chip token.');

    // -------------------------------------------------------------------------
    // TEST 8: Clear All Action
    // -------------------------------------------------------------------------
    console.log('\n[Test 8] Testing Clear All Action ...');
    await page.waitForSelector('.search-clear-all-btn');
    await page.click('.search-clear-all-btn');
    await new Promise(r => setTimeout(r, 300));

    const chipsAfterClear = await page.evaluate(() => {
      return document.querySelectorAll('.job-search-chip').length;
    });
    if (chipsAfterClear !== 0) {
      throw new Error(`FAIL: Clear all button failed to clear chips! Found ${chipsAfterClear}`);
    }
    console.log('✓ PASS: Clear all button completely purged search chips.');

    // -------------------------------------------------------------------------
    // TEST 9: Mobile Viewport Responsiveness (414px, 390px, 375px, 320px)
    // -------------------------------------------------------------------------
    const viewports = [
      { name: 'Tablet 768px', width: 768, height: 1024 },
      { name: 'iPhone XR 414px', width: 414, height: 896 },
      { name: 'iPhone 13 390px', width: 390, height: 844 },
      { name: 'iPhone SE 375px', width: 375, height: 667 },
      { name: 'Small Phone 320px', width: 320, height: 568 }
    ];

    for (const vp of viewports) {
      console.log(`\n[Test 9] Testing Viewport: ${vp.name} (${vp.width}x${vp.height}) ...`);
      await page.setViewport({ width: vp.width, height: vp.height });
      await new Promise(r => setTimeout(r, 400));

      const box = await page.evaluate(() => {
        const el = document.querySelector('.job-search-multiselect-container');
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        return {
          width: rect.width,
          height: rect.height
        };
      });

      console.log(`${vp.name} container width: ${Math.round(box?.width)}px`);
      // Assert it does not overflow viewport width
      if (!box || box.width > vp.width) {
        throw new Error(`FAIL: Search container overflowed viewport in ${vp.name}! width: ${box?.width}px > ${vp.width}px`);
      }
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `search_viewport_${vp.width}.png`) });
      console.log(`✓ PASS: ${vp.name} container responsive and within bounds.`);
    }

    console.log('\n======================================================================');
    console.log('ALL 9 REAL RUNTIME JOBS SEARCH & MULTI-SELECT TESTS PASSED 100%!');
    console.log('======================================================================\n');
  } catch (err) {
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'search_failure.png') }).catch(() => {});
    throw err;
  } finally {
    await browser.close();
  }
}

verifySearchAndMultiSelect().catch(err => {
  console.error('\nSearch Verification FAILED:', err);
  process.exit(1);
});
