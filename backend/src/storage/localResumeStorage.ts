import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import type { IResumeStorage, StorageUploadResult, StorageHealthStatus } from './resumeStorage.interface.js';
import { NotFoundError, ResumeFileMissingError } from '../utils/errors.js';

export class LocalResumeStorage implements IResumeStorage {
  private readonly storageDir: string;
  public readonly providerName = 'local';

  constructor(customStorageDir?: string) {
    // Default to private backend/storage/resumes/
    this.storageDir = customStorageDir || path.resolve(process.cwd(), 'storage', 'resumes');
  }

  private async ensureDir(): Promise<void> {
    await fs.mkdir(this.storageDir, { recursive: true });
  }

  public async upload(
    fileBuffer: Buffer,
    originalFilename: string,
    _mimeType: string,
    options?: { candidateId?: string }
  ): Promise<StorageUploadResult> {
    await this.ensureDir();

    const ext = path.extname(originalFilename).toLowerCase();
    const candidatePrefix = options?.candidateId ? `${options.candidateId.replace(/[^a-zA-Z0-9_-]/g, '')}_` : '';
    const uniqueKey = `${candidatePrefix}${crypto.randomUUID()}${ext}`;
    const targetPath = path.join(this.storageDir, uniqueKey);

    await fs.writeFile(targetPath, fileBuffer);

    const checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    return {
      storageKey: uniqueKey,
      storageProvider: this.providerName,
      byteSize: fileBuffer.length,
      checksum
    };
  }

  public async download(storageKey: string): Promise<Buffer> {
    // Prevent path traversal
    const safeKey = path.basename(storageKey);
    const targetPath = path.join(this.storageDir, safeKey);

    try {
      return await fs.readFile(targetPath);
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        throw new ResumeFileMissingError();
      }
      throw err;
    }
  }

  public async delete(storageKey: string): Promise<boolean> {
    const safeKey = path.basename(storageKey);
    const targetPath = path.join(this.storageDir, safeKey);

    try {
      await fs.unlink(targetPath);
      return true;
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        return false;
      }
      throw err;
    }
  }

  public async exists(storageKey: string): Promise<boolean> {
    const safeKey = path.basename(storageKey);
    const targetPath = path.join(this.storageDir, safeKey);

    try {
      await fs.access(targetPath);
      return true;
    } catch {
      return false;
    }
  }

  public async checkHealth(): Promise<StorageHealthStatus> {
    try {
      await this.ensureDir();
      const testFile = path.join(this.storageDir, `.health_${Date.now()}`);
      await fs.writeFile(testFile, 'health-check');
      await fs.unlink(testFile);
      return { status: 'READY', provider: this.providerName, message: 'Local filesystem storage is operational' };
    } catch (err: any) {
      return { status: 'UNAVAILABLE', provider: this.providerName, message: `Local storage check failed: ${err.message}` };
    }
  }
}

export const resumeStorage: IResumeStorage = new LocalResumeStorage();
