import { prisma } from '../src/database/prisma.js';
import { JobStatus } from '@prisma/client';

async function main() {
  const compNames = ['Synechron', 'Bahwan CyberTek', 'Publicis Sapient Careers', 'Caterpillar', 'Codewalla', 'Maveric Systems'];

  for (const name of compNames) {
    const sample = await prisma.job.findMany({
      where: {
        company: { name },
        status: JobStatus.ACTIVE
      },
      take: 2,
      select: {
        id: true,
        title: true,
        description: true,
        responsibilities: true,
        requirements: true,
        skills: true,
        sourceType: true,
        sourceUrl: true,
        applicationUrl: true
      }
    });

    console.log(`\n=== Company: ${name} ===`);
    for (const j of sample) {
      console.log({
        id: j.id,
        title: j.title,
        descLen: j.description?.length,
        descPreview: j.description?.slice(0, 100),
        respCount: Array.isArray(j.responsibilities) ? j.responsibilities.length : 0,
        reqCount: Array.isArray(j.requirements) ? j.requirements.length : 0,
        sourceUrl: j.sourceUrl,
        appUrl: j.applicationUrl
      });
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
