import { prisma } from '../src/database/prisma.js';
import { logger } from '../src/utils/logger.js';

interface RepairStats {
  scanned: number;
  eligibleBadOrPartial: number;
  repaired: number;
  skippedGood: number;
  failed: number;
  byCompany: Record<string, number>;
}

async function runBackfill() {
  console.log('--- Starting Controlled Active Job Content Backfill ---');
  
  const stats: RepairStats = {
    scanned: 0,
    eligibleBadOrPartial: 0,
    repaired: 0,
    skippedGood: 0,
    failed: 0,
    byCompany: {}
  };

  // Find all ACTIVE jobs
  const activeJobs = await prisma.job.findMany({
    where: { status: 'ACTIVE' },
    include: {
      company: {
        select: {
          id: true,
          name: true,
          officialDomain: true
        }
      }
    }
  });

  stats.scanned = activeJobs.length;
  console.log(`Loaded ${stats.scanned} active jobs from database.`);

  for (const job of activeJobs) {
    const title = (job.title || '').trim();
    const currentDesc = (job.description || '').trim();
    const companyName = job.company?.name || 'Company';
    const loc = (job.location || '').trim();
    const appUrl = (job.applicationUrl || '').trim();
    const sourceUrl = (job.sourceUrl || '').trim();
    
    // Check if description is missing, title-only, or very short (< 40 chars)
    const isTitleOnly = currentDesc.toLowerCase() === title.toLowerCase() ||
      currentDesc.toLowerCase().startsWith(`${title.toLowerCase()} based in`) ||
      currentDesc.toLowerCase().startsWith(`${title.toLowerCase()} - requisition`);
    const isTooShort = currentDesc.length < 50;
    const isPoor = !currentDesc || isTitleOnly || isTooShort;

    if (!isPoor) {
      stats.skippedGood++;
      continue;
    }

    stats.eligibleBadOrPartial++;

    // Construct enriched description safely while strictly preserving all URLs and identifiers
    let enrichedDesc = '';

    // Handle Bahwan CyberTek / RippleHire
    if (appUrl.includes('ripplehire.com') || sourceUrl.includes('ripplehire.com')) {
      const matchReq = appUrl.match(/#detail\/job\/(\d+)/i) || sourceUrl.match(/#detail\/job\/(\d+)/i) || currentDesc.match(/Requisition\s+(\S+)/i);
      const reqId = matchReq ? matchReq[1] : '';
      const expStr = (job.experienceMin !== null && job.experienceMin !== undefined) ? `${job.experienceMin}+ Years Experience Required` : '';
      
      const parts = [
        `${title} opportunity at ${companyName}.`,
        reqId ? `Requisition ID: ${reqId}.` : '',
        expStr ? `Experience: ${expStr}.` : '',
        loc ? `Location: ${loc}.` : '',
        'Review key responsibilities, technical qualifications, and submit your direct application via the employer portal.'
      ].filter(Boolean);
      enrichedDesc = parts.join(' ');
    }
    // Handle Workday jobs (e.g. Synechron)
    else if (appUrl.includes('myworkdayjobs.com') || sourceUrl.includes('myworkdayjobs.com') || job.sourceType === 'WORKDAY') {
      const parts = [
        `${title} opening at ${companyName}.`,
        loc ? `Location: ${loc}.` : '',
        job.employmentType ? `Employment Type: ${job.employmentType.replace('_', ' ')}.` : '',
        'View the complete job description, key deliverables, and submit your application through the official Workday career portal.'
      ].filter(Boolean);
      enrichedDesc = parts.join(' ');
    }
    // Handle iCIMS jobs (e.g. Publicis Sapient)
    else if (appUrl.includes('icims.com') || sourceUrl.includes('icims.com') || job.sourceType === 'ICIMS') {
      const parts = [
        `${title} professional opportunity at ${companyName}.`,
        loc ? `Location: ${loc}.` : '',
        'Explore requirements, team impact, and apply directly via the official employer career center.'
      ].filter(Boolean);
      enrichedDesc = parts.join(' ');
    }
    // Handle Caterpillar & generic browser jobs
    else if (appUrl.includes('caterpillar.com') || sourceUrl.includes('caterpillar.com') || job.sourceType === 'BROWSER_RENDERED') {
      const parts = [
        `${title} opportunity with ${companyName}.`,
        loc ? `Location: ${loc}.` : '',
        job.employmentType ? `Type: ${job.employmentType.replace('_', ' ')}.` : '',
        'Review responsibilities, qualifications, and submit your application on the official career site.'
      ].filter(Boolean);
      enrichedDesc = parts.join(' ');
    }
    // Handle SAP SuccessFactors
    else if (appUrl.includes('sapsf.com') || sourceUrl.includes('sapsf.com') || job.sourceType === 'SAP_SUCCESSFACTORS') {
      const parts = [
        `${title} opportunity at ${companyName}.`,
        loc ? `Location: ${loc}.` : '',
        'Explore requirements and submit your application via the official SAP SuccessFactors portal.'
      ].filter(Boolean);
      enrichedDesc = parts.join(' ');
    }
    // Fallback for any other poor description jobs
    else {
      const parts = [
        `${title} position at ${companyName}.`,
        loc ? `Location: ${loc}.` : '',
        'Review full position details and submit your application on the official employer careers site.'
      ].filter(Boolean);
      enrichedDesc = parts.join(' ');
    }

    if (enrichedDesc && enrichedDesc.length > currentDesc.length) {
      try {
        await prisma.job.update({
          where: { id: job.id },
          data: {
            description: enrichedDesc
            // Explicitly NOT updating applicationUrl, sourceUrl, companyId, externalJobId, or status
          }
        });
        stats.repaired++;
        stats.byCompany[companyName] = (stats.byCompany[companyName] || 0) + 1;
      } catch (err: any) {
        stats.failed++;
        console.error(`Failed to update job ${job.id}:`, err.message);
      }
    }
  }

  console.log('\n=== Backfill Summary ===');
  console.log(`Total scanned: ${stats.scanned}`);
  console.log(`Already good: ${stats.skippedGood}`);
  console.log(`Eligible for repair: ${stats.eligibleBadOrPartial}`);
  console.log(`Successfully repaired: ${stats.repaired}`);
  console.log(`Failed: ${stats.failed}`);
  console.log('Repairs by Company:', stats.byCompany);

  await prisma.$disconnect();
}

runBackfill().catch(err => {
  console.error('Fatal error in backfill:', err);
  process.exit(1);
});
