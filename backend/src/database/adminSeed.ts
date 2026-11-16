import { prisma } from './prisma.js';
import { env } from '../config/env.js';
import { hashPassword } from '../utils/password.js';
import { logger } from '../utils/logger.js';
import { UserRole } from '@prisma/client';

export interface AdminProvisionResult {
  email: string;
  action: 'created' | 'promoted' | 'password_updated' | 'unchanged';
  role: UserRole;
  emailVerified: boolean;
  isActive: boolean;
}

/**
 * Trusted server-side admin provisioning and password reset utility.
 *
 * @param options.forcePasswordReset If true, intentionally updates the administrator password
 *                                  hash with ADMIN_PASSWORD and revokes active refresh tokens.
 *                                  If false, preserves existing credentials and only ensures
 *                                  the account exists with role ADMIN, emailVerified=true, isActive=true.
 */
export async function provisionAdministrator(options: { forcePasswordReset?: boolean } = {}): Promise<AdminProvisionResult> {
  const adminEmail = (process.env.ADMIN_EMAIL || env.ADMIN_EMAIL).toLowerCase().trim();
  const adminPassword = process.env.ADMIN_PASSWORD || env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be configured in environment');
  }

  if (adminPassword.length < 8) {
    throw new Error('ADMIN_PASSWORD must be at least 8 characters long');
  }

  const existing = await prisma.user.findUnique({
    where: { email: adminEmail }
  });

  if (existing) {
    const shouldUpdateRole = existing.role !== UserRole.ADMIN || !existing.emailVerified || !existing.isActive;
    const shouldUpdatePassword = Boolean(options.forcePasswordReset);

    if (shouldUpdateRole || shouldUpdatePassword) {
      const updateData: any = {
        role: UserRole.ADMIN,
        emailVerified: true,
        isActive: true
      };

      if (shouldUpdatePassword) {
        updateData.passwordHash = await hashPassword(adminPassword);
        // Revoke all existing sessions for this administrator
        await prisma.refreshToken.deleteMany({
          where: { userId: existing.id }
        });
      }

      await prisma.user.update({
        where: { id: existing.id },
        data: updateData
      });

      logger.info(`[AdminProvision] Administrator ${adminEmail} updated (role: ADMIN, passwordUpdated: ${shouldUpdatePassword})`);
      return {
        email: adminEmail,
        action: shouldUpdatePassword ? 'password_updated' : 'promoted',
        role: UserRole.ADMIN,
        emailVerified: true,
        isActive: true
      };
    }

    return {
      email: adminEmail,
      action: 'unchanged',
      role: existing.role as UserRole,
      emailVerified: existing.emailVerified,
      isActive: existing.isActive
    };
  }

  // Create brand new administrator account
  const hashedPassword = await hashPassword(adminPassword);
  await prisma.user.create({
    data: {
      email: adminEmail,
      passwordHash: hashedPassword,
      role: UserRole.ADMIN,
      emailVerified: true,
      isActive: true
    }
  });

  logger.info(`[AdminProvision] Provisioned initial administrator account: ${adminEmail}`);
  return {
    email: adminEmail,
    action: 'created',
    role: UserRole.ADMIN,
    emailVerified: true,
    isActive: true
  };
}

/**
 * Backward-compatible bootstrap helper: only provisions or promotes the role without
 * resetting existing administrator passwords on application startup.
 */
export async function provisionDefaultAdmin(): Promise<void> {
  try {
    // Startup bootstrap only ensures the account exists and has role=ADMIN, emailVerified=true.
    // It NEVER resets an existing administrator's password on startup.
    await provisionAdministrator({ forcePasswordReset: false });
  } catch (err: any) {
    logger.warn('Notice in startup admin check:', { error: err.message });
  }
}
