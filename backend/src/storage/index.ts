import type { IResumeStorage } from './resumeStorage.interface.js';
import { LocalResumeStorage } from './localResumeStorage.js';
import { S3ResumeStorage } from './s3ResumeStorage.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

export function createResumeStorage(): IResumeStorage {
  const configuredProvider = process.env.RESUME_STORAGE_PROVIDER || env.STORAGE_PROVIDER || 'local';
  const provider = configuredProvider === 'durable' ? (process.env.STORAGE_PROVIDER || 's3') : configuredProvider;

  if (provider === 's3' || provider === 'r2' || configuredProvider === 'durable') {
    if (!env.STORAGE_BUCKET || !env.STORAGE_ACCESS_KEY || !env.STORAGE_SECRET_KEY) {
      if (env.NODE_ENV === 'production') {
        logger.error('CRITICAL: STORAGE_PROVIDER is set to persistent object storage (' + provider + ') but required credentials (STORAGE_BUCKET, STORAGE_ACCESS_KEY, STORAGE_SECRET_KEY) are missing!');
      } else {
        logger.warn('Object storage credentials not configured, falling back to LocalResumeStorage for development.');
        return new LocalResumeStorage();
      }
    }

    logger.info(`Initialized persistent object storage provider: ${provider.toUpperCase()} (Bucket: ${env.STORAGE_BUCKET || 'N/A'})`);
    return new S3ResumeStorage({
      endpoint: env.STORAGE_ENDPOINT || undefined,
      bucket: env.STORAGE_BUCKET || '',
      region: env.STORAGE_REGION || 'auto',
      accessKeyId: env.STORAGE_ACCESS_KEY || '',
      secretAccessKey: env.STORAGE_SECRET_KEY || ''
    });
  }

  // Default to Local filesystem storage
  if (env.NODE_ENV === 'production') {
    logger.warn('NOTICE: Resume storage is currently configured to LOCAL filesystem. In ephemeral cloud containers, configure STORAGE_PROVIDER=s3 or r2 with object storage credentials to guarantee persistence across redeployments.');
  }

  return new LocalResumeStorage();
}

export const resumeStorage: IResumeStorage = createResumeStorage();
export { LocalResumeStorage } from './localResumeStorage.js';
export { S3ResumeStorage } from './s3ResumeStorage.js';
export * from './resumeStorage.interface.js';
