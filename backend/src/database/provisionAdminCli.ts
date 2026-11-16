#!/usr/bin/env node

/**
 * CLI Tool for Dedicated Administrator Provisioning and Password Rotation
 *
 * Usage:
 *   npx tsx src/database/provisionAdminCli.ts [--force-reset]
 *
 * Flags:
 *   --force-reset   Intentionally rotates the password of an existing administrator account
 *                   using ADMIN_PASSWORD and revokes all active refresh tokens.
 *   (default)       Idempotently ensures the administrator account exists with role ADMIN.
 *                   Preserves the existing password if the account already exists.
 */

import { provisionAdministrator } from './adminSeed.js';
import { prisma } from './prisma.js';

async function runCli() {
  const args = process.argv.slice(2);
  const forcePasswordReset = args.includes('--force-reset') || args.includes('-f');

  console.log('--- JobPilot AI Administrator Provisioning CLI ---');
  console.log(`Mode: ${forcePasswordReset ? 'FORCE PASSWORD RESET & SESSION REVOCATION' : 'ENSURE ACCOUNT & ROLE (PRESERVE PASSWORD)'}`);

  try {
    const result = await provisionAdministrator({ forcePasswordReset });
    console.log('\nResult:');
    console.log(`  Admin Email:     ${result.email}`);
    console.log(`  Assigned Role:   ${result.role}`);
    console.log(`  Email Verified:  ${result.emailVerified}`);
    console.log(`  Account Active:  ${result.isActive}`);
    console.log(`  Action Taken:    ${result.action}`);
    console.log('\nAdministrator provisioning completed successfully.');
  } catch (err: any) {
    console.error('\n❌ Administrator provisioning failed:', err.message);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

runCli();

