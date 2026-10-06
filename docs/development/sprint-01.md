# Sprint 01 - Production Foundation Specification

> **Sprint Duration**: 2 Weeks  
> **Sprint Objective**: Establish the production infrastructure, relational PostgreSQL schema, secure authentication & RBAC, unified API gateway foundation, and responsive Pilot Mama design system.  
> **Target Branch**: `develop`  
> **Location**: `docs/development/sprint-01.md`  

---

## 1. Sprint 1 Scope & High-Level Objectives

Sprint 1 builds the **unshakeable architectural bedrock** for Pilot Mama V1. It does NOT implement business logic like complex scraping or full AI resume rewriting. Instead, it creates the database, security, API contracts, design system, and error boundaries upon which all subsequent sprints depend.

### Key Deliverables:
1. **PostgreSQL Relational Foundation**: Connection pooling, migration runner, normalized tables for `users`, `roles`, `candidate_profiles`, and `credits`.
2. **Authentication & RBAC**: Registration, login, JWT token issuance, password hashing via Argon2/Bcrypt, and Express auth middleware.
3. **API & Error Handling Foundation**: Centralized error middleware, Zod request validation pipelines, and standardized JSON response envelopes.
4. **Environment & Logging Infrastructure**: Zod-based startup environment validation, structured JSON logging with request trace IDs.
5. **Pilot Mama Design System & Theme Engine**: Refined CSS design tokens, flawless Dark/Light theme switching, mobile safe area inset handling, and responsive navigation shell.

---

## 2. Team Work Breakdown & Task Allocation

### 2.1. Founder / Technical Lead Tasks

#### Task T1.1: Database Connection Pooling & Migration Framework
- **Objective**: Configure `pg` (node-postgres) connection pooler and a migration tool (e.g. `node-pg-migrate` or `prisma`) configured for PostgreSQL 16+.
- **Dependencies**: Managed PostgreSQL instance (local Docker container for dev, Render PG for staging).
- **Acceptance Criteria**:
  - Connection pool manages connections with idle timeouts and max client limits.
  - Initial migration creates `users`, `roles`, `permissions`, and `candidate_profiles` tables with proper foreign keys and constraints.
  - `npm run db:migrate` and `npm run db:rollback` execute successfully.
- **Expected Files**: `backend/src/database/pool.ts`, `backend/src/database/migrations/*`.
- **QA Requirements**: Verify automated test connects to test database, runs migrations, verifies table constraints, and disconnects cleanly.

#### Task T1.2: Security Architecture, Secrets Validation, & Central Error Handler
- **Objective**: Establish startup environment validation and Express global error handler.
- **Dependencies**: None.
- **Acceptance Criteria**:
  - Missing environment variable causes server boot to fail immediately with an explicit error.
  - Global error middleware intercepts all unhandled rejections, logs trace ID, and returns standard JSON error envelope without leaking stack traces in production.
- **Expected Files**: `backend/src/config/env.ts`, `backend/src/middleware/error.middleware.ts`.
- **QA Requirements**: Trigger synthetic 400, 401, 404, and 500 errors; verify JSON envelope conforms to `api-architecture.md`.

---

### 2.2. Backend / AI Developer Tasks

#### Task T1.3: User, Role, and Authentication Subsystem
- **Objective**: Implement user registration, login, JWT generation, and password hashing.
- **Dependencies**: Task T1.1 (Database pool & tables).
- **Acceptance Criteria**:
  - `POST /api/v1/auth/register`: Hashes passwords using Argon2 or Bcrypt (cost 12), creates `users` record, creates associated default `candidate_profiles` entry, and assigns `ROLE_CANDIDATE`.
  - `POST /api/v1/auth/login`: Validates credentials, rejects invalid passwords, returns signed JWT access token and refresh token.
  - Reject duplicate email registration with `409 Conflict`.
- **Expected Files**: `backend/src/controllers/auth.controller.ts`, `backend/src/services/auth.service.ts`, `backend/src/routes/auth.routes.ts`.
- **QA Requirements**: Unit test password hasher; integration test registration and login endpoints with valid and invalid inputs.

#### Task T1.4: Authentication & RBAC Middleware
- **Objective**: Create Express middleware to protect private API routes and enforce role privileges.
- **Dependencies**: Task T1.3.
- **Acceptance Criteria**:
  - `authenticateJwt`: Validates Bearer token header, decodes user payload, attaches `req.user`. Returns 401 Unauthorized if missing/expired.
  - `requireRole(['admin'])`: Validates `req.user.role`. Returns 403 Forbidden if user lacks required role.
- **Expected Files**: `backend/src/middleware/auth.middleware.ts`, `backend/src/middleware/rbac.middleware.ts`.
- **QA Requirements**: Create a dummy protected endpoint; verify access is allowed for authorized role and blocked for unauthorized callers.

---

### 2.3. Frontend Developer Tasks

#### Task T1.5: Pilot Mama Design Tokens & Theme Engine
- **Objective**: Formalize the design system token architecture and dynamic Dark/Light theme switching.
- **Dependencies**: Existing `global.css` tokens.
- **Acceptance Criteria**:
  - CSS variables define all background, surface, text, border, brand gradient, and semantic status colors.
  - Theme toggler switches `data-theme="dark"` and `data-theme="light"` on `document.documentElement` without page reload.
  - User theme preference is saved in `localStorage` and respects system `prefers-color-scheme` on first visit.
  - Zero hardcoded hex colors in core styling.
- **Expected Files**: `frontend/src/styles/global.css`, `frontend/src/context/ThemeContext.tsx`, `frontend/src/components/ThemeToggle.tsx`.
- **QA Requirements**: Verify visual appearance and contrast ratios in both dark and light modes across all basic elements.

#### Task T1.6: Responsive App Shell & Navigation Foundation
- **Objective**: Build the core responsive application layout containing desktop sidebar, mobile header, and mobile bottom navigation.
- **Dependencies**: Task T1.5.
- **Acceptance Criteria**:
  - Desktop (≥ 1024px): Persistent sidebar navigation with Pilot Mama branding, navigation links, and theme toggle.
  - Tablet (768px - 1023px): Collapsible navigation rail.
  - Mobile (320px - 767px): Sticky top bar with logo + sticky bottom navigation bar with 44px touch targets and iOS safe area padding (`env(safe-area-inset-bottom)`).
  - Zero horizontal scroll at 320px, 375px, 768px, and 1280px.
- **Expected Files**: `frontend/src/layouts/AppLayout.tsx`, `frontend/src/layouts/AppLayout.css`.
- **QA Requirements**: Validate layout rendering across 12 screen widths according to `browser-device-matrix.md`.

#### Task T1.7: Authentication UI & Auth Context
- **Objective**: Implement clean, responsive Login and Registration views and client-side Auth Context.
- **Dependencies**: Task T1.3, Task T1.6.
- **Acceptance Criteria**:
  - Login and Registration forms with input validation (email format, password length).
  - `AuthContext` provides `user`, `login()`, `register()`, `logout()`, and `isAuthenticated`.
  - Store JWT token securely; automatically attach Bearer token to API client calls.
  - Graceful error banners for wrong credentials or existing email.
- **Expected Files**: `frontend/src/pages/LoginPage.tsx`, `frontend/src/pages/RegisterPage.tsx`, `frontend/src/context/AuthContext.tsx`.
- **QA Requirements**: Complete full registration and login flow in browser; verify redirection to dashboard and token persistence.

---

### 2.4. Product + QA Lead Tasks

#### Task T1.8: Test Suite Setup & Sprint 1 QA Acceptance Execution
- **Objective**: Configure automated test runner (Vitest/Jest + Supertest for backend; Playwright for frontend) and execute comprehensive acceptance tests for Sprint 1 deliverables.
- **Dependencies**: Tasks T1.1 through T1.7.
- **Acceptance Criteria**:
  - Automated test script verifies:
    1. Database migrations run cleanly.
    2. User registration and password hashing work.
    3. Login issues valid JWT token.
    4. Protected route blocks unauthenticated requests (401).
    5. Protected route blocks non-admin user from admin route (403).
    6. Browser test verifies Dark/Light theme toggle persistence.
    7. Browser test verifies responsive navigation at 375px, 768px, and 1280px.
  - Output QA Evidence report saved to `qa-evidence/SPRINT_01_ACCEPTANCE_REPORT.md`.
- **Expected Files**: `backend/src/tests/auth.test.ts`, `qa-evidence/run_sprint01_acceptance.cjs`.
- **QA Requirements**: All tests pass 100% with zero flake before Sprint 1 sign-off.
