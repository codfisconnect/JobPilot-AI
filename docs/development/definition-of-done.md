# Definition of Done (DoD) Specification

> **Document Status**: Production Standard  
> **Applies to**: All Feature PRs, Sprint Deliverables, and Bug Fixes  
> **Repository**: `codfisconnect/JobPilot-AI`  
> **Location**: `docs/development/definition-of-done.md`  

---

## 1. Definition of Done Checklist

A user story, task, or feature is strictly **NOT DONE** until every item in this checklist is verified and satisfied. Partial implementations or untested code cannot be merged into `develop` or `main`.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        PILOT MAMA DEFINITION OF DONE                   │
├─────────────────────┬──────────────────────────┬───────────────────────┤
│ 1. Code Quality     │ 2. Testing & Validation  │ 3. Security & Ops     │
├─────────────────────┼──────────────────────────┼───────────────────────┤
│ • Clean TypeScript  │ • Unit & API Tests       │ • RBAC Enforced       │
│ • No "any" Types    │ • UI & Responsive Checks │ • No Secret Leakage   │
│ • Token Theming     │ • Error & Edge States    │ • Docs Updated        │
│ • PR Reviewed       │ • No Regression Bugs     │ • Build Passing       │
└─────────────────────┴──────────────────────────┴───────────────────────┘
```

---

## 2. Granular Acceptance Gates

### Gate 1: Code Implementation & Architecture
- [ ] Feature fully fulfills all acceptance criteria specified in the sprint story.
- [ ] Written strictly in TypeScript with no compiler warnings or implicit/explicit `any` types.
- [ ] Adheres to Layered Architecture (Controller ➔ Service ➔ Repository) on backend.
- [ ] No hardcoded colors or direct pixel sizes that break theming or responsive breakpoints.
- [ ] Uses centralized design tokens from `global.css`.

### Gate 2: Testing & Automated Verification
- [ ] **Unit Tests**: Critical business logic (calculators, parsers, validators) covered by unit tests.
- [ ] **API Endpoint Tests**: Endpoint returns correct status codes (200, 201, 400, 401, 403, 404, 500) and standard JSON envelopes.
- [ ] **UI Component Tests**: Renders in both **Dark Mode** and **Light Mode** with zero visual glitches or illegible text contrast.
- [ ] **Responsive Validation**: Validated on mobile (375px/390px), tablet (768px), and desktop (1280px+) without horizontal scrolling.
- [ ] **Error & Empty States**: Empty datasets, loading spinners, network timeouts, and failed validations display user-friendly error UI.

### Gate 3: Security & Data Isolation
- [ ] All inputs validated via Zod schemas.
- [ ] Endpoints enforce authentication and RBAC permissions.
- [ ] Data queries strictly enforce candidate tenant isolation (no cross-user document access).
- [ ] Zero secrets or API keys exposed in frontend code or commit history.

### Gate 4: Operations & Documentation
- [ ] Local and production build scripts execute cleanly (`npm run build`).
- [ ] Database migrations include reversible down-migrations and run without locking issues.
- [ ] Relevant documentation in `docs/` updated to reflect new endpoints, schema changes, or UI behaviors.
- [ ] Pull Request includes descriptive summary and visual/log QA evidence.
- [ ] Technical Product Owner or Tech Lead review approved.
