# Job Ingestion Subsystem Architecture

> **Document Status**: Production Baseline Specification  
> **Target Version**: Pilot Mama V1.0  
> **Location**: `docs/architecture/job-ingestion.md`  

---

## 1. Job Ingestion Overview & Philosophy

The Job Ingestion subsystem aggregates, cleanses, deduplicates, and continuously verifies vacancies across disparate corporate hiring channels. 

Unlike indiscriminate web scrapers that break frequently and pollute databases with ghost jobs, Pilot Mama operates a **Federated Source Connector Architecture**. We prioritize structured, official ATS endpoints (Greenhouse, Lever, Ashby, Workable) and verified corporate career portals, maintaining high data freshness and verifiable application links.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        UPSTREAM RECRUITING CHANNELS                    │
├─────────────────┬──────────────────┬─────────────────┬─────────────────┤
│ Greenhouse API  │ Lever Postings   │ Ashby HQ Board  │ Generic Career  │
│ /boards/v1/...  │ /v0/postings/... │ /api/posting/...│ HTML Endpoints  │
└─────────────────┴──────────────────┴─────────────────┴─────────────────┘
                                   │
                                   ▼ Periodic Polling / Webhook Sync
┌────────────────────────────────────────────────────────────────────────┐
│                     SOURCE CONNECTOR FACTORY ENGINE                    │
├────────────────────────────────────────────────────────────────────────┤
│ • Rate Limiting & Concurrency Throttles                                │
│ • Exponential Backoff & Connection Health Telemetry                    │
│ • Isolated Connector Adapters (`connectors/<type>.connector.ts`)       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Raw Source Items
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   NORMALIZATION & CANONICAL PIPELINE                   │
├────────────────────────────────────────────────────────────────────────┤
│ 1. Structural Normalization (Standardize title, location, salary)      │
│ 2. AI Skill Extraction & Categorization (Required vs Optional)         │
│ 3. Cryptographic Deduplication (SHA-256 Content Hash)                  │
│ 4. Freshness & Expiration Verification (Detect closed postings)        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼ Canonical Job Entity
┌────────────────────────────────────────────────────────────────────────┐
│                        CANONICAL JOBS DATABASE                         │
│             (PostgreSQL `jobs` and `job_skills` tables)                │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Ingestion Pipeline Stages

### Stage 1: Ingestion Trigger & Connector Execution
- Ingestion runs on scheduled cron jobs or on-demand manual triggers via `/api/v1/jobs/sync-source`.
- Connector adapters isolate protocol-specific behaviors (JSON APIs, pagination tokens, or HTML parsing via Cheerio).

### Stage 2: Entity Normalization
Raw postings arrive in wildly varying schemas. The Normalizer standardizes:
- **Work Mode**: Resolves strings like *"Virtual"*, *"Remote - US"*, *"Anywhere"* into `remote`, `hybrid`, or `onsite`.
- **Location Geometry**: Standardizes country, state/province, and city names.
- **Compensation**: Normalizes annual, monthly, and hourly rates into standardized ranges (`salary_min`, `salary_max`, `currency`).

### Stage 3: Deduplication & Content Hashing
To prevent identical job vacancies from appearing multiple times (e.g. syndicated across multiple career boards or re-ingested during sync):
- A deterministic hash is computed:
  `content_hash = SHA256(company_id + normalized_title + normalized_department + location + raw_description_text)`
- If a job with an identical `content_hash` exists, the record's `updated_at` and `last_verified_at` timestamps are updated without inserting duplicates.

### Stage 4: Freshness & Job Expiration Management
- Ingested vacancies that no longer appear in consecutive upstream sync crawls are flagged for expiration.
- Marked as `is_active = false` with an expiration timestamp (`expires_at`), preventing candidates from applying to obsolete or filled positions.

---

## 3. Supported Source Connectors

| Source Type | Protocol | Ingestion Technique | Typical Latency / Freshness | Reliability |
| :--- | :--- | :--- | :--- | :---: |
| **Greenhouse** | Public Board JSON API | `boards-api.greenhouse.io/v1/boards/{board_token}/jobs` | Real-time JSON (Hourly sync) | 99.9% |
| **Lever** | Public Postings API | `api.lever.co/v0/postings/{company}` | Real-time JSON (Hourly sync) | 99.9% |
| **Ashby** | Public Job Board API | `api.ashbyhq.com/posting-api/job-board/{board_name}` | Real-time JSON (Hourly sync) | 99.8% |
| **Workable** | Public Jobs Endpoint | `apply.workable.com/api/v1/widget/accounts/{subdomain}` | Real-time JSON (Hourly sync) | 99.5% |
| **Generic Career Page** | HTTP / HTML Scraping | HTML text extraction via Cheerio + AI Structured Extraction | Scheduled (Daily sync) | 95.0% (Adaptive) |

---

## 4. Source Health & Operational Governance

Every configured source maintains operational telemetry in the `company_sources` table:
- **`sync_status`**: Current operational status (`healthy`, `degraded`, `failing`).
- **`error_count`**: Consecutive failure counter. When a source fails 5 consecutive sync attempts (e.g., target domain changed URL or blocked IP), its status shifts to `failing` and triggers an administrator alert.
- **Rate-Limiting Compliance**: Each connector enforces per-domain request throttles (maximum 2 requests per second to avoid IP bans or 429 errors).
- **Unsupported Source Handling**: If a user submits an external career URL from an unsupported platform, the system invokes the fallback HTML text extractor with AI parsing, saving the extracted structure as an ad-hoc canonical job while logging the domain for prospective connector development.
