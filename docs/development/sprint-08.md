# Sprint 8: Employer & Recruiter Platform Architecture Blueprint (Pilot Mama V1)

## Executive Summary
Sprint 8 builds the multi-tenant Employer & Recruiter platform on top of the Pilot Mama V1 modular monolith without breaking the existing candidate platform or public job engine.

---

## 1. Architecture Audit & Integration Boundary

### 1.1 Existing Foundations Reused
- **Authentication**: Reuses existing `User` model (`role: EMPLOYER`). Zero duplicate auth systems. JWT authentication via `authenticateJwt` provides `req.user.userId` and `req.user.role`.
- **Company Registry**: Links `EmployerOrganization` to canonical `Company` records. Enables verified company branding and official domains without duplicating company identities.
- **Job Engine**: Extends `Job` to support `organizationId` and `organizationJobStatus` (`DRAFT`, `PUBLISHED`, `PAUSED`, `CLOSED`), preserving public ingestion pipelines while tracking employer-owned jobs.
- **Application Engine**: Employers access applications submitted specifically to their organization's jobs via `Application`. Candidate privacy is protected by scoping candidate visibility to submitted `ResumeVersion` and basic applicant profile information.

### 1.2 Tenant Isolation & Security
- Every employer query is scoped by the user's `EmployerMember.organizationId`.
- Cross-tenant IDOR is strictly blocked: Organization A can never query, edit, or access Organization B's jobs, applicants, notes, or team members.
- Role-based permissions (`OWNER`, `ADMIN`, `RECRUITER`, `HIRING_MANAGER`) govern access to organization management, job posting, and applicant pipeline actions.

---

## 2. Domain & Data Model Design (Prisma)

### 2.1 Enums
```prisma
enum EmployerRole {
  OWNER
  ADMIN
  RECRUITER
  HIRING_MANAGER
}

enum EmployerJobStatus {
  DRAFT
  PUBLISHED
  PAUSED
  CLOSED
}

enum EmployerApplicationStage {
  NEW
  SCREENING
  INTERVIEW
  OFFER
  HIRED
  REJECTED
  ARCHIVED
}

enum VerificationStatus {
  UNVERIFIED
  PENDING
  VERIFIED
  REJECTED
}
```

### 2.2 Models
- **`EmployerOrganization`**: Tenant organization record (`id`, `name`, `slug`, `domain`, `companyId`, `verificationStatus`, `website`, `logoUrl`, `createdAt`, `updatedAt`).
- **`EmployerMember`**: Join model linking `User` to `EmployerOrganization` with `role` (`OWNER`, `ADMIN`, `RECRUITER`, `HIRING_MANAGER`), `title`, and `invitedAt`/`joinedAt`.
- **`Job` Updates**: Added `organizationId` (foreign key to `EmployerOrganization`), `organizationJobStatus` (`EmployerJobStatus`).
- **`EmployerApplicationReview`**: Employer-specific recruiting stage (`stage`), internal notes (`rating`, `notes`), and audit metadata attached to `Application`.

---

## 3. API Design (`/api/v1/employer`)

- `GET /api/v1/employer/me`: Current employer organization & member profile.
- `POST /api/v1/employer/organizations`: Onboard / create employer organization.
- `GET /api/v1/employer/dashboard`: High-level metrics (active jobs, total applicants, new applicants, pipeline breakdown).
- `GET /api/v1/employer/jobs`: List organization jobs with applicant counts.
- `POST /api/v1/employer/jobs`: Create job draft.
- `GET /api/v1/employer/jobs/:id`: Job details.
- `PATCH /api/v1/employer/jobs/:id`: Update job details.
- `POST /api/v1/employer/jobs/:id/publish`: Publish draft/paused job.
- `POST /api/v1/employer/jobs/:id/pause`: Pause active job.
- `POST /api/v1/employer/jobs/:id/close`: Close job.
- `GET /api/v1/employer/jobs/:id/applications`: List applicants for a specific job.
- `GET /api/v1/employer/applications/:id`: Applicant detail with submitted resume snapshot.
- `PATCH /api/v1/employer/applications/:id/stage`: Update recruiting pipeline stage.
- `POST /api/v1/employer/applications/:id/notes`: Add internal recruiter notes/feedback.

---

## 4. Testing & Verification Strategy
- **Unit & Integration Tests** (`backend/src/tests/employer.test.ts`):
  1. Organization creation & owner membership assignment
  2. Member invitation & role validation
  3. Job lifecycle: draft -> published -> paused -> closed
  4. Tenant isolation: Organization A cannot see or modify Organization B's jobs
  5. Cross-tenant applicant privacy: Organization A cannot see applicants for Organization B
  6. Submitting candidate privacy: Employers only see submitted ResumeVersion, not unlinked candidate records
  7. Stage progression & internal notes recording
  8. Unauthenticated & candidate role denial (HTTP 401 / 403)
- Full regression suite execution across Sprints 1–7.
