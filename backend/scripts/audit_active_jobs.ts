import { prisma } from '../src/database/prisma.js';
import { JobStatus } from '@prisma/client';

async function main() {
  console.log('=== PART 4: ACTIVE JOB DATA AUDIT ===');

  const jobs = await prisma.job.findMany({
    where: { status: JobStatus.ACTIVE },
    include: {
      company: { select: { name: true } },
      skills: { include: { skill: true } }
    }
  });

  console.log(`Total active jobs in DB: ${jobs.length}`);

  let qualityGood = 0;
  let qualityPartial = 0;
  let qualityBad = 0;
  let sourceUnavailable = 0;

  const sourceStats: Record<string, {
    total: number;
    good: number;
    partial: number;
    bad: number;
    missingResp: number;
    missingReq: number;
    skillsCount: number;
  }> = {};

  for (const j of jobs) {
    const src = j.sourceType || 'UNKNOWN';
    if (!sourceStats[src]) {
      sourceStats[src] = {
        total: 0,
        good: 0,
        partial: 0,
        bad: 0,
        missingResp: 0,
        missingReq: 0,
        skillsCount: 0
      };
    }
    sourceStats[src].total++;

    const desc = (j.description || '').trim();
    const title = (j.title || '').trim();
    const resp = Array.isArray(j.responsibilities) ? j.responsibilities : [];
    const req = Array.isArray(j.requirements) ? j.requirements : [];
    const pref = Array.isArray(j.preferredQualifications) ? j.preferredQualifications : [];
    const skills = j.skills || [];

    if (resp.length === 0) sourceStats[src].missingResp++;
    if (req.length === 0) sourceStats[src].missingReq++;
    sourceStats[src].skillsCount += skills.length;

    // Check classification
    const isTitleOnly = !desc || desc.toLowerCase() === title.toLowerCase() || desc.length < 30;
    const hasRichText = desc.length >= 100 || resp.length > 0 || req.length > 0;

    let classification: 'QUALITY_GOOD' | 'QUALITY_PARTIAL' | 'QUALITY_BAD' | 'SOURCE_UNAVAILABLE';

    if (!j.sourceUrl && !j.applicationUrl) {
      classification = 'SOURCE_UNAVAILABLE';
      sourceUnavailable++;
      sourceStats[src].bad++;
    } else if (isTitleOnly && resp.length === 0 && req.length === 0) {
      classification = 'QUALITY_BAD';
      qualityBad++;
      sourceStats[src].bad++;
    } else if (desc.length > 150 && (resp.length > 0 || req.length > 0 || skills.length > 0)) {
      classification = 'QUALITY_GOOD';
      qualityGood++;
      sourceStats[src].good++;
    } else {
      classification = 'QUALITY_PARTIAL';
      qualityPartial++;
      sourceStats[src].partial++;
    }
  }

  console.log('\n--- OVERALL AUDIT SUMMARY ---');
  console.log(`Total Active Jobs: ${jobs.length}`);
  console.log(`QUALITY_GOOD: ${qualityGood} (${((qualityGood / jobs.length) * 100).toFixed(1)}%)`);
  console.log(`QUALITY_PARTIAL: ${qualityPartial} (${((qualityPartial / jobs.length) * 100).toFixed(1)}%)`);
  console.log(`QUALITY_BAD: ${qualityBad} (${((qualityBad / jobs.length) * 100).toFixed(1)}%)`);
  console.log(`SOURCE_UNAVAILABLE: ${sourceUnavailable} (${((sourceUnavailable / jobs.length) * 100).toFixed(1)}%)`);

  console.log('\n--- PER SOURCE BREAKDOWN ---');
  console.table(sourceStats);

  // Print sample of 50 active jobs across multiple source types
  console.log('\n--- SAMPLE OF 50 ACTIVE JOBS ACROSS SOURCE TYPES ---');
  const sample = jobs.slice(0, 50);
  sample.forEach((j, i) => {
    const desc = (j.description || '').trim();
    const title = (j.title || '').trim();
    const isBad = !desc || desc.toLowerCase() === title.toLowerCase() || desc.length < 30;
    console.log(`[${i + 1}] [${j.sourceType}] ${j.company.name} - ${j.title} | DescLen: ${desc.length} | Resp: ${Array.isArray(j.responsibilities) ? j.responsibilities.length : 0} | Req: ${Array.isArray(j.requirements) ? j.requirements.length : 0} | Skills: ${j.skills.length} | Status: ${isBad ? 'QUALITY_BAD' : desc.length > 150 ? 'QUALITY_GOOD' : 'QUALITY_PARTIAL'}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
