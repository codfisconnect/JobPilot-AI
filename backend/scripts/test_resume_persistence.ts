import { prisma } from '../src/database/prisma.js';
import { createResumeStorage } from '../src/storage/index.js';
import { ResumeService } from '../src/services/resume.service.js';
import assert from 'node:assert';

async function testPersistence() {
  console.log('=== PART 3 & 12: Resume Storage Persistence Test ===');

  // Find candidate user
  const user = await prisma.user.findFirst({
    where: { email: 'testuser@pilotmama.local' },
    include: { candidateProfile: true }
  });

  if (!user || !user.candidateProfile) {
    console.error('Test user or profile not found');
    process.exit(1);
  }

  const userId = user.id;
  const profileId = user.candidateProfile.id;
  console.log(`Candidate: ${user.email} (Profile ID: ${profileId})`);

  // Step 1: Upload a test resume
  const testBuffer = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Title (Test Candidate Resume) /Creator (PilotMama Test) >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF');
  const originalName = 'Durable_Test_Resume.pdf';

  console.log('1. Uploading test resume...');
  const uploaded = await ResumeService.uploadResume(
    userId,
    {
      buffer: testBuffer,
      originalname: originalName,
      mimetype: 'application/pdf',
      size: testBuffer.length
    } as any,
    'Durable Storage Verification Resume'
  );

  console.log('Uploaded Resume:', {
    id: uploaded.id,
    title: uploaded.title,
    storageKey: uploaded.storageKey,
    storageProvider: uploaded.storageProvider,
    status: uploaded.status,
    isMaster: uploaded.isMaster
  });

  assert.ok(uploaded.id, 'Resume ID must be created');
  assert.ok(uploaded.storageKey, 'Storage key must be present');

  // Step 2 & 3: Record reference without secrets
  console.log(`2. Resume ID: ${uploaded.id}`);
  console.log(`3. Storage Provider: ${uploaded.storageProvider}`);
  console.log(`   Storage Reference: ${uploaded.storageKey}`);

  // Step 4: Confirm preview / download bytes
  console.log('4. Testing download bytes immediately after upload...');
  const storage1 = createResumeStorage();
  const downloaded1 = await storage1.download(uploaded.storageKey);
  assert.strictEqual(downloaded1.length, testBuffer.length, 'Downloaded buffer length must match original');
  assert.strictEqual(downloaded1.toString('utf-8'), testBuffer.toString('utf-8'), 'Downloaded content must match original');
  console.log('   Immediate download verified: PASS');

  // Step 5: Mark as Preferred Resume
  console.log('5. Setting Preferred Resume status...');
  const preferred = await ResumeService.setPreferredResume(userId, uploaded.id);
  assert.strictEqual(preferred.isMaster, true, 'isMaster must be true');
  console.log('   Preferred Resume status verified: PASS');

  // Step 6: Simulate Backend Restart (re-instantiate storage instance and service from scratch)
  console.log('6. Simulating backend restart (re-instantiating storage and DB lookup)...');
  const freshStorage = createResumeStorage();
  const retrievedResume = await prisma.resume.findUnique({
    where: { id: uploaded.id }
  });

  assert.ok(retrievedResume, 'Resume must exist in DB after restart');
  assert.strictEqual(retrievedResume.isMaster, true, 'isMaster must persist across restart');
  assert.ok(retrievedResume.status === 'UPLOADED' || retrievedResume.status === 'PARSED', 'Status must be UPLOADED or PARSED');

  const downloadedAfterRestart = await freshStorage.download(retrievedResume.storageKey);
  assert.strictEqual(downloadedAfterRestart.length, testBuffer.length, 'Downloaded buffer length after restart must match original');
  assert.strictEqual(downloadedAfterRestart.toString('utf-8'), testBuffer.toString('utf-8'), 'Content after restart must match original');
  console.log('   Post-restart resume bytes retrieval verified: PASS');

  // Step 7: Verify Application Agent / Recommendation can select it
  console.log('7. Verifying Application Agent can select Preferred Resume...');
  const activeProfile = await prisma.candidateProfile.findUnique({
    where: { id: profileId },
    include: { resumes: true }
  });
  const selectedResume = activeProfile?.resumes.find(r => r.isMaster);
  assert.ok(selectedResume, 'Application Agent must find the master resume');
  assert.strictEqual(selectedResume.id, uploaded.id, 'Application Agent must select the exact preferred resume');
  console.log('   Application Agent selection verified: PASS');

  console.log('\n=== ALL RESUME PERSISTENCE TESTS PASSED SUCCESSFULLY! ===');
  await prisma.$disconnect();
}

testPersistence().catch(err => {
  console.error('Persistence test failed:', err);
  process.exit(1);
});
