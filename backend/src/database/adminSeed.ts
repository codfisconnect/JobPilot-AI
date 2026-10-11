import { prisma } from './prisma.js';
import { env } from '../config/env.js';
import { hashPassword } from '../utils/password.js';
import { logger } from '../utils/logger.js';
import { UserRole } from '@prisma/client';

export async function provisionDefaultAdmin(): Promise<void> {
  const adminEmail = env.ADMIN_EMAIL.toLowerCase();

  try {
    const existing = await prisma.user.findUnique({
      where: { email: adminEmail }
    });

    if (existing) {
      if (existing.role !== UserRole.ADMIN) {
        await prisma.user.update({
          where: { id: existing.id },
          data: { role: UserRole.ADMIN, emailVerified: true }
        });
        logger.info(`Updated existing user ${adminEmail} to ADMIN role.`);
      }
      return;
    }

    const hashedPassword = await hashPassword(env.ADMIN_PASSWORD);

    await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash: hashedPassword,
        role: UserRole.ADMIN,
        emailVerified: true
      }
    });

    logger.info(`Provisioned default administrator account: ${adminEmail}`);
  } catch (err: any) {
    logger.warn('Notice provisioning admin account (will retry on next startup):', {
      error: err.message
    });
  }
}
