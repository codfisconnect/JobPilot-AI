import type { Readable } from 'node:stream';

export interface StorageUploadResult {
  storageKey: string;
  storageProvider: string;
  byteSize: number;
}

export interface IResumeStorage {
  upload(fileBuffer: Buffer, originalFilename: string, mimeType: string): Promise<StorageUploadResult>;
  download(storageKey: string): Promise<Buffer>;
  delete(storageKey: string): Promise<boolean>;
  exists(storageKey: string): Promise<boolean>;
  getStream?(storageKey: string): Promise<Readable>;
}
