# API Architecture Specification

> **Document Status**: Production Baseline Specification  
> **Target Version**: Pilot Mama V1.0  
> **Base URL**: `/api/v1`  
> **Location**: `docs/architecture/api-architecture.md`  

---

## 1. Global API Standards

- **Protocol**: HTTPS / TLS 1.3 only.
- **Data Exchange**: JSON (`Content-Type: application/json`) for all standard endpoints; multipart/form-data for document uploads.
- **Authentication**: Stateless Bearer tokens (JWT) passed via `Authorization: Bearer <token>` header.
- **Validation**: All request bodies, query strings, and path params validated using strict Zod schemas before hitting controllers.
- **Standard Envelope**:
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "requestId": "req_8f14c29d",
    "timestamp": "2026-10-05T19:00:00.000Z"
  }
}
```
- **Standard Error Envelope**:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Invalid email address provided",
    "details": [
      { "field": "email", "issue": "Invalid format" }
    ]
  },
  "meta": {
    "requestId": "req_8f14c29d",
    "timestamp": "2026-10-05T19:00:00.000Z"
  }
}
```

---

## 2. API Endpoint Groups

### 2.1. Authentication & Identity (`/api/v1/auth`)
*Purpose: Handle user credential verification, session token issuance, and password recovery.*

| Method | Endpoint | Description | Auth Required | Permissions |
| :--- | :--- | :--- | :---: | :---: |
| `POST` | `/auth/register` | Register new user account (Candidate/Employer) | No | Public |
| `POST` | `/auth/login` | Authenticate with email/password; returns JWT | No | Public |
| `POST` | `/auth/refresh` | Exchange refresh token for fresh JWT access token | No (Refresh Token) | Public |
| `POST` | `/auth/logout` | Invalidate active session/token | Yes | Any Authenticated |
| `POST` | `/auth/forgot-password` | Request password reset verification link | No | Public |
| `POST` | `/auth/reset-password` | Reset password using verified reset token | No | Public |
| `GET` | `/auth/me` | Fetch active authenticated identity & permissions | Yes | Any Authenticated |

---

### 2.2. Users & Account Management (`/api/v1/users`)
*Purpose: Manage user credentials, communication preferences, and security settings.*

| Method | Endpoint | Description | Auth Required | Permissions |
| :--- | :--- | :--- | :---: | :---: |
| `GET` | `/users/:id` | Fetch user account metadata | Yes | User Self / Admin |
| `PUT` | `/users/:id` | Update email, profile preferences, or theme | Yes | User Self / Admin |
| `PUT` | `/users/:id/password` | Update existing user password | Yes | User Self |
| `DELETE` | `/users/:id` | Delete account & request GDPR data purge | Yes | User Self / Admin |

---

### 2.3. Candidates & Profiles (`/api/v1/candidates`)
*Purpose: Master structured profile management, career preferences, and personal portfolios.*

| Method | Endpoint | Description | Auth Required | Permissions |
| :--- | :--- | :--- | :---: | :---: |
| `GET` | `/candidates/me` | Retrieve authenticated candidate's structured profile | Yes | Candidate |
| `PUT` | `/candidates/me` | Update master profile info (bio, contact links) | Yes | Candidate |
| `GET` | `/candidates/me/preferences` | Retrieve job search criteria (roles, locations, salary) | Yes | Candidate |
| `PUT` | `/candidates/me/preferences` | Save candidate job hunting preferences | Yes | Candidate |
| `POST` | `/candidates/upload` | Upload resume file (PDF/DOCX) for auto-parsing | Yes | Candidate |
| `POST` | `/candidates/me/skills` | Add verified skill to candidate profile | Yes | Candidate |
| `DELETE` | `/candidates/me/skills/:id` | Remove skill from profile | Yes | Candidate |

---

### 2.4. Resumes & Versioning (`/api/v1/resumes`)
*Purpose: Manage master resume artifacts, AI tailoring generations, and document exports.*

| Method | Endpoint | Description | Auth Required | Permissions |
| :--- | :--- | :--- | :---: | :---: |
| `GET` | `/resumes` | List candidate's master and derived resumes | Yes | Candidate |
| `GET` | `/resumes/:id` | Fetch full structured resume document | Yes | Candidate / Admin |
| `POST` | `/resumes/tailor` | Generate targeted resume draft for specific job | Yes | Candidate |
| `POST` | `/resumes/validate` | Run Zero-Fabrication & Company Leakage validation | Yes | Candidate |
| `POST` | `/resumes/export` | Compile resume version into formatted PDF or DOCX | Yes | Candidate |
| `GET` | `/resumes/versions/:candidateId` | List tailored versions generated for a candidate | Yes | Candidate / Admin |
| `POST` | `/resumes/versions` | Persist finalized tailored resume version | Yes | Candidate |

---

### 2.5. Jobs & Ingestion (`/api/v1/jobs`)
*Purpose: Search, filter, inspect canonical jobs, and manage ingestion sources.*

| Method | Endpoint | Description | Auth Required | Permissions |
| :--- | :--- | :--- | :---: | :---: |
| `GET` | `/jobs` | Search canonical job listings with multi-filter query | Yes | Candidate / Employer |
| `GET` | `/jobs/:id` | Fetch comprehensive details for single job vacancy | Yes | Any Authenticated |
| `POST` | `/jobs/extract-url` | Parse external job posting directly from URL | Yes | Candidate / Admin |
| `POST` | `/jobs/parse` | Ingest raw text job description into structured job | Yes | Candidate / Admin |
| `GET` | `/jobs/sources` | List configured corporate job ingestion sources | Yes | Admin / Recruiter |
| `GET` | `/jobs/source-health` | View telemetry and crawl success rates by source | Yes | Admin |
| `POST` | `/jobs/sync-source` | Manually trigger synchronization crawl for source | Yes | Admin |

---

### 2.6. Companies Registry (`/api/v1/companies`)
*Purpose: Browse employer profiles, brand metadata, and associated vacancies.*

| Method | Endpoint | Description | Auth Required | Permissions |
| :--- | :--- | :--- | :---: | :---: |
| `GET` | `/companies` | Query verified company directory | Yes | Any Authenticated |
| `GET` | `/companies/:id` | View company profile and published jobs | Yes | Any Authenticated |
| `POST` | `/companies` | Register or claim company profile | Yes | Employer / Admin |
| `PUT` | `/companies/:id` | Update company branding, logo, and links | Yes | Employer (Owner) / Admin |

---

### 2.7. Matching, Strategy, & Skill Gaps (`/api/v1/matching`)
*Purpose: Deconstruct compatibility, calculate dual match scores, and outline learning roadmaps.*

| Method | Endpoint | Description | Auth Required | Permissions |
| :--- | :--- | :--- | :---: | :---: |
| `POST` | `/matching/analyze` | Calculate ATS & Semantic Match score against job | Yes | Candidate |
| `GET` | `/matching/:candidateId/:jobId` | Retrieve cached match evaluation | Yes | Candidate / Admin |
| `POST` | `/matching/strategy` | Synthesize positioning strategy for application | Yes | Candidate |
| `GET` | `/matching/skill-gaps/:jobId` | Deconstruct missing skills into bridge categories | Yes | Candidate |

---

### 2.8. Application Tracking (`/api/v1/applications`)
*Purpose: Manage application states, Kanban transitions, and immutable timeline logs.*

| Method | Endpoint | Description | Auth Required | Permissions |
| :--- | :--- | :--- | :---: | :---: |
| `GET` | `/applications` | List candidate's tracked job applications | Yes | Candidate |
| `GET` | `/applications/:id` | Fetch application details and audit event timeline | Yes | Candidate |
| `POST` | `/applications` | Create or update tracked application card | Yes | Candidate |
| `DELETE` | `/applications/:id` | Archive or delete tracked application | Yes | Candidate |
| `DELETE` | `/applications` | Remove application by candidateId and jobId | Yes | Candidate |

---

### 2.9. Learning, Institutes, & Interview Prep (`/api/v1/learning` & `/api/v1/interview`)
*Purpose: Connect candidates with skill bridges, accredited courses, and interview simulators.*

| Method | Endpoint | Description | Auth Required | Permissions |
| :--- | :--- | :--- | :---: | :---: |
| `GET` | `/learning/resources` | Query learning resources mapped to skills | Yes | Any Authenticated |
| `GET` | `/learning/institutes` | List partner educational institutes & bootcamps | Yes | Any Authenticated |
| `POST` | `/interview/generate` | Generate targeted interview questions & STAR prep | Yes | Candidate |
| `GET` | `/interview/:candidateId/:jobId` | Retrieve saved interview prep session | Yes | Candidate |

---

### 2.10. Admin & Telemetry (`/api/v1/admin`)
*Purpose: Platform oversight, AI token analytics, user management, and security audit.*

| Method | Endpoint | Description | Auth Required | Permissions |
| :--- | :--- | :--- | :---: | :---: |
| `GET` | `/admin/metrics` | System health, active users, DB pool stats | Yes | Admin |
| `GET` | `/admin/ai/usage` | Token burn, cost by operation, fallback rates | Yes | Admin |
| `GET` | `/admin/audit-logs` | Query security and administrative action logs | Yes | Admin |
| `PUT` | `/admin/users/:id/role` | Escalate or demote user account role | Yes | Admin |
