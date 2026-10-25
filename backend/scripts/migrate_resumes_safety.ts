import { prisma } from '../src/database/prisma.js';
import fs from 'node:fs';
import path from 'node:path';
import { resumeStorage } from '../src/storage/index.js';

async function main() {
  console.log('--- RESUME SAFETY AUDIT & RECONCILIATION ---');

  const resumes = await prisma.resume.findMany();
  console.log(`Total resume records in DB: ${resumes.length}`);

  let localRefs = 0;
  let durableRefs = 0;
  let fileExists = 0;
  let fileMissing = 0;

  const storageDir = path.resolve(process.cwd(), 'storage', 'resumes');
  const filesOnDisk = fs.existsSync(storageDir) ? fs.readdirSync(storageDir) : [];

  const toMarkMissing: string[] = [];
  const toMigrate: { id: string; localPath: string; originalFileName: string; mimeType: string }[] = [];

  for (const r of resumes) {
    const isLocal = r.storageProvider === 'local' || !r.storageProvider;
    if (isLocal) localRefs++; else durableRefs++;

    let diskPath: string | null = null;
    if (r.storageKey && filesOnDisk.includes(r.storageKey)) {
      diskPath = path.join(storageDir, r.storageKey);
    } else if (r.filePath && fs.existsSync(r.filePath)) {
      diskPath = r.filePath;
    }

    if (diskPath) {
      fileExists++;
      if (isLocal && (resumeStorage.providerName === 's3' || resumeStorage.providerName === 'r2')) {
        toMigrate.push({
          id: r.id,
          localPath: diskPath,
          originalFileName: r.originalFileName || `${r.title}.pdf`,
          mimeType: r.mimeType || 'application/pdf'
        });
      }
    } else {
      fileMissing++;
      if (r.status !== 'FILE_MISSING') {
        toMarkMissing.push(r.id);
      }
    }
  }

  console.log(`1. Total resumes: ${resumes.length}`);
  console.log(`2. Resumes with local storage references: ${localRefs}`);
  console.log(`3. Resumes already using durable storage: ${durableRefs}`);
  console.log(`4. Resumes whose local file actually exists: ${fileExists}`);
  console.log(`5. Resumes whose local file is missing: ${fileMissing}`);

  if (toMarkMissing.length > 0) {
    console.log(`Marking ${toMarkMissing.length} records whose physical files do not exist as FILE_MISSING...`);
    const updateRes = await prisma.resume.updateMany({
      where: { id: { in: toMarkMissing } },
      data: { status: 'FILE_MISSING' }
    });
    console.log(`Truthfully updated ${updateRes.count} records to FILE_MISSING.`);
  }

  if (toMigrate.length > 0) {
    console.log(`Migrating ${toMigrate.length} available local resumes to durable storage...`);
    for (const item of toMigrate) {
      const buffer = fs.readFileSync(item.localPath);
      const uploadRes = await resumeStorage.upload(buffer, item.originalFileName, item.mimeType);
      const verified = await resumeStorage.exists(uploadRes.storageKey);
      if (verified) {
        await prisma.resume.update({
          where: { id: item.id },
          data: {
            storageProvider: uploadRes.storageProvider,
            storageKey: uploadRes.storageKey,
            checksum: uploadRes.checksum,
            fileSize: uploadRes.byteSize
          }
        });
        console.log(`Migrated resume ${item.id} -> ${uploadRes.storageKey}`);
      }
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
