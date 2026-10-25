import { prisma } from '../src/database/prisma.js';
import fs from 'node:fs';
import path from 'node:path';

async function main() {
  const resumes = await prisma.resume.findMany({
    select: {
      id: true,
      title: true,
      originalFileName: true,
      storageProvider: true,
      storageKey: true,
      filePath: true,
      status: true,
      createdAt: true
    }
  });

  console.log(`Total resumes in DB: ${resumes.length}`);
  let localCount = 0;
  let durableCount = 0;
  let fileExistsCount = 0;
  let fileMissingCount = 0;

  const searchDirs = [
    path.resolve(process.cwd(), 'storage', 'resumes'),
    path.resolve(process.cwd(), '..', 'storage', 'resumes'),
    path.resolve(process.cwd(), 'uploads', 'resumes'),
    path.resolve(process.cwd(), '..', 'uploads', 'resumes')
  ];

  for (const r of resumes) {
    const isLocal = r.storageProvider === 'local' || !r.storageProvider;
    if (isLocal) localCount++; else durableCount++;

    const key = r.storageKey ? path.basename(r.storageKey) : (r.filePath ? path.basename(r.filePath) : null);
    let foundPath: string | null = null;

    if (key) {
      for (const d of searchDirs) {
        const candidate = path.join(d, key);
        if (fs.existsSync(candidate)) {
          foundPath = candidate;
          break;
        }
      }
    }

    if (foundPath) {
      fileExistsCount++;
    } else {
      fileMissingCount++;
    }

    console.log(JSON.stringify({
      id: r.id,
      title: r.title,
      provider: r.storageProvider,
      status: r.status,
      storageKey: r.storageKey,
      found: !!foundPath,
      foundPath
    }));
  }

  console.log('SUMMARY:', JSON.stringify({
    total: resumes.length,
    localCount,
    durableCount,
    fileExistsCount,
    fileMissingCount
  }, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
