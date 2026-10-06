# Architecture: Resume Storage & Vault

## 1. Overview
The **Resume Storage Subsystem** provides private, secure, and extensible binary storage for candidate resumes uploaded to Pilot Mama. It implements strict validation against forged file extensions and ensures candidate documents are stored privately without exposing absolute local filesystem paths or granting public unauthenticated access.

---

## 2. Abstraction: `IResumeStorage`
To decouple business logic from underlying filesystem or cloud storage, all resume operations interact via `IResumeStorage`:

```typescript
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
```

### Implementations:
1. **`LocalResumeStorage` (Development / On-Premise)**:
   - Resides in `backend/storage/resumes/`.
   - Explicitly ignored by Git (`.gitignore`).
   - Generates collision-resistant UUID storage keys (`<uuid>.pdf`, `<uuid>.docx`).
   - Defends against directory traversal via strict `path.basename` normalization.
2. **`S3ResumeStorage` / `CloudflareR2ResumeStorage` (Production Ready)**:
   - Future cloud adapter targeting private buckets with presigned short-lived access links.

---

## 3. Upload & File Validation Pipeline
Resume uploads enforce multi-layered defense:

```
Upload (Multer Memory Storage)
       │
       ▼
FileValidationService
 ├─ Size Check (< 10MB limit)
 ├─ Magic Number Verification (%PDF-, PK\x03\x04 for DOCX)
 └─ Filename Sanitization (strip illegal chars, path traversal tokens)
       │
       ▼
IResumeStorage.upload()
 └─ Generates safe UUID storage key
       │
       ▼
PostgreSQL / Prisma Resume Entity
 └─ Status: UPLOADED
```

---

## 4. Privacy & Audit Protection
- Resume binaries are never committed to version control.
- Resumes are strictly owned by their respective `CandidateProfile`.
- Direct file access routes require valid Bearer JWT tokens and verify ownership. Cross-candidate access returns `404 Not Found`.
- Logging suppresses raw document text payloads.
