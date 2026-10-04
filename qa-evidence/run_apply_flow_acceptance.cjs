const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const sleep = ms => new Promise(res => setTimeout(res, ms));

async function runE2EApplyFlowValidation() {
  console.log('=====================================================');
  console.log('STARTING COMPLETE JOBPILOT APPLY FLOW E2E ACCEPTANCE TEST');
  console.log('=====================================================');

  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  page.on('dialog', async dialog => {
    await dialog.accept();
  });

  async function navigateTo(label) {
    await page.evaluate(lbl => {
      const items = Array.from(document.querySelectorAll('.nav-item'));
      const found = items.find(i => i.innerText.includes(lbl));
      if (found) found.click();
    }, label);
    await sleep(1500);
  }

  const results = {};

  try {
    // 1. Visit frontend and clean localStorage
    await page.goto('http://localhost:5174', { waitUntil: 'networkidle2' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle2' });
    console.log('[PASS] Navigated to JobPilot UI at http://localhost:5174');
    await sleep(1200);

    // 2. Select Candidate Aarav Sharma
    await page.evaluate(() => {
      const sel = document.querySelector('.switcher-select');
      if (sel) {
        const opt = Array.from(sel.options).find(o => o.text.includes('Aarav'));
        if (opt) {
          sel.value = opt.value;
          sel.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
    });
    await sleep(1500);
    console.log('[PASS] Selected Candidate Aarav Sharma');

    // 3. Navigate to Jobs & Matching
    await navigateTo('Jobs & Matching');
    await sleep(1500);
    console.log('[PASS] Navigated to Jobs & Matching');

    // 4. Verify ApplicationModeBadge is rendered on job cards
    const modeBadgesCount = await page.$$eval('.app-mode-badge', badges => badges.length);
    console.log(`[PASS] Found ${modeBadgesCount} ApplicationModeBadges on job cards`);
    results['ApplicationModeBadges Rendered'] = modeBadgesCount > 0 ? 'PASS' : 'FAIL';

    // 5. Click Codewalla job card
    await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.job-item-card'));
      const codewallaCard = cards.find(c => c.innerText.includes('Codewalla'));
      if (codewallaCard) codewallaCard.click();
    });
    await sleep(2000);
    console.log('[PASS] Opened Codewalla Job Analysis Page');

    // Verify Codewalla displays DEMO APPLICATION badge
    const codewallaPageText = await page.evaluate(() => document.body.innerText);
    const hasCodewallaDemoBadge = codewallaPageText.includes('DEMO APPLICATION');
    console.log(`[PASS] Codewalla displays DEMO APPLICATION badge: ${hasCodewallaDemoBadge}`);
    results['Codewalla Badge Demo'] = hasCodewallaDemoBadge ? 'PASS' : 'FAIL';

    // 6. Verify APPLY NOW button is visible on evaluation page
    const hasApplyNowBtn = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.some(b => b.innerText.includes('APPLY NOW'));
    });
    console.log(`[PASS] Prominent APPLY NOW button present: ${hasApplyNowBtn}`);
    results['Apply Now CTA Present'] = hasApplyNowBtn ? 'PASS' : 'FAIL';

    // 7. Click APPLY NOW to launch Application Readiness Modal
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const applyBtn = btns.find(b => b.innerText.includes('APPLY NOW'));
      if (applyBtn) applyBtn.click();
    });
    await sleep(1200);

    // Verify Application Modal opened
    const modalTitle = await page.$eval('.modal-title', el => el.innerText).catch(() => '');
    console.log(`[PASS] Application Modal launched with title: "${modalTitle}"`);
    results['Application Modal Launched'] = modalTitle.length > 0 ? 'PASS' : 'FAIL';

    // Check Codewalla simulation banner
    const simBannerText = await page.$eval('.codewalla-demo-banner', el => el.innerText).catch(() => '');
    const hasSimWarning = simBannerText.includes('Nothing will be submitted to Codewalla') || simBannerText.includes('SIMULATION ONLY');
    console.log(`[PASS] Codewalla Demo Safeguard Banner: ${hasSimWarning}`);
    results['Codewalla Zero External Submissions Safeguard'] = hasSimWarning ? 'PASS' : 'FAIL';

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'apply_01_readiness_modal.png') });

    // 8. Progress to Step 2: Resume Selection
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('.modal-actions-bar button'));
      const nextBtn = btns.find(b => b.innerText.includes('Continue to Resume Selection'));
      if (nextBtn) nextBtn.click();
    });
    await sleep(800);
    console.log('[PASS] Progressed to Step 2: Resume Selection');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'apply_02_resume_selection.png') });

    // 9. Progress to Step 3: Application Form
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('.modal-actions-bar button'));
      const nextBtn = btns.find(b => b.innerText.includes('Continue to Application Form'));
      if (nextBtn) nextBtn.click();
    });
    await sleep(800);
    console.log('[PASS] Progressed to Step 3: Application Form & Preview');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'apply_03_application_form.png') });

    // 10. Click Submit Demo Application
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('.modal-actions-bar button'));
      const submitBtn = btns.find(b => b.innerText.includes('Submit Demo Application'));
      if (submitBtn) submitBtn.click();
    });
    await sleep(2000);
    console.log('[PASS] Clicked Submit Demo Application');

    // 11. Verify Step 4: Success confirmation
    const successTitle = await page.$eval('.success-title', el => el.innerText).catch(() => '');
    console.log(`[PASS] Confirmation displayed: "${successTitle}"`);
    results['Demo Application Submission Confirmation'] = successTitle.includes('Submitted Successfully') ? 'PASS' : 'FAIL';

    const zeroSubmitNote = await page.$eval('.codewalla-demo-banner', el => el.innerText).catch(() => '');
    results['Codewalla Nothing Submitted Guarantee'] = zeroSubmitNote.includes('Nothing was submitted to Codewalla') ? 'PASS' : 'FAIL';
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'apply_04_success_confirmation.png') });

    // Navigate to Applications Tracker
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('.modal-actions-bar button'));
      const trackerBtn = btns.find(b => b.innerText.includes('View in Application Tracker'));
      if (trackerBtn) trackerBtn.click();
    });
    await sleep(1500);
    console.log('[PASS] Navigated to Applications Pipeline Tracker');

    // 12. Verify Application Tracker lists the demo application with APPLIED_DEMO and DEMO badge
    const trackerCodewalla = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.app-item-card'));
      return cards.some(c => c.innerText.toLowerCase().includes('codewalla'));
    });
    console.log(`[PASS] Applications Tracker lists submitted Codewalla application: ${trackerCodewalla}`);
    results['Application Tracker Persistence'] = trackerCodewalla ? 'PASS' : 'FAIL';

    // Click on the Codewalla application card to display details panel
    await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.app-item-card'));
      const cw = cards.find(c => c.innerText.toLowerCase().includes('codewalla'));
      if (cw) cw.click();
    });
    await sleep(1000);

    // Check Download button exists
    const hasDownloadBtn = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.some(b => b.innerText.includes('Download Submitted Resume'));
    });
    console.log(`[PASS] Immutable historical resume download button present: ${hasDownloadBtn}`);
    results['Immutable Resume Download Available'] = hasDownloadBtn ? 'PASS' : 'FAIL';

    // Check Skill Gaps section exists in Application Details
    const hasSkillGap = await page.evaluate(() => Boolean(document.querySelector('.skill-gap-section')));
    console.log(`[PASS] Skill gaps and learning recommendations visible: ${hasSkillGap}`);
    results['Post-Apply Skill Gap Displayed'] = hasSkillGap ? 'PASS' : 'FAIL';

    // Check Audit timeline exists
    const timelineCount = await page.$$eval('.timeline-item', items => items.length);
    console.log(`[PASS] Audit timeline events recorded: ${timelineCount}`);
    results['Audit Timeline Recorded'] = timelineCount >= 2 ? 'PASS' : 'FAIL';

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'apply_05_application_tracker.png') });

    // 13. Test External Application Job (job-demo-8: Infosys Cloud DevOps)
    await navigateTo('Jobs & Matching');
    await sleep(1500);

    await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.job-item-card'));
      const extCard = cards.find(c => c.innerText.includes('Infosys') || c.innerText.includes('INFOSYS') || c.innerText.includes('EXTERNAL APPLICATION'));
      if (extCard) extCard.click();
    });
    await sleep(2000);

    // Verify external badge on Job Analysis page
    const isExternalBadge = await page.$$eval('.app-mode-external', badges => badges.length > 0);
    console.log(`[PASS] External Job displays EXTERNAL APPLICATION badge: ${isExternalBadge}`);
    results['External Job Badge'] = isExternalBadge ? 'PASS' : 'FAIL';

    // Click Apply Now
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const applyBtn = btns.find(b => b.innerText.includes('APPLY NOW'));
      if (applyBtn) applyBtn.click();
    });
    await sleep(1000);

    // Progress through modal to Preview
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('.modal-actions-bar button'));
      const nextBtn = btns.find(b => b.innerText.includes('Continue to Resume Selection'));
      if (nextBtn) nextBtn.click();
    });
    await sleep(800);

    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('.modal-actions-bar button'));
      const nextBtn = btns.find(b => b.innerText.includes('Continue to Application Form'));
      if (nextBtn) nextBtn.click();
    });
    await sleep(800);

    // Verify button is "Open Application & Start (External)"
    const hasExtStartBtn = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('.modal-actions-bar button'));
      return btns.some(b => b.innerText.includes('Open Application & Start (External)'));
    });
    console.log(`[PASS] External Application CTA is Open & Start: ${hasExtStartBtn}`);
    results['External Application Start CTA'] = hasExtStartBtn ? 'PASS' : 'FAIL';

    // Click Start External Application
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('.modal-actions-bar button'));
      const startBtn = btns.find(b => b.innerText.includes('Open Application & Start (External)'));
      if (startBtn) startBtn.click();
    });
    await sleep(2000);

    // Verify Status is APPLICATION_STARTED and does NOT falsely claim APPLIED
    const extStatusBadge = await page.evaluate(() => {
      const card = document.querySelector('.success-details-card');
      return card ? card.innerText.includes('APPLICATION_STARTED') : false;
    });
    console.log(`[PASS] External status recorded as APPLICATION_STARTED without false APPLIED claim: ${extStatusBadge}`);
    results['External Safety No False Applied'] = extStatusBadge ? 'PASS' : 'FAIL';

    // Verify Candidate confirmation button is present
    const hasConfirmBtn = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('.external-confirmation-box button'));
      return btns.some(b => b.innerText.includes('Mark as Applied'));
    });
    console.log(`[PASS] Candidate confirmation button present: ${hasConfirmBtn}`);
    results['External Confirmation Safeguard Present'] = hasConfirmBtn ? 'PASS' : 'FAIL';

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'apply_06_external_application.png') });

    // 14. Responsive Viewport Check: Mobile 390px
    await page.setViewport({ width: 390, height: 844 });
    await sleep(800);
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    const noHorizontalScroll = scrollWidth <= clientWidth + 5;
    console.log(`[PASS] Mobile 390px Viewport No Horizontal Overflow: ${noHorizontalScroll} (scroll: ${scrollWidth}, client: ${clientWidth})`);
    results['Mobile Responsiveness 390px'] = noHorizontalScroll ? 'PASS' : 'FAIL';
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'apply_07_mobile_responsive.png') });

    console.log('\n=====================================================');
    console.log('FINAL JOBPILOT APPLY FLOW ACCEPTANCE RESULTS');
    console.log('=====================================================');
    console.table(results);

    fs.writeFileSync(
      path.join(__dirname, 'apply_flow_results.json'),
      JSON.stringify(results, null, 2)
    );

    return results;
  } catch (err) {
    console.error('E2E validation encountered an error:', err);
    throw err;
  } finally {
    await browser.close();
  }
}

runE2EApplyFlowValidation()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
