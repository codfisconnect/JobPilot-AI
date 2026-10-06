# Production Job Engine Architecture

> **Component**: Production Job Engine & Company Registry  
> **Sprint**: Pilot Mama V1 Sprint 3  
> **Status**: Implemented & Verified  
> **Database**: PostgreSQL 18 with Prisma ORM  

---

## 1. Executive Summary

The Production Job Engine transforms prototype job discovery into a robust, normalized, source-independent, production-grade job ingestion and discovery platform.

Key tenets:
1. **Canonical Company Registry**: Companies are deduplicated across multiple boards and sources using official domains and canonical naming.
2. **Connector Isolation**: External boards (Codewalla, Greenhouse, Lever, Ashby) adhere to the strongly-typed `IJobSourceConnector` interface. Core domains remain agnostic to connector specifics.
3. **Deterministic Deduplication**: Primary identity checks `(sourceType, externalJobId)` combined with SHA-256 content hashes `(company | title | location | externalJobId | description[:300])`.
4. **Idempotency & Freshness Tracking**: Ingesting the same jobs multiple times updates `lastSeenAt` and `lastCheckedAt` without duplicating PostgreSQL rows. Stale listings not seen for 14 days cleanly transition to `EXPIRED`.
5. **Connector Failure Isolation**: One broken or degraded connector never halts ingestion of other sources. Each source tracks health (`HEALTHY`, `DEGRADED`, `FAILING`, `DISABLED`).
6. **Content Sanitization & Security**: All incoming job descriptions are stripped of malicious HTML tags (`<script>`, `<iframe>`, inline `on*` event handlers) before persisting and rendering.
7. **Strict Boundary Adherence**: No semantic Job Matching, AI tailoring, or automated applications are executed in Sprint 3. Candidate data is never sent to external sources.

---

## 2. Domain & Data Models

### 2.1 Prisma Schema

```prisma
enum JobStatus {
  ACTIVE
  EXPIRED
  CLOSED
  REMOVED
}

enum RemoteType {
  REMOTE
  HYBRID
  ON_SITE
  UNKNOWN
}

enum EmploymentType {
  FULL_TIME
  PART_TIME
  CONTRACT
  TEMPORARY
  INTERNSHIP
  OTHER
}

enum JobSkillType {
  REQUIRED
  PREFERRED
}

enum SourceHealth {
  HEALTHY
  DEGRADED
  FAILING
  DISABLED
}

model Company {
  id             String    @id @default(uuid())
  name           String
  officialDomain String?   @unique @map("official_domain")
  careersUrl     String?   @map("careers_url")
  industry       String?
  country        String?
  description    String?
  logoUrl        String?   @map("logo_url")
  atsProvider    String?   @map("ats_provider")
  atsIdentifier  String?   @map("ats_identifier")
  sourceType     String    @default("EXTERNAL") @map("source_type")
  status         String    @default("ACTIVE")
  lastVerifiedAt DateTime? @map("last_verified_at")
  createdAt      DateTime  @default(now()) @map("created_at")
  updatedAt      DateTime  @updatedAt @map("updated_at")

  sources CompanySource[]
  jobs    Job[]

  @@index([name])
  @@map("companies")
}

model CompanySource {
  id                   String       @id @default(uuid())
  companyId            String       @map("company_id")
  sourceType           String       @map("source_type")
  sourceName           String       @map("source_name")
  sourceUrl            String       @map("source_url")
  externalIdentifier   String?      @map("external_identifier")
  enabled              Boolean      @default(true)
  lastCheckedAt        DateTime?    @map("last_checked_at")
  lastSuccessfulSyncAt DateTime?    @map("last_successful_sync_at")
  lastFailureAt        DateTime?    @map("last_failure_at")
  failureCount         Int          @default(0) @map("failure_count")
  healthStatus         SourceHealth @default(HEALTHY) @map("health_status")
  createdAt            DateTime     @default(now()) @map("created_at")
  updatedAt            DateTime     @updatedAt @map("updated_at")

  company Company @relation(fields: [companyId], references: [id], onDelete: Cascade)

  @@unique([companyId, sourceType, externalIdentifier])
  @@index([companyId])
  @@index([sourceType])
  @@map("company_sources")
}

model Job {
  id                      String         @id @default(uuid())
  companyId               String         @map("company_id")
  externalJobId           String?        @map("external_job_id")
  sourceType              String         @map("source_type")
  sourceName              String         @map("source_name")
  sourceUrl               String         @map("source_url")
  applicationUrl          String?        @map("application_url")

  title                   String
  description             String
  responsibilities        String[]       @default([])
  requirements            String[]       @default([])
  preferredQualifications String[]       @default([]) @map("preferred_qualifications")

  location                String?
  country                 String?
  city                    String?
  stateProvince           String?        @map("state_province")

  remoteType              RemoteType     @default(UNKNOWN) @map("remote_type")
  employmentType          EmploymentType @default(FULL_TIME) @map("employment_type")

  salaryMin               Decimal?       @map("salary_min") @db.Decimal(12, 2)
  salaryMax               Decimal?       @map("salary_max") @db.Decimal(12, 2)
  salaryCurrency          String?        @map("salary_currency")

  experienceMin           Float?         @map("experience_min")
  experienceMax           Float?         @map("experience_max")

  education               String?

  postedAt                DateTime?      @map("posted_at")
  firstSeenAt             DateTime       @default(now()) @map("first_seen_at")
  lastSeenAt              DateTime       @default(now()) @map("last_seen_at")
  lastCheckedAt           DateTime       @default(now()) @map("last_checked_at")

  contentHash             String         @unique @map("content_hash")
  status                  JobStatus      @default(ACTIVE)

  createdAt               DateTime       @default(now()) @map("created_at")
  updatedAt               DateTime       @updatedAt @map("updated_at")

  company                 Company        @relation(fields: [companyId], references: [id], onDelete: Cascade)
  skills                  JobSkill[]

  @@index([companyId])
  @@index([title])
  @@index([country])
  @@index([city])
  @@index([remoteType])
  @@index([employmentType])
  @@index([status])
  @@index([postedAt])
  @@index([sourceType])
  @@index([sourceType, externalJobId])
  @@map("jobs")
}
```

---

## 3. Connector Pipeline Architecture

```
[External Boards]
   ├── Codewalla (Web Scraper)
   ├── Greenhouse (Public API)
   ├── Lever (Public API)
   └── Ashby (Public API)
           │
           ▼
[IJobSourceConnector Adapter]
           │
           ▼
[JobNormalizationService]
   ├── Safe HTML Sanitization (cheerio)
   ├── Canonical Field Mapping (Remote, Employment, Location)
   ├── Deterministic Content Hashing (SHA-256)
   └── Skill Tag Extraction (REQUIRED vs PREFERRED)
           │
           ▼
[CompanyRepository]
   ├── Resolve/Deduplicate Company by Official Domain
   └── Register/Update CompanySource & Health
           │
           ▼
[JobRepositoryV1]
   ├── Deduplicate on (sourceType, externalJobId) OR contentHash
   ├── Upsert: New -> INSERT, Existing -> UPDATE freshness & mutable fields
   └── Link canonical skills to Skill catalog
           │
           ▼
[PostgreSQL Database] (Indexed search, multi-filter query, pagination)
```

---

## 4. Freshness and Expiration Rules

- Every ingestion run records `lastSeenAt` and `lastCheckedAt`.
- If a transient connector failure occurs, existing jobs remain intact.
- Jobs not seen across crawls for over **14 days** are transitioned from `ACTIVE` to `EXPIRED` via `JobRepositoryV1.expireStaleJobs(14)`.
- Re-appearance of an expired job resets status to `ACTIVE` and refreshes `lastSeenAt`.

---

## 5. Security & Isolation

- **HTML Sanitization**: Job descriptions originating from external third parties are treated as untrusted input. Scripts, style tags, objects, embeds, and malicious HTML event handlers are purged via Cheerio before persistence.
- **Privacy Assurance**: Ingestion connectors only read public job listings. Candidate credentials, resumes, and personal information are strictly excluded and never forwarded to external employers.
- **Manual Application Links**: The UI presents "Apply / Source" buttons that redirect the candidate to the external ATS or career site. No automatic form submission or robotic application submission occurs.
