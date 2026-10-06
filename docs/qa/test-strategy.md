# Quality Assurance & Test Strategy Specification

> **Document Status**: Production Standard  
> **Applies to**: Engineering & QA Teams  
> **Location**: `docs/qa/test-strategy.md`  

---

## 1. Testing Philosophy & Test Pyramid

Pilot Mama implements an automated, multi-tiered testing strategy designed to catch regressions early, ensure mathematical accuracy in AI/matching algorithms, and maintain flawless UI responsiveness.

```
                  /\
                 /  \      E2E Journey Tests (Playwright)
                / E2E \    Candidate Registration ➔ Match ➔ Apply
               /───────\
              /   API   \  Integration & Contract Tests (Supertest)
             / Contract  \ Endpoints, Status Codes, Zod Payloads
            /─────────────\
           /     Unit      \ Pure Logic: Resume Parser, Truth Guard,
          /  & Regression   \ Scoring Math, Token Budgeting (Vitest / Jest)
         /───────────────────\
```

---

## 2. Test Classification Tiers

### 2.1. Unit Testing
- **Focus**: Pure domain functions without external I/O or network dependencies.
- **Key Modules Tested**:
  - `resume.parser.ts`: Section splitting, regex heuristics, date normalizers.
  - `matching.engine.ts`: Syntactic keyword overlap calculations, weight distributions.
  - `resume-ai.md` Validation Engine: Zero-fabrication detection and Target Company Leakage detection.
  - `zod` schemas: Validating both well-formed and intentionally malformed payloads.

### 2.2. API & Integration Testing
- **Focus**: End-to-end HTTP request/response validation against a running test database.
- **Key Tests**:
  - Authentication flow (registration, duplicate email rejection, JWT verification, expired token rejection).
  - RBAC protection (candidate attempting to access `/api/v1/admin/metrics` returns 403 Forbidden).
  - Resume upload flow with sample PDF files verifying 10MB limits and binary format validation.
  - Application uniqueness constraint verifying duplicate `(candidate_id, job_id)` returns 409 Conflict.

### 2.3. End-to-End (E2E) Browser & Journey Testing
- **Focus**: Headless browser automation executing full candidate journeys using Playwright.
- **Standard Journeys Automated**:
  1. **Journey 1**: Sign Up ➔ Upload Resume ➔ Verify Profile Fields ➔ View Jobs.
  2. **Journey 2**: Select Job ➔ Analyze Match ➔ Review Skill Gaps ➔ Tailor Resume.
  3. **Journey 3**: Truth Validation Pass ➔ Export PDF ➔ Mark Applied on Kanban Board.
  4. **Journey 4**: Dark Mode / Light Mode toggle verifying persistence across page reloads.

### 2.4. Regression & Evidence Logging
- Following every test suite execution, artifacts (screenshots on failure, API payload dumps, browser console logs) are automatically recorded to `qa-evidence/` for transparent auditability.

---

## 3. CI/CD Automated Test Pipeline

```
[ Developer Opens PR ]
          │
          ▼
[ GitHub Actions CI Runner ]
  ├── 1. Lint & Typecheck (`tsc --noEmit`)
  ├── 2. Run Unit Test Suite (`npm run test:unit`)
  ├── 3. Spin up ephemeral PostgreSQL test container
  ├── 4. Run API Integration Suite (`npm run test:api`)
  ├── 5. Run Headless Playwright Journey Suite (`npm run test:e2e`)
  └── 6. Output QA Evidence Report
          │
          ▼
[ PR Status: Checks Passed ✅ ]
```
