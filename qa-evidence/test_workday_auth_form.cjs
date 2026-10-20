const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

(async () => {
  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,1080']
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    const authUrl = 'https://synechron.wd1.myworkdayjobs.com/en-US/SynechronCareers/job/Belgrade/Workday-Admin_JR1041130/apply/autofillWithResume';
    console.log(`Navigating to auth page: ${authUrl}`);
    await page.goto(authUrl, { waitUntil: 'networkidle2', timeout: 45000 });

    console.log('Waiting for authentication card to finish loading...');
    await page.waitForSelector('input, [data-automation-id="signInSubmitButton"], [data-automation-id="createAccountSubmitButton"], [data-automation-id="createAccountLink"]', { timeout: 25000 });
    
    await new Promise(r => setTimeout(r, 3000));

    const screenshotDir = path.join(__dirname, 'screenshots');
    const authRenderedShot = path.join(screenshotDir, 'synechron_auth_form_rendered.png');
    await page.screenshot({ path: authRenderedShot, fullPage: false });
    console.log(`Saved auth rendered screenshot to ${authRenderedShot}`);

    const formDetails = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input, button, a[role="button"], label'));
      return inputs.map(el => ({
        tag: el.tagName,
        type: el.getAttribute('type') || '',
        name: el.getAttribute('name') || '',
        id: el.id,
        automationId: el.getAttribute('data-automation-id') || '',
        text: (el.innerText || el.textContent || '').trim(),
        placeholder: el.getAttribute('placeholder') || ''
      })).filter(x => x.text.length > 0 || x.automationId.length > 0 || x.name.length > 0 || x.id.length > 0);
    });

    console.log('Detailed form elements:', JSON.stringify(formDetails, null, 2));

  } catch (err) {
    console.error('Error during step:', err.message);
  } finally {
    if (browser) await browser.close();
    console.log('Done.');
  }
})();
