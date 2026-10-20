const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

(async () => {
  let browser;
  try {
    console.log('[1/5] Launching Chrome...');
    browser = await puppeteer.launch({
      executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,1080']
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    const targetUrl = 'https://synechron.wd1.myworkdayjobs.com/SynechronCareers/job/Belgrade/Workday-Admin_JR1041130';
    console.log(`[2/5] Navigating to: ${targetUrl}`);
    
    await page.goto(targetUrl, {
      waitUntil: 'networkidle0',
      timeout: 45000
    });

    console.log(`[3/5] Waiting for job description / apply button selector...`);
    // Wait for the cookie consent or job content to render
    try {
      await page.waitForSelector('a[data-automation-id="adventureButton"], [data-automation-id="applyButton"], h2, [data-automation-id="jobPostingHeader"]', { timeout: 20000 });
      console.log('Main job content element appeared!');
    } catch (e) {
      console.log('Timeout waiting for primary selector, continuing to inspect DOM...');
    }

    // Additional settling time
    await new Promise(r => setTimeout(r, 4000));

    const screenshotDir = path.join(__dirname, 'screenshots');
    if (!fs.existsSync(screenshotDir)) fs.mkdirSync(screenshotDir, { recursive: true });
    
    const fullJobShot = path.join(screenshotDir, 'synechron_job_fully_rendered.png');
    await page.screenshot({ path: fullJobShot, fullPage: false });
    console.log(`[4/5] Rendered screenshot saved to ${fullJobShot}`);

    // Inspect buttons again
    const interactiveElements = await page.evaluate(() => {
      const all = Array.from(document.querySelectorAll('button, a, [role="button"], [data-automation-id]'));
      return all.map(el => ({
        tag: el.tagName,
        text: (el.innerText || el.textContent || '').trim().replace(/\s+/g, ' '),
        automationId: el.getAttribute('data-automation-id') || '',
        role: el.getAttribute('role') || '',
        href: el.getAttribute('href') || ''
      })).filter(x => x.text.length > 0 || x.automationId.length > 0);
    });

    const applyBtns = interactiveElements.filter(e => 
      e.text.toLowerCase().includes('apply') || 
      e.automationId.toLowerCase().includes('apply') ||
      e.automationId.toLowerCase().includes('adventure')
    );
    console.log('Apply buttons detected:', JSON.stringify(applyBtns, null, 2));

    // Click Apply button
    const applyTarget = await page.$('a[data-automation-id="adventureButton"], [data-automation-id="applyButton"], a[href*="/apply"]');
    if (applyTarget) {
      console.log('[5/5] Clicking actual Apply button...');
      await applyTarget.click();
      console.log('Waiting for Apply dialog/page navigation...');
      await new Promise(r => setTimeout(r, 6000));
      console.log(`URL after clicking Apply: ${page.url()}`);

      const applyOptionsShot = path.join(screenshotDir, 'synechron_apply_options_modal.png');
      await page.screenshot({ path: applyOptionsShot, fullPage: false });
      console.log(`Saved apply options modal screenshot to ${applyOptionsShot}`);

      const modalButtons = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button, a, [role="button"], [data-automation-id]'));
        return btns.map(b => ({
          text: (b.innerText || b.textContent || '').trim().replace(/\s+/g, ' '),
          automationId: b.getAttribute('data-automation-id') || '',
          href: b.getAttribute('href') || ''
        })).filter(b => b.text.length > 0);
      });
      console.log('Post-apply modal buttons:', JSON.stringify(modalButtons, null, 2));

      // Check specifically for "Autofill with Resume"
      const autofillOption = await page.$('a[data-automation-id="autofillWithResume"], [data-automation-id*="autofill"], a[href*="autofillWithResume"]');
      if (autofillOption) {
        console.log('Found "Autofill with Resume" control! Clicking it...');
        await autofillOption.click();
        await new Promise(r => setTimeout(r, 6000));
        console.log(`URL after Autofill with Resume click: ${page.url()}`);
        
        const loginCreateShot = path.join(screenshotDir, 'synechron_login_or_create_account.png');
        await page.screenshot({ path: loginCreateShot, fullPage: false });
        console.log(`Saved login/account creation screenshot to ${loginCreateShot}`);

        const authForms = await page.evaluate(() => {
          const inputs = Array.from(document.querySelectorAll('input, button, a, [data-automation-id]'));
          return inputs.map(i => ({
            tag: i.tagName,
            type: i.getAttribute('type') || '',
            id: i.id,
            name: i.getAttribute('name') || '',
            text: (i.innerText || i.textContent || '').trim().replace(/\s+/g, ' '),
            automationId: i.getAttribute('data-automation-id') || '',
            ariaLabel: i.getAttribute('aria-label') || ''
          })).filter(x => x.text.length > 0 || x.automationId.length > 0 || x.name.length > 0 || x.id.length > 0);
        });
        console.log('Auth page fields detected:', JSON.stringify(authForms.slice(0, 25), null, 2));
      } else {
        console.log('"Autofill with Resume" button not found by strict selector, searching by text...');
        const clickedByText = await page.evaluate(() => {
          const elements = Array.from(document.querySelectorAll('a, button, [role="button"]'));
          const found = elements.find(e => e.innerText.includes('Autofill with Resume'));
          if (found) {
            found.click();
            return true;
          }
          return false;
        });
        console.log('Clicked Autofill with Resume by text:', clickedByText);
        if (clickedByText) {
          await new Promise(r => setTimeout(r, 6000));
          console.log(`URL after text-click Autofill: ${page.url()}`);
          const authShot = path.join(screenshotDir, 'synechron_login_or_create_account.png');
          await page.screenshot({ path: authShot, fullPage: false });
        }
      }
    }

  } catch (err) {
    console.error('Error during execution:', err);
  } finally {
    if (browser) await browser.close();
    console.log('Browser closed.');
  }
})();
