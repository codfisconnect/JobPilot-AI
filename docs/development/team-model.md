# Engineering Team Model and Operational Responsibilities

> **Document Status**: Production Standard  
> **Applies to**: Core Team, Contractors, and Future Interns  
> **Repository**: `codfisconnect/JobPilot-AI`  
> **Location**: `docs/development/team-model.md`  

---

## 1. Team Composition & Role Hierarchy

Pilot Mama operates with a streamlined, high-ownership team structure. Every role has distinct decision-making boundaries to ensure rapid engineering velocity without sacrificing architectural integrity or platform security.

```
┌────────────────────────────────────────────────────────────────────────┐
│                   FOUNDER / TECHNICAL PRODUCT OWNER                    │
│     • Architectural Authority  • Security Approvals  • Production Signoff│
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
         ┌──────────────────────────┴──────────────────────────┐
         ▼                                                     ▼
┌─────────────────────────────────┐           ┌─────────────────────────────────┐
│       PRODUCT + QA LEAD         │           │        LEAD / CORE ENG          │
│ • Requirements & Sprint DoD     │           ├────────────────┬────────────────┤
│ • E2E Test Strategy & Signoff   │           │ FRONTEND ENG   │ BACKEND / AI   │
│ • Regression & Release Readiness│           │ • React / TS   │ • Node / PG    │
└─────────────────────────────────┘           │ • Design System│ • AI Gateway   │
                                              │ • Touch & View │ • Ingestion Hub│
                                              └────────────────┴────────────────┘
```

---

## 2. Granular Role Responsibilities & Ownership

### 2.1. Founder / Technical Product Owner
- **Ultimate Decision Authority**: Owns overall product strategy, core data models, third-party provider agreements, and commercial monetization architecture.
- **Architectural & Security Governance**:
  - Approves all schema changes, database migrations, and encryption standards.
  - Controls production environment secrets, AWS/Render access, and domain DNS.
  - Reviews and signs off on every Release Pull Request merged from `develop` into `main`.
- **High-Risk Integrations**: Directly oversees payment gateways, proprietary ATS partnerships, and production AI model token budgets.

---

### 2.2. Product + QA Lead
- **Requirements & User Stories**: Transforms high-level product goals into precise sprint user stories with clear acceptance criteria.
- **Quality & Acceptance Authority**:
  - Validates that implemented features meet the Definition of Done before any feature branch is merged into `develop`.
  - Maintains and expands the automated E2E testing suites (Playwright) and API contract tests.
  - Validates the Browser & Device Matrix across all 12 responsive breakpoints.
  - Generates transparent QA evidence logs in `qa-evidence/`.
- **Release Quality Gatekeeper**: Holds veto power over staging and production releases if any critical regression or security flaw is discovered.

---

### 2.3. Frontend Developer (Core / Intern)
- **Primary Domain**: React 18+, TypeScript, Vite, CSS token system.
- **Specific Responsibilities**:
  - Implement responsive page layouts and components following `coding-guidelines.md`.
  - Maintain absolute compliance with the Pilot Mama design system in `global.css` (zero hardcoded hex colors, strict CSS variable usage).
  - Guarantee touch ergonomics (minimum 44px hit targets) and iOS safe area padding on mobile views.
  - Integrate frontend views cleanly with backend REST APIs using typed interfaces and unified Auth context.
  - Write component unit tests and verify dark/light theme fidelity.

---

### 2.4. Backend / AI Developer (Core / Intern)
- **Primary Domain**: Node.js 22 LTS, TypeScript, Express, PostgreSQL, AI Gateway integrations.
- **Specific Responsibilities**:
  - Implement and maintain normalized relational schemas and reversible migration scripts.
  - Enforce Layered Architecture (Controller ➔ Service ➔ Repository) and Zod schema validations for all API endpoints.
  - Build and maintain the AI Gateway provider adapter (Gemini primary, OpenAI fallback, deterministic caching).
  - Implement and test ATS job source connectors (Greenhouse, Lever, Ashby) with rate limiting and deduplication.
  - Implement secure JWT authentication, Argon2 password hashing, and RBAC middleware.
  - Write automated API integration tests (Supertest) covering all status codes and edge cases.

---

## 3. Communication, PR Review, and Handoff Protocols

1. **Task Handoff**: A task is never handed to a developer without documented acceptance criteria and target file boundaries.
2. **Pull Request Protocol**:
   - Feature branches must target `develop`.
   - PR description must include what was built, how it was tested, and visual/log QA evidence.
   - Code review requires approval from the Tech Lead for architecture/security and the QA Lead for acceptance criteria.
3. **Intern Supervision**: Interns are paired with a designated module owner. Direct commits to `develop` or `main` are technically blocked by branch protection rules.
