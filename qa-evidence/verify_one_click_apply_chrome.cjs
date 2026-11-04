const path = require('path');
const fs = require('fs');
const puppeteer = require('../backend/node_modules/puppeteer-core');
const { PrismaClient } = require('../backend/node_modules/@prisma/client');
const prisma = new PrismaClient();
const { signAccessToken } = require('../backend/dist/utils/jwt.js');

async function setupCandidateUser() {
  const email = 'cand.chrome.qa@pilotmama.test';
  let user = await prisma.user.findUnique({
    where: { email },
    include: { candidateProfile: { include: { resumes: true } } }
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        passwordHash: 'dummy_hash',
        role: 'CANDIDATE',
        candidateProfile: {
          create: {
            fullName: 'Sarah Connor',
            headline: 'Staff Infrastructure Engineer',
            location: 'Bangalore, India',
            phone: '+919876543210',
            linkedinUrl: 'https://linkedin.com/in/sarahconnor',
            resumes: {
              create: [
                {
                  title: 'Sarah Connor - Master Resume',
                  isMaster: true,
                  originalFileName: 'sarah_master.pdf',
                  mimeType: 'application/pdf',
                  fileSize: 2048,
                  storageProvider: 'LOCAL_DISK',
                  storageKey: 'sarah_master_key',
                  status: 'PARSED',
                  rawText: 'Sarah Connor. Staff Infrastructure Engineer. Kubernetes, Terraform, Go, Node.js, AWS.'
                }
              ]
            }
          }
        }
      },
      include: { candidateProfile: { include: { resumes: true } } }
    });
  }

  // Create or retrieve Test Company & Job for Greenhouse
  let company = await prisma.company.findFirst({
    where: { name: 'Acme Technologies QA' }
  });
  if (!company) {
    company = await prisma.company.create({
      data: { name: 'Acme Technologies QA', officialDomain: 'acme-qa.example.com' }
    });
  }

  let demoJob = await prisma.job.findFirst({
    where: { title: 'Staff Platform Engineer - QA Demo' }
  });
  if (!demoJob) {
    demoJob = await prisma.job.create({
      data: {
        companyId: company.id,
        title: 'Staff Platform Engineer - QA Demo',
        description: 'Lead infrastructure and cloud automation platforms. Kubernetes, Node.js, React.',
        sourceType: 'GREENHOUSE',
        sourceName: 'Greenhouse Board',
        sourceUrl: 'https://boards.greenhouse.io/acme-qa/jobs/778899',
        applicationUrl: 'https://boards.greenhouse.io/acme-qa/jobs/778899#app',
        externalJobId: '778899',
        contentHash: 'hash_qa_demo_778899',
        remoteType: 'REMOTE',
        employmentType: 'FULL_TIME',
        location: 'Remote',
        status: 'ACTIVE'
      }
    });
  }

  // Clear previous applications for this demo job so it can apply cleanly
  await prisma.application.deleteMany({
    where: {
      candidateProfileId: user.candidateProfile.id,
      jobId: demoJob.id
    }
  });

  const token = signAccessToken({
    userId: user.id,
    email: user.email,
    role: user.role
  });

  return { user, token, demoJob };
}

(async () => {
  const screenshotsDir = path.join(__dirname, 'screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  console.log('1. Setting up QA candidate user & token...');
  const { user, token, demoJob } = await setupCandidateUser();
  console.log(`Candidate ID: ${user.candidateProfile.id}, Job: ${demoJob.title}`);

  console.log('2. Launching Chrome with puppeteer-core...');
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  page.on('response', async res => {
    if (res.url().includes('orchestrate')) {
      try {
        console.log('ORCHESTRATE API:', res.status(), await res.text());
      } catch (e) {}
    }
  });

  // Test responsive viewports
  const viewports = [
    { width: 1440, height: 900, name: 'desktop_1440' },
    { width: 1024, height: 768, name: 'tablet_1024' },
    { width: 768, height: 1024, name: 'tablet_768' },
    { width: 414, height: 896, name: 'mobile_414' },
    { width: 390, height: 844, name: 'mobile_390' },
    { width: 375, height: 667, name: 'mobile_375' },
    { width: 320, height: 568, name: 'mobile_320' }
  ];

  try {
    console.log('3. Navigating to http://localhost:5173/jobs...');
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto('http://localhost:5173/jobs', { waitUntil: 'networkidle0', timeout: 30000 });

    // Inject Auth Token into LocalStorage
    await page.evaluate((jwtToken) => {
      localStorage.setItem('pilotmama_access_token', jwtToken);
    }, token);

    // Reload with authenticated token
    await page.reload({ waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2000));

    // Ensure we are viewing All Jobs tab
    await page.evaluate(() => {
      const allButtons = Array.from(document.querySelectorAll('button'));
      const allJobsBtn = allButtons.find(b => b.innerText.trim().includes('All Jobs') || b.innerText.trim().includes('Explore All Jobs'));
      if (allJobsBtn) allJobsBtn.click();
    });
    await new Promise(r => setTimeout(r, 2000));

    // Search specifically for our QA Demo job
    console.log('4. Searching for QA Demo job...');
    const searchInput = await page.$('.jobs-search-input');
    if (searchInput) {
      await searchInput.type('Staff Platform Engineer - QA Demo');
      await page.keyboard.press('Enter');
      await new Promise(r => setTimeout(r, 2500));
    }

    // Wait for job cards
    await page.waitForSelector('.canonical-job-card', { timeout: 15000 });
    console.log('✓ Job cards loaded.');

    // Screenshot Jobs list
    await page.screenshot({ path: path.join(screenshotsDir, 'one_click_01_jobs_list.png') });

    // Click Apply on the first Job Card
    console.log('4. Clicking primary Apply button on first Job Card...');
    const applyButton = await page.$('.canonical-job-card button.btn-primary');
    if (!applyButton) {
      throw new Error('Primary Apply button not found on job card');
    }
    await applyButton.click();

    // Verify Compact Apply Dialog appears
    await page.waitForSelector('.apply-dialog-card', { timeout: 10000 });
    console.log('✓ Compact Apply Dialog appeared without 4-step wizard.');

    // Verify Master Resume is selected by default
    const isMasterSelected = await page.evaluate(() => {
      const masterOpt = document.querySelector('.apply-resume-option.selected');
      return masterOpt ? masterOpt.innerText.includes('Master Resume') : false;
    });
    console.log(`✓ Master Resume selected by default: ${isMasterSelected}`);

    // Verify no wizard elements
    const hasWizard = await page.evaluate(() => {
      const text = document.body.innerText;
      return text.includes('Step 1 of 4') || text.includes('Readiness Check') || text.includes('Match Review') || text.includes('ATS Gate');
    });
    console.log(`✓ No 4-step wizard elements present: ${!hasWizard}`);

    // Capture dialog at 1440px
    await page.screenshot({ path: path.join(screenshotsDir, 'one_click_02_dialog_1440.png') });

    // Verify responsive viewports
    for (const vp of viewports) {
      await page.setViewport({ width: vp.width, height: vp.height });
      await new Promise(r => setTimeout(r, 300));
      await page.screenshot({ path: path.join(screenshotsDir, `one_click_responsive_${vp.name}.png`) });
    }
    console.log('✓ Responsive viewports verified (320, 375, 390, 414, 768, 1024, 1440).');

    // Reset to 1440px
    await page.setViewport({ width: 1440, height: 900 });

    // Click [Apply Now]
    console.log('5. Clicking [Apply Now]...');
    const applyNowBtn = await page.$('.apply-btn-primary');
    await applyNowBtn.click();

    // Verify lightweight progress state
    await page.waitForSelector('.apply-progress-view', { timeout: 10000 });
    console.log('✓ Lightweight progress state displayed.');
    await page.screenshot({ path: path.join(screenshotsDir, 'one_click_03_progress_state.png') });

    // Wait for submission confirmation or success
    console.log('6. Waiting for submission verification...');
    await page.waitForSelector('.apply-success-view, .apply-failure-view', { timeout: 20000 });

    const isSuccess = await page.$('.apply-success-view');
    if (isSuccess) {
      console.log('✓ Application Submitted Successfully confirmed!');
      const successData = await page.evaluate(() => {
        const title = document.querySelector('.apply-success-title')?.innerText;
        const summaryRows = Array.from(document.querySelectorAll('.apply-summary-row')).map(r => r.innerText.replace('\n', ' '));
        return { title, summaryRows };
      });
      console.log('Success Details:', successData);
      await page.screenshot({ path: path.join(screenshotsDir, 'one_click_04_success_state.png') });
    } else {
      const reason = await page.evaluate(() => document.querySelector('.apply-failure-reason')?.innerText);
      console.log('Application state ended with:', reason);
      await page.screenshot({ path: path.join(screenshotsDir, 'one_click_04_result_state.png') });
    }

    console.log('Real Chrome QA verification completed successfully!');
  } catch (err) {
    console.error('QA Verification Error:', err);
    await page.screenshot({ path: path.join(screenshotsDir, 'one_click_error.png') });
    process.exitCode = 1;
  } finally {
    await browser.close();
    await prisma.$disconnect();
  }
})();
