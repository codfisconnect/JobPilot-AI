import { prisma } from '../src/database/prisma.js';

async function main() {
  const resumes = await prisma.resume.findMany({
    where: {
      storageKey: { not: null }
    }
  });

  console.log(`Resumes with non-null storageKey: ${resumes.length}`);
  console.log(JSON.stringify(resumes, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
