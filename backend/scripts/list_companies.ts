import { prisma } from '../src/database/prisma.js';

async function main() {
  const companies = await prisma.company.findMany({
    select: {
      id: true,
      name: true,
      officialDomain: true,
      careersUrl: true,
      sourceType: true,
      atsProvider: true,
      _count: { select: { jobs: true } }
    }
  });

  console.table(companies.map(c => ({
    name: c.name,
    sourceType: c.sourceType,
    atsProvider: c.atsProvider,
    jobsCount: c._count.jobs
  })));
}

main().catch(console.error).finally(() => prisma.$disconnect());
