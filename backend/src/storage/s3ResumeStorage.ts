import crypto from 'node:crypto';
import path from 'node:path';
import type { IResumeStorage, StorageUploadResult, StorageHealthStatus } from './resumeStorage.interface.js';
import { ResumeFileMissingError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export interface S3StorageConfig {
  endpoint?: string;
  bucket: string;
  region?: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export class S3ResumeStorage implements IResumeStorage {
  public readonly providerName = 's3';
  private readonly config: S3StorageConfig;

  constructor(config: S3StorageConfig) {
    this.config = {
      ...config,
      region: config.region || 'auto'
    };
  }

  /**
   * Helper to sign an AWS SigV4 request using node standard crypto
   */
  private signRequest(
    method: string,
    canonicalUri: string,
    queryParams: Record<string, string>,
    headers: Record<string, string>,
    payloadHash: string
  ): { authorization: string; amzDate: string } {
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.substring(0, 8);
    const region = this.config.region || 'us-east-1';
    const service = 's3';

    headers['x-amz-date'] = amzDate;
    headers['x-amz-content-sha256'] = payloadHash;

    // Canonical query string
    const canonicalQuerystring = Object.keys(queryParams)
      .sort()
      .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(queryParams[k])}`)
      .join('&');

    // Canonical headers
    const sortedHeaderKeys = Object.keys(headers).map(k => k.toLowerCase()).sort();
    const canonicalHeaders = sortedHeaderKeys
      .map(k => `${k}:${headers[k].trim()}\n`)
      .join('');
    const signedHeaders = sortedHeaderKeys.join(';');

    // Canonical request
    const canonicalRequest = [
      method,
      canonicalUri,
      canonicalQuerystring,
      canonicalHeaders,
      signedHeaders,
      payloadHash
    ].join('\n');

    // String to sign
    const algorithm = 'AWS4-HMAC-SHA256';
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const stringToSign = [
      algorithm,
      amzDate,
      credentialScope,
      crypto.createHash('sha256').update(canonicalRequest).digest('hex')
    ].join('\n');

    // Signing key
    const kDate = crypto.createHmac('sha256', `AWS4${this.config.secretAccessKey}`).update(dateStamp).digest();
    const kRegion = crypto.createHmac('sha256', kDate).update(region).digest();
    const kService = crypto.createHmac('sha256', kRegion).update(service).digest();
    const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();

    const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');

    const authorization = `${algorithm} Credential=${this.config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    return { authorization, amzDate };
  }

  private getUrl(key: string): { url: string; host: string; path: string } {
    const rawEndpoint = this.config.endpoint
      ? this.config.endpoint.replace(/\/+$/, '')
      : `https://${this.config.bucket}.s3.${this.config.region}.amazonaws.com`;

    let url: string;
    let host: string;
    let reqPath: string;

    if (this.config.endpoint) {
      const parsed = new URL(rawEndpoint);
      host = parsed.host;
      reqPath = `/${this.config.bucket}/${key}`;
      url = `${rawEndpoint}${reqPath}`;
    } else {
      const parsed = new URL(rawEndpoint);
      host = parsed.host;
      reqPath = `/${key}`;
      url = `${rawEndpoint}${reqPath}`;
    }

    return { url, host, path: reqPath };
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
    const { url, host, path: reqPath } = this.getUrl(storageKey);

    const headers: Record<string, string> = {
      Host: host,
      'Content-Type': mimeType || 'application/octet-stream',
      'Content-Length': String(fileBuffer.length)
    };

    const { authorization, amzDate } = this.signRequest('PUT', reqPath, {}, headers, payloadHash);

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        ...headers,
        Authorization: authorization,
        'x-amz-date': amzDate,
        'x-amz-content-sha256': payloadHash
      },
      body: new Uint8Array(fileBuffer)
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      logger.error('S3 upload failed:', { status: response.status, body: text });
      throw new Error(`S3 persistent storage upload failed with status ${response.status}`);
    }

    return {
      storageKey,
      storageProvider: this.providerName,
      byteSize: fileBuffer.length,
      checksum: payloadHash
    };
  }

  public async download(storageKey: string): Promise<Buffer> {
    const payloadHash = crypto.createHash('sha256').update('').digest('hex');
    const { url, host, path: reqPath } = this.getUrl(storageKey);

    const headers: Record<string, string> = {
      Host: host
    };

    const { authorization, amzDate } = this.signRequest('GET', reqPath, {}, headers, payloadHash);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        ...headers,
        Authorization: authorization,
        'x-amz-date': amzDate,
        'x-amz-content-sha256': payloadHash
      }
    });

    if (response.status === 404) {
      throw new ResumeFileMissingError();
    }

    if (!response.ok) {
      throw new Error(`S3 storage download failed with status ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  public async exists(storageKey: string): Promise<boolean> {
    try {
      const payloadHash = crypto.createHash('sha256').update('').digest('hex');
      const { url, host, path: reqPath } = this.getUrl(storageKey);

      const headers: Record<string, string> = {
        Host: host
      };

      const { authorization, amzDate } = this.signRequest('HEAD', reqPath, {}, headers, payloadHash);

      const response = await fetch(url, {
        method: 'HEAD',
        headers: {
          ...headers,
          Authorization: authorization,
          'x-amz-date': amzDate,
          'x-amz-content-sha256': payloadHash
        }
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  public async delete(storageKey: string): Promise<boolean> {
    try {
      const payloadHash = crypto.createHash('sha256').update('').digest('hex');
      const { url, host, path: reqPath } = this.getUrl(storageKey);

      const headers: Record<string, string> = {
        Host: host
      };

      const { authorization, amzDate } = this.signRequest('DELETE', reqPath, {}, headers, payloadHash);

      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          ...headers,
          Authorization: authorization,
          'x-amz-date': amzDate,
          'x-amz-content-sha256': payloadHash
        }
      });

      return response.ok || response.status === 404;
    } catch {
      return false;
    }
  }

  public async checkHealth(): Promise<StorageHealthStatus> {
    if (!this.config.bucket || !this.config.accessKeyId || !this.config.secretAccessKey) {
      return {
        status: 'UNAVAILABLE',
        provider: this.providerName,
        message: 'S3 persistent storage is missing credentials or bucket configuration'
      };
    }

    try {
      const exists = await this.exists('__healthcheck_nonexistent_key__');
      return {
        status: 'READY',
        provider: this.providerName,
        bucket: this.config.bucket,
        message: 'Persistent S3 object storage is operational and reachable'
      };
    } catch (err: any) {
      return {
        status: 'DEGRADED',
        provider: this.providerName,
        bucket: this.config.bucket,
        message: `Persistent S3 storage connectivity check error: ${err.message}`
      };
    }
  }
}
