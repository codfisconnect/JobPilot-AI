# Sprint 2: Candidate Profile + Resume Foundation

## Sprint Objective
Build the production **Candidate Profile & Resume Foundation** for Pilot Mama V1 on the `develop` branch. Enable candidates to maintain personal details, preferences, experiences, education, certifications, skills, and projects; upload PDF/DOCX resumes safely into private storage; extract and review structured information without data fabrication; maintain a Master Resume; and generate immutable historical resume version snapshots.

---

## Deliverables & Achievements

### 1. Database & Prisma Schema Extension
- Clean migration `20261006091115_sprint2_candidate_profile_resume` applied against PostgreSQL database `pilot_mama_dev`.
- Models added/updated:
  - `CandidateProfile`: Global contact and location fields (`country`, `city`, `stateProvince`, `postalCode`, `summary`).
  - `CandidatePreference`: Target roles, preferred locations, preferred countries, remote preference, salary range, notice period, relocation willingness.
  - `Experience`: Strict chronological constraints (end date >= start date, current jobs have no end date).
  - `Education`, `Certification`, `Project`: Structured relational entities.
  - `Skill` & `CandidateSkill`: Normalized skills catalog preserving source (`MANUAL`, `RESUME`, `IMPORTED`) without fabricating years of experience.
  - `Resume`: Storage references, MIME type, file size, status (`UPLOADED`, `PARSING`, `PARSED`, `PARSE_REVIEW_REQUIRED`, `FAILED`, `ARCHIVED`).
  - `ResumeVersion`: Immutable snapshot storage (`contentSnapshot`, `versionNumber`, `title`).

### 2. Private Resume Storage Abstraction
- Created `IResumeStorage` interface.
- Implemented `LocalResumeStorage` targeting `backend/storage/resumes/` using UUID keys with path traversal protection.
- Updated `.gitignore` to prevent any resume binaries from entering version control.

### 3. File Validation & Magic Number Verification
- Implemented `FileValidationService` validating binary magic numbers (`%PDF-`, `PK\x03\x04` for DOCX) and rejecting executables and malformed files.
- Enforced 10MB file size limit and filename sanitization.

### 4. Resume Parsing & Truth Protection Service
- Implemented `ResumeParsingService` with tolerance for diverse heading variants (`Career Objective`, `Employment History`, `Academic Background`, `Core Competencies`).
- Enforced zero data fabrication: Never invents dates, years of experience, or missing credentials.

### 5. Candidate Review & Master Resume Architecture
- Parser results are presented to the candidate for review before committing to the canonical master profile (`POST /api/v1/resumes/:id/confirm`).
- Candidates retain full control to edit, confirm, or discard parsed data.

### 6. Immutable Resume Versions
- Candidates can snapshot their current canonical master profile into a discrete `ResumeVersion`.
- Subsequent profile mutations do not alter historical versions.

### 7. Security & Ownership Enforcement
- All `/api/v1/candidates` and `/api/v1/resumes` endpoints authenticate JWT and derive ownership directly from `req.user.userId`.
- Cross-candidate access attempts are strictly rejected with `404 Not Found`.

### 8. Frontend Resume Vault & Profile Manager
- Created `ResumeUploadManager` supporting drag-and-drop, upload progress, parse status, and interactive review modal.
- Integrated into `ProfilePage.tsx` adhering to Pilot Mama design tokens, light/dark modes, and mobile responsiveness.

---

## Test Verification Summary
- **Prototype Regression Suite**: 63/63 tests passed.
- **Sprint 1 Auth Suite**: 12/12 tests passed.
- **Sprint 1 API Suite**: 6/6 tests passed.
- **Sprint 1 Lifecycle Suite**: 8/8 tests passed.
- **Sprint 2 Candidate Profile Suite**: 12/12 tests passed.
- **Sprint 2 Resume & Parser Suite**: 13/13 tests passed.
- **Total Backend Tests Passed**: 114/114 tests passed.
- **Frontend Build**: Passed (`vite build` succeeded with zero errors).
- **Backend Build**: Passed (`tsc` succeeded with zero errors).
