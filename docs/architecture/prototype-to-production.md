# Prototype to Production Gap Analysis & Transition Matrix

> **Document Status**: Production Baseline Specification  
> **Target Version**: Pilot Mama V1.0  
> **Location**: `docs/architecture/prototype-to-production.md`  

---

## 1. Executive Summary

The existing Pilot Mama prototype serves as a **validated reference implementation**. It established proof of concept for resume parsing, dual-score job matching, tailoring, Kanban tracking, and browser acceptance testing.

However, moving to a robust production platform requires systematically replacing in-memory/ephemeral prototype mocks with durable, normalized, secure, and horizontally scalable systems.

---

## 2. Component Disposition & Transition Matrix

| Subsystem / Component | Current Prototype State | Production V1 Target | Disposition | Rationale & Changes Required | Priority |
| :--- | :--- | :--- | :---: | :--- | :---: |
| **Database Engine** | `sql.js` (In-memory SQLite with manual binary disk sync) | **Managed PostgreSQL 16+** | **REBUILD** | In-memory SQLite cannot handle concurrent transactions, lacks row-level locking, and risks data loss under web traffic. | **P0 (Sprint 1)** |
| **Authentication & RBAC** | None (Static single mock candidate ID in local storage) | **JWT + Argon2 + RBAC** (`users`, `roles`, sessions) | **REBUILD** | Production requires secure multi-tenant isolation, password hashing, and role checks. | **P0 (Sprint 1)** |
| **Global Design System & Theming** | Vanilla CSS variables, Dark & Light theme tokens, mobile touch targets | **Production Design System** (Refined CSS token library) | **REUSE** | The existing CSS variables in `global.css` provide high aesthetic quality, safe area insets, and robust theming. Keep and expand. | **P0 (Sprint 1)** |
| **Responsive Web Layouts** | Implemented across all 8 core views with media queries & flex layouts | **Polished Responsive Web** | **REUSE** | Existing layouts validated down to 320px in browser tests. Keep structure, integrate with dynamic auth. | **P0** |
| **Resume Parser (Text Extraction)** | `pdf-parse`, `mammoth`, multi-regex extractor (`resume.parser.ts`) | **Hybrid Multi-Format Parser + AI Normalizer** | **REFACTOR** | Core text extraction works reliably. Refactor to pipe into structured Zod schemas with AI fallback for non-standard formats. | **P1 (Sprint 2)** |
| **Resume Tailoring Engine** | Rule-based section rewrite + Gemini LLM prompt (`resume.generator.ts`) | **Truth-Enforced Tailoring Pipeline** (`resume-ai.md`) | **REFACTOR** | Keep prompt structure; add strict Zero-Fabrication validator and Target Company Leakage detection before saving. | **P1 (Sprint 2)** |
| **AI Provider Integration** | Direct `@google/generative-ai` calls (`gemini.provider.ts`) | **AI Gateway Hub** (Gemini primary + OpenAI failover) | **REFACTOR** | Abstract provider behind `IAIProvider` interface; add token accounting, deterministic caching, and retry logic. | **P1 (Sprint 2)** |
| **Matching & Skill Gap Engine** | Syntactic keyword match + seniority heuristic (`matching.engine.ts`, `skillGap.engine.ts`) | **Dual-Score Match Engine** (ATS compatibility + semantic fit) | **REFACTOR** | Mathematical logic is sound. Decouple from mock data; connect directly to PostgreSQL canonical tables. | **P1 (Sprint 2)** |
| **Job Sources & Ingestion** | Scraper connectors for Ashby, Lever, Greenhouse, Codewalla | **Federated Connector Hub** with Deduplication & Freshness | **REFACTOR** | Individual connector scraping logic is solid. Add content-hash deduplication and source health telemetry. | **P2 (Sprint 3)** |
| **Application Tracking Subsystem** | CRUD memory store (`ApplicationController.ts`, Kanban UI) | **Relational Application Subsystem** with Event Ledger | **REBUILD** | Replace in-memory state with PostgreSQL `applications` + `application_events` tables; prevent duplicates. | **P2 (Sprint 3)** |
| **Interview Preparation** | AI generator creating STAR questions (`interview.generator.ts`) | **Role-Specific Interview Simulator** | **REUSE** | Logic and output formatting are high quality. Integrate with credit accounting. | **P2** |
| **Learning & Institute Registry** | Static seed records in `seed.ts` | **Normalized Learning Hub & Course Catalog** | **REBUILD** | Move static records to `institutes` and `courses` database schema; prepare for partner portal. | **P2** |
| **Document Storage** | Local filesystem `./resumes` directory | **S3-Compatible Object Storage** (Pre-signed URLs) | **REPLACE** | Ephemeral server disks lose user documents on restart. Must use durable Cloudflare R2 / AWS S3. | **P1 (Sprint 2)** |
| **Deployment Configuration** | Local node server | **Vercel (Frontend) + Render (Backend) + Managed DB** | **REBUILD** | Create production build scripts, Dockerfile if needed, and CI/CD pipelines. | **P0 (Sprint 1)** |
| **QA Acceptance Suite** | Standalone Node test scripts (`qa-evidence/*.cjs`) | **Jest / Playwright Production Test Suite** | **REFACTOR** | The test scripts in `qa-evidence/` contain excellent assertion logic. Refactor into standard CI test suites. | **P1** |

---

## 3. Classification Summary

- **REUSE (Keep with zero to minimal edits)**:
  - Global CSS tokens, dark/light theme engine, typography, and responsive layouts.
  - Multi-page UI components (Job Analysis, Dashboard, Profile Studio, Interview simulator).
  - Interview question generation logic and STAR prompt heuristics.
  - Core ATS connector endpoints (Greenhouse, Lever, Ashby).

- **REFACTOR (Enhance existing code to meet production rigor)**:
  - AI Gateway: encapsulate Gemini and add OpenAI fallback, token audit, and caching.
  - Resume Parser: integrate strict Zod validation and multi-pass AI normalization.
  - Tailoring Engine: embed the Zero-Fabrication Guard and Target Company Leakage check.
  - QA acceptance test scripts: translate into Playwright / Vitest automated test suites.

- **REBUILD (Replace prototype mocks with production systems)**:
  - Database Layer: move from `sql.js` in-memory SQLite to Managed PostgreSQL with schema migrations.
  - Authentication: implement complete JWT, password hashing, and RBAC middleware.
  - Application Tracker: implement relational tables with immutable `application_events`.
  - Object Storage: implement S3 pre-signed upload/download flow.

- **REMOVE (Eliminate prototype-only artifacts)**:
  - In-memory database sync loops and binary file dumping (`jobpilot.db` binary writes).
  - Hardcoded mock candidate credentials and static demo state.
