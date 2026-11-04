import { prisma } from '../src/database/prisma.js';
import { JobStatus } from '@prisma/client';

async function main() {
  const jsonJobs = await prisma.job.findMany({
    where: { sourceType: 'JSON_API', status: JobStatus.ACTIVE },
    take: 5,
    include: { company: true }
  });

  console.log('Sample JSON_API jobs:');
  for (const j of jsonJobs) {
    console.log({
      id: j.id,
      title: j.title,
      company: j.company.name,
      descLen: j.description?.length,
      descSnippet: j.description?.slice(0, 80),
      sourceUrl: j.sourceUrl,
      appUrl: j.applicationUrl,
      respCount: Array.isArray(j.responsibilities) ? j.responsibilities.length : 0,
      reqCount: Array.isArray(j.requirements) ? j.requirements.length : 0
    });
  }

  const workdayJobs = await prisma.job.findMany({
    where: { sourceType: 'WORKDAY', status: JobStatus.ACTIVE },
    take: 5,
    include: { company: true }
  });
  console.log('\nSample WORKDAY jobs:');
  for (const j of workdayJobs) {
    console.log({
      id: j.id,
      title: j.title,
      company: j.company.name,
      descLen: j.description?.length,
      descSnippet: j.description?.slice(0, 80),
      sourceUrl: j.sourceUrl,
      appUrl: j.applicationUrl
    });
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
