import { BadRequestError } from '../utils/errors.js';

export const MAX_RESUME_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export interface FileValidationResult {
  isValid: boolean;
  detectedMimeType: string;
  detectedExtension: string;
  sanitizedFilename: string;
}

export class FileValidationService {
  /**
   * Validate magic numbers (file signatures) to verify real document type
   */
  public static validateMagicNumber(buffer: Buffer): { mime: string; ext: string } | null {
    if (!buffer || buffer.length < 4) {
      return null;
    }

    // PDF signature: %PDF (25 50 44 46)
    if (
      buffer[0] === 0x25 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x44 &&
      buffer[3] === 0x46
    ) {
      return { mime: 'application/pdf', ext: '.pdf' };
    }

    // DOCX signature: PK\x03\x04 (50 4b 03 04 - Zip archive header used by docx)
    if (
      buffer[0] === 0x50 &&
      buffer[1] === 0x4b &&
      buffer[2] === 0x03 &&
      buffer[3] === 0x04
    ) {
      return {
        mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ext: '.docx'
      };
    }

    // TXT check: All UTF-8 / printable ASCII characters
    const isText = buffer.slice(0, Math.min(512, buffer.length)).every(byte => {
      return byte === 9 || byte === 10 || byte === 13 || (byte >= 32 && byte <= 126);
    });

    if (isText) {
      return { mime: 'text/plain', ext: '.txt' };
    }

    return null;
  }

  public static sanitizeFilename(filename: string): string {
    const base = filename.replace(/[/\\?%*:|"<>]/g, '_').trim();
    return base.length > 0 ? base.slice(0, 100) : 'resume_document';
  }

  public static validateUpload(file: Express.Multer.File | undefined): FileValidationResult {
    if (!file || !file.buffer) {
      throw new BadRequestError('No resume file provided in upload');
    }

    if (file.buffer.length > MAX_RESUME_SIZE_BYTES) {
      throw new BadRequestError(`File exceeds maximum permitted size of ${MAX_RESUME_SIZE_BYTES / (1024 * 1024)}MB`);
    }

    const detected = this.validateMagicNumber(file.buffer);
    if (!detected) {
      throw new BadRequestError('Unsupported or invalid file format. Only valid PDF, DOCX, and TXT files are accepted.');
    }

    const sanitizedFilename = this.sanitizeFilename(file.originalname || `resume${detected.ext}`);

    return {
      isValid: true,
      detectedMimeType: detected.mime,
      detectedExtension: detected.ext,
      sanitizedFilename
    };
  }
}
