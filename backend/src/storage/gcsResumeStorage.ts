import crypto from 'node:crypto';
import path from 'node:path';
import { Storage, Bucket } from '@google-cloud/storage';
import type { IResumeStorage, StorageUploadResult, StorageHealthStatus } from './resumeStorage.interface.js';
import { ResumeFileMissingError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export interface GCSStorageConfig {
  bucket: string;
}

export class GCSResumeStorage implements IResumeStorage {
  public readonly providerName = 'gcs';
  private readonly storage: Storage;
  private readonly bucketName: string;
  private readonly bucket: Bucket;

  constructor(config: GCSStorageConfig) {
    this.bucketName = config.bucket;
    // Uses Google Cloud Application Default Credentials (ADC) / Cloud Run service identity
    this.storage = new Storage();
    this.bucket = this.storage.bucket(this.bucketName);
  }

  public async upload(
    fileBuffer: Buffer,
    originalFilename: string,
    mimeType: string,
    options?: { candidateId?: string }
  ): Promise<StorageUploadResult> {
    const ext = path.extname(originalFilename).toLowerCase();
    const candidatePrefix = options?.candidateId ? `${options.candidateId.replace(/[^a-zA-Z0-9_-]/g, '')}/` : '';
    const storageKey = `resumes/${candidatePrefix}${crypto.randomUUID()}${ext}`;

    const payloadHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    const file = this.bucket.file(storageKey);

    try {
      await file.save(fileBuffer, {
        contentType: mimeType || 'application/octet-stream',
        resumable: false,
        metadata: {
          cacheControl: 'private, max-age=3600',
          metadata: {
            originalFilename,
            sha256: payloadHash
          }
        }
      });

      return {
        storageKey,
        storageProvider: this.providerName,
        byteSize: fileBuffer.length,
        checksum: payloadHash
      };
    } catch (err: any) {
      logger.error('Google Cloud Storage upload failed:', {
        bucket: this.bucketName,
        storageKey,
        error: err.message
      });
      throw new Error(`GCS persistent storage upload failed: ${err.message}`);
    }
  }

  public async download(storageKey: string): Promise<Buffer> {
    const file = this.bucket.file(storageKey);

    try {
      const [contents] = await file.download();
      return contents;
    } catch (err: any) {
      if (err.code === 404 || err.message?.includes('No such object')) {
        throw new ResumeFileMissingError();
      }
      logger.error('Google Cloud Storage download failed:', {
        bucket: this.bucketName,
        storageKey,
        error: err.message
      });
      throw new Error(`GCS storage download failed: ${err.message}`);
    }
  }

  public async exists(storageKey: string): Promise<boolean> {
    try {
      const file = this.bucket.file(storageKey);
      const [exists] = await file.exists();
      return exists;
    } catch {
      return false;
    }
  }

  public async delete(storageKey: string): Promise<boolean> {
    try {
      const file = this.bucket.file(storageKey);
      await file.delete({ ignoreNotFound: true });
      return true;
    } catch (err: any) {
      if (err.code === 404) return true;
      logger.error('Google Cloud Storage delete failed:', {
        bucket: this.bucketName,
        storageKey,
        error: err.message
      });
      return false;
    }
  }

  public async checkHealth(): Promise<StorageHealthStatus> {
    if (!this.bucketName) {
      return {
        status: 'UNAVAILABLE',
        provider: this.providerName,
        message: 'Google Cloud Storage is missing STORAGE_BUCKET configuration'
      };
    }

    try {
      const exists = await this.exists('__healthcheck_nonexistent_key__');
      return {
        status: 'READY',
        provider: this.providerName,
        bucket: this.bucketName,
        message: 'Google Cloud Storage is operational and reachable via Cloud Run Service Identity'
      };
    } catch (err: any) {
      return {
        status: 'DEGRADED',
        provider: this.providerName,
        bucket: this.bucketName,
        message: `Google Cloud Storage connectivity check error: ${err.message}`
      };
    }
  }
}

