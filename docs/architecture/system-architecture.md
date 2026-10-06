# System Architecture Specification

> **Document Status**: Production Baseline Specification  
> **Target Version**: Pilot Mama V1.0  
> **Location**: `docs/architecture/system-architecture.md`  

---

## 1. High-Level System Architecture

Pilot Mama is designed around an **API-First, Layered Micro-Modular Monolith** architecture. This ensures developer agility, high code cohesion, minimal operational overhead for small teams, and a seamless path to decoupled microservices when scale demands it.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        CLIENT PRESENTATION TIER                        │
├────────────────────────────────┬───────────────────────────────────────┤
│ Responsive Web (React + TS)    │ Future Mobile Client (React Native)   │
│ Desktop / Tablet / Smartphone  │ iOS & Android (Universal REST Client) │
└────────────────────────────────┴───────────────────────────────────────┘
                                   │
                                   ▼ HTTPS / TLS 1.3
┌────────────────────────────────────────────────────────────────────────┐
│                        API GATEWAY & ROUTING TIER                      │
├────────────────────────────────────────────────────────────────────────┤
│ Express / Node.js Engine (TypeScript)                                  │
│ • Reverse Proxy & Rate Limiting                                        │
│ • JWT Authentication & RBAC Authorization Middleware                  │
│ • Request Payload Validation (Zod Schemas)                             │
│ • Structured Error Handling & Request Correlator (Trace IDs)           │
└────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼ Internal Service Boundary
┌────────────────────────────────────────────────────────────────────────┐
│                        CORE APPLICATION SERVICES                       │
├─────────────────┬──────────────────┬─────────────────┬─────────────────┤
│ Identity Service│ Job Engine       │ AI Gateway Hub  │ Career Services │
│ • Auth & Tokens │ • Ingestion Hub  │ • Gemini Adapter│ • Match Engine  │
│ • User Profiles │ • Deduplication  │ • OpenAI Adapter│ • Tailor Studio │
│ • RBAC Context  │ • Canonical Jobs │ • Prompt Version│ • App Tracker   │
│ • Preferences   │ • Source Health  │ • Cost Tracker  │ • Interview Prep│
└─────────────────┴──────────────────┴─────────────────┴─────────────────┘
                                   │
                                   ▼ Data Access Layer (Repositories)
┌────────────────────────────────────────────────────────────────────────┐
│                       DATA & INFRASTRUCTURE TIER                       │
├─────────────────┬──────────────────┬─────────────────┬─────────────────┤
│ Relational DB   │ Object Storage   │ Background Task │ External APIs   │
│ • Managed PG    │ • Private Buckets│ • Ingestion Job │ • ATS Connectors│
│ • ACID Transact │ • Resumes/PDFs   │ • Cleaners      │ • Payment Gate  │
│ • Full-Text Idx │ • CDN Assets     │ • Worker Queue  │ • LLM Providers │
└─────────────────┴──────────────────┴─────────────────┴─────────────────┘
```

---

## 2. Technology Stack Definition

| Architectural Layer | Production Target Technology | Rationale & Selection Criteria |
| :--- | :--- | :--- |
| **Frontend Web** | React 18+ / Vite / TypeScript | Fast build times, robust typing, ecosystem maturity, modular CSS architecture. |
| **Styling & Design System** | Vanilla CSS Tokens & Utility Layers | Maximum control over performance, zero CSS-in-JS runtime overhead, crisp Dark/Light theming via CSS variables. |
| **Backend API** | Node.js 22 LTS / Express / TypeScript | Shared TypeScript types with frontend, high async I/O throughput for job crawling and streaming LLM responses. |
| **Validation Layer** | Zod | Runtime type safety for all incoming API payloads, AI JSON output validation, and database entity parsing. |
| **Primary Database** | Managed PostgreSQL 16+ | Enterprise relational integrity, ACID transactions for billing/applications, native JSONB support, and powerful full-text indexing. |
| **Document/Blob Storage** | S3-Compatible Object Storage (AWS S3 / Cloudflare R2) | Scalable, encrypted, private storage for candidate resumes, generated PDFs, and profile avatars with pre-signed URL access. |
| **AI Integration Hub** | Custom Provider Gateway (Gemini 2.5 / OpenAI Ready) | Decoupled provider abstraction preventing vendor lock-in, with integrated retries, fallback routing, and token audit ledgers. |
| **Hosting Infrastructure** | Vercel (Frontend) + Render / AWS (Backend) | Vercel provides world-class global CDN edge delivery; Render provides reliable managed container execution and managed PostgreSQL. |

---

## 3. Core Architectural Subsystems

### 3.1. API-First Design Principle
All business capabilities are exposed through standard, versioned RESTful HTTP endpoints (`/api/v1/*`). The React Web application, any browser companion extensions, and future native mobile applications (iOS and Android via React Native) interact with the platform exclusively through these identical, secure endpoints.

### 3.2. Data Flow Architecture

#### A. Resume Ingestion & Processing Flow
1. Client issues `POST /api/v1/candidates/upload` with multipart form containing resume file.
2. API validates MIME type (`application/pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`) and enforces 10MB size limit.
3. Raw file is securely streamed to private Object Storage; a content digest hash (SHA-256) is recorded.
4. Parsing Engine extracts text streams via `pdf-parse` or `mammoth`.
5. AI Gateway structures extracted text into strict JSON matching candidate profile schemas.
6. Relational entities (skills, experience, education, projects) are saved in PostgreSQL within an ACID transaction.
7. Candidate receives structured profile response ready for UI confirmation.

#### B. Job Matching & Tailoring Flow
1. Client requests match for a given candidate and job ID (`POST /api/v1/match/analyze`).
2. Match Engine fetches normalized candidate skills and job requirements.
3. Computes deterministic ATS syntactic score (keyword overlap, section completeness).
4. AI Gateway calculates semantic similarity, domain seniority alignment, and role fit.
5. Missing competencies are routed to the Skill Gap Engine to extract immediate bridge skills and suggest relevant learning resources.
6. If the user requests a tailored resume, the Tailor Studio compiles targeted bullet points strictly based on the candidate's existing experience, enforces the **Truth Validation Guard** and **Target Company Leakage Check**, and stores the new version in `resume_versions`.

---

## 4. Scalability, Caching, and Resilience

### 4.1. Caching Strategy
- **Job Postings Cache**: Inactive or frequently accessed canonical jobs are cached with TTLs based on posting freshness.
- **Skill Taxonomy Cache**: Master skill dictionary and synonym graphs are cached in-memory.
- **AI Request Caching**: Deterministic AI parsing requests (using content hashes as keys) are checked before invoking external LLM APIs, saving up to 60% in AI compute expenses.

### 4.2. Failure Isolation & Circuit Breakers
- **AI Outages**: If Gemini API encounters rate limits or upstream 503s, the AI Gateway automatically falls back to secondary models or fails gracefully with cached semantic heuristics.
- **Job Ingestion Errors**: Scraper failures or target career page 404s do not block user requests. Ingestion runs asynchronously; failing sources are quarantined and logged for administrator triage.

---

## 5. Deployment Topology

```
                       [ Cloudflare DNS / DDoS Protection ]
                                        │
                    ┌───────────────────┴───────────────────┐
                    │                                       │
                    ▼                                       ▼
       [ Vercel Edge Network ]                 [ Render Web Service ]
       • React Web Client SPA                  • Node.js / Express API
       • Static Assets & Bundles               • Background Workers
       • Edge Caching                          • Private Networking
                    │                                       │
                    │               ┌───────────────────────┴───────────────────────┐
                    │               │                                               │
                    │               ▼                                               ▼
                    │    [ Managed PostgreSQL ]                           [ Object Storage ]
                    └──> • Connection Pooler (PgBouncer)                  • Cloudflare R2 / AWS S3
                         • Automated Snapshots                            • Private Resumes & PDFs
```
