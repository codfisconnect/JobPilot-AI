# Security, Privacy, and Compliance Specification

> **Document Status**: Production Baseline Specification  
> **Target Version**: Pilot Mama V1.0  
> **Location**: `docs/architecture/security.md`  

---

## 1. Security Core Principles

Security and candidate data privacy are foundational pillars of the Pilot Mama platform.
1. **Confidentiality of Candidate Artifacts**: Resumes contain sensitive Personally Identifiable Information (PII) including phone numbers, physical addresses, past employers, and educational history. Candidate documents are private by default and never accessible via unauthenticated URLs.
2. **Zero Plaintext Secrets**: API keys, database credentials, and payment secrets must never reside in client bundles or public git repositories.
3. **Defense in Depth**: Security controls operate across the Network, Application Gateway, Data Access, and Storage layers.

---

## 2. Authentication & Session Management

- **Password Hashing**: Passwords must be hashed using **Argon2id** (or Bcrypt with cost factor 12). Plaintext passwords are never stored, logged, or cached.
- **JWT Architecture**:
  - **Access Tokens**: Short-lived (15 minutes), digitally signed with HMAC-SHA256 or asymmetric RS256, carrying user ID and role claims.
  - **Refresh Tokens**: Long-lived (7 days), stored in the database with cryptographically random entropy, revocable on demand.
  - **Storage**: In web browsers, refresh tokens are delivered via `httpOnly`, `Secure`, `SameSite=Strict` cookies to eliminate XSS token theft.
- **Brute Force & Rate Limiting**:
  - Authentication endpoints (`/auth/login`, `/auth/register`, `/auth/forgot-password`) enforce strict rate limits: maximum 5 failed attempts per IP within a 15-minute rolling window before a cooldown lock is triggered.

---

## 3. Authorization & Multi-Tenant Data Isolation

- **Role-Based Access Control (RBAC)**: All protected routes enforce middleware checks verifying the caller possesses required role claims (`ROLE_CANDIDATE`, `ROLE_EMPLOYER`, `ROLE_ADMIN`).
- **Resource Ownership Verification**: Every query accessing candidate-specific entities (e.g. `resumes`, `applications`, `preferences`) enforces tenant boundary checks at the repository layer:
  ```sql
  SELECT * FROM resumes WHERE id = $1 AND candidate_id = $2;
  ```
  A user cannot view, modify, or delete another user's documents even if they guess or brute-force the UUID.

---

## 4. File Upload & Document Security

Candidate resumes (PDF, DOCX, TXT) represent a significant threat vector if unconstrained (malware, buffer overflow exploits, server-side request forgery).

### Upload Controls:
1. **Strict File Size Limits**: Enforced at reverse proxy and Multer middleware layer: maximum 10MB per document.
2. **MIME Type & Magic Number Validation**: Files are inspected using file signature magic numbers (`%PDF-`, `PK\x03\x04` for docx) rather than blindly trusting the user's uploaded file extension or declared `Content-Type`.
3. **Private Object Storage with Pre-Signed URLs**:
   - Files are stored in private Cloudflare R2 / AWS S3 buckets with public access completely disabled.
   - Resumes and generated PDFs are downloaded exclusively through time-limited (15-minute TTL) cryptographic pre-signed URLs generated server-side.
4. **Filename Sanitization**: Uploaded files are stripped of dangerous path traversal characters (`../`, null bytes) and saved with unique internal UUID keys.

---

## 5. API Gateway & Network Protections

- **CORS Configuration**: Restricts API calls to explicitly allowed frontend origins (e.g., `https://app.pilotmama.com` in production; `http://localhost:5173` in local development).
- **Security Headers (Helmet)**: Enforces `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Strict-Transport-Security` (HSTS), and disables `X-Powered-By`.
- **Input Sanitization & Injection Prevention**:
  - SQL Injection is prevented by parameterized queries via node-postgres (`pg`) or Prisma. Raw string concatenations are banned.
  - XSS is prevented by Zod sanitization and React's automatic DOM text encoding.

---

## 6. AI Secret & Upstream Protection

- **No Frontend Exposure**: Upstream AI API keys (`GEMINI_API_KEY`, `OPENAI_API_KEY`) are stored purely in server-side environment variables and are never surfaced to the browser.
- **Prompt Injection Defense**: User-supplied input (e.g. raw resume text or pasted job descriptions) is sanitized and enclosed in structured delimiters with strict system role framing to prevent prompt hijacking attacks.

---

## 7. Audit Logging & Compliance (GDPR / CCPA)

- **Immutable Audit Trail**: Security-relevant actions (password updates, role escalations, document deletions, administrative overrides) are recorded in the `audit_logs` table with actor ID, IP address, user agent, and timestamp.
- **Right to Erasure (GDPR)**: When a candidate deletes their account (`DELETE /api/v1/users/:id`), all associated personal records in `candidate_profiles`, `resumes`, `experiences`, `applications`, and physical files in object storage are purged or anonymized.
