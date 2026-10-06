# Database Architecture Specification

> **Document Status**: Production Baseline Specification  
> **Target Version**: Pilot Mama V1.0  
> **Target Engine**: PostgreSQL 16+  
> **Location**: `docs/architecture/database-architecture.md`  

---

## 1. Schema Design Principles

The Pilot Mama database architecture adheres to enterprise-grade relational modeling standards:
- **Strict Normalization**: Core business data is structured in Third Normal Form (3NF) to eliminate data duplication and enforce integrity.
- **Relational Integrity**: Foreign keys with appropriate `ON DELETE CASCADE` or `ON DELETE RESTRICT` constraints safeguard against orphaned records.
- **JSONB for Semi-Structured Attributes**: High-variability metadata (e.g., raw ATS metadata, AI extraction telemetry, custom style configurations) is stored in PostgreSQL `JSONB` columns with GIN indexing.
- **Auditability & Traceability**: All primary entities include `created_at` and `updated_at` timestamps, alongside soft-deletion flags (`deleted_at`) where compliance mandates.
- **UUID Primary Keys**: Uses UUID v4 for distributed security, preventing enumerable URL scraping attacks.

---

## 2. Entity-Relationship Overview

```
 [ users ] ──< [ candidate_profiles ] ──< [ experiences ]
     │                    │             ──< [ education ]
     │                    │             ──< [ certifications ]
     │                    │             ──< [ projects ]
     │                    │             ──< [ candidate_skills ]
     │                    │
     │                    ├──< [ resumes ] ──< [ resume_versions ]
     │                    └──< [ candidate_preferences ]
     │
     ├──< [ applications ] ──< [ application_events ]
     │           │
     │           └──> [ jobs ] ──< [ job_skills ]
     │                   │
     │                   └──> [ companies ] ──< [ company_sources ]
     │
     ├──< [ credits ] ──< [ credit_transactions ]
     └──< [ subscriptions ]
```

---

## 3. Entity Definitions & DDL Specifications

### 3.1. Identity, Users, and Roles

#### `users` *(REQUIRED FOR V1)*
Core authentication entity for all platform participants.
- `id`: `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `email`: `VARCHAR(255) UNIQUE NOT NULL`
- `password_hash`: `VARCHAR(255) NOT NULL`
- `role`: `VARCHAR(50) NOT NULL` (`candidate`, `employer`, `institute`, `admin`)
- `is_active`: `BOOLEAN NOT NULL DEFAULT true`
- `email_verified`: `BOOLEAN NOT NULL DEFAULT false`
- `created_at`: `TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `updated_at`: `TIMESTAMPTZ NOT NULL DEFAULT NOW()`

#### `roles` & `permissions` *(REQUIRED FOR V1)*
Role definitions and fine-grained permission assignments.
- `id`: `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `name`: `VARCHAR(50) UNIQUE NOT NULL`
- `description`: `TEXT`

---

### 3.2. Candidate Profiles & Master Resume Subsystem

#### `candidate_profiles` *(REQUIRED FOR V1)*
Master candidate persona and contact baseline.
- `id`: `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `user_id`: `UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE`
- `full_name`: `VARCHAR(255) NOT NULL`
- `headline`: `VARCHAR(255)`
- `phone`: `VARCHAR(50)`
- `location`: `VARCHAR(255)`
- `bio`: `TEXT`
- `linkedin_url`: `VARCHAR(255)`
- `github_url`: `VARCHAR(255)`
- `portfolio_url`: `VARCHAR(255)`
- `created_at`: `TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `updated_at`: `TIMESTAMPTZ NOT NULL DEFAULT NOW()`

#### `candidate_preferences` *(REQUIRED FOR V1)*
Job hunting criteria and search parameters.
- `id`: `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `candidate_id`: `UUID UNIQUE NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE`
- `target_roles`: `TEXT[]` (e.g. `['Full Stack Engineer', 'Frontend Lead']`)
- `work_modes`: `VARCHAR(50)[]` (`remote`, `hybrid`, `onsite`)
- `preferred_locations`: `TEXT[]`
- `min_salary`: `INTEGER`
- `currency`: `VARCHAR(10) DEFAULT 'USD'`
- `created_at`: `TIMESTAMPTZ NOT NULL DEFAULT NOW()`

#### `resumes` & `resume_versions` *(REQUIRED FOR V1)*
Storage of candidate master documents and target-tailored variations.
- **`resumes`**:
  - `id`: `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
  - `candidate_id`: `UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE`
  - `title`: `VARCHAR(255) NOT NULL`
  - `is_master`: `BOOLEAN NOT NULL DEFAULT false`
  - `file_path`: `VARCHAR(512)` (Storage key in Object Storage)
  - `raw_text`: `TEXT`
  - `parsed_data`: `JSONB`
  - `created_at`: `TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- **`resume_versions`**:
  - `id`: `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
  - `resume_id`: `UUID NOT NULL REFERENCES resumes(id) ON DELETE CASCADE`
  - `job_id`: `UUID REFERENCES jobs(id) ON DELETE SET NULL`
  - `version_name`: `VARCHAR(255) NOT NULL`
  - `strategy`: `VARCHAR(50) NOT NULL` (`full`, `focused`, `targeted`)
  - `structured_content`: `JSONB NOT NULL` (Tailored sections and bullet points)
  - `pdf_path`: `VARCHAR(512)`
  - `docx_path`: `VARCHAR(512)`
  - `ats_score`: `INTEGER`
  - `created_at`: `TIMESTAMPTZ NOT NULL DEFAULT NOW()`

#### Candidate Sub-Entities *(REQUIRED FOR V1)*
- **`candidate_skills`**: `id`, `candidate_id`, `skill_name`, `category` (technical, soft, tool), `years_of_experience`, `verified`.
- **`experiences`**: `id`, `candidate_id`, `company_name`, `role_title`, `location`, `start_date`, `end_date`, `is_current`, `description`, `highlights` (`TEXT[]`).
- **`education`**: `id`, `candidate_id`, `institution`, `degree`, `field_of_study`, `start_date`, `end_date`, `grade`.
- **`certifications`**: `id`, `candidate_id`, `name`, `issuing_organization`, `issue_date`, `expiration_date`, `credential_url`.
- **`projects`**: `id`, `candidate_id`, `title`, `description`, `technologies` (`TEXT[]`), `project_url`, `repository_url`.

---

### 3.3. Companies, Job Sources, and Jobs

#### `companies` *(REQUIRED FOR V1)*
Employer organizational registry.
- `id`: `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `name`: `VARCHAR(255) UNIQUE NOT NULL`
- `domain`: `VARCHAR(255) UNIQUE`
- `logo_url`: `VARCHAR(512)`
- `website`: `VARCHAR(512)`
- `industry`: `VARCHAR(100)`
- `headquarters`: `VARCHAR(255)`
- `is_verified`: `BOOLEAN NOT NULL DEFAULT false`
- `created_at`: `TIMESTAMPTZ NOT NULL DEFAULT NOW()`

#### `company_sources` *(REQUIRED FOR V1)*
Ingestion connectors and ATS polling configurations.
- `id`: `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `company_id`: `UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE`
- `source_type`: `VARCHAR(50) NOT NULL` (`greenhouse`, `lever`, `ashby`, `workable`, `generic_career_page`)
- `source_url`: `VARCHAR(512) NOT NULL`
- `last_sync_at`: `TIMESTAMPTZ`
- `sync_status`: `VARCHAR(50) DEFAULT 'idle'` (`idle`, `in_progress`, `healthy`, `degraded`, `failing`)
- `error_count`: `INTEGER DEFAULT 0`
- `metadata`: `JSONB`

#### `jobs` *(REQUIRED FOR V1)*
Canonical job vacancies indexed by Pilot Mama.
- `id`: `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `company_id`: `UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT`
- `source_id`: `UUID REFERENCES company_sources(id) ON DELETE SET NULL`
- `external_id`: `VARCHAR(255)`
- `title`: `VARCHAR(255) NOT NULL`
- `department`: `VARCHAR(100)`
- `location`: `VARCHAR(255) NOT NULL`
- `work_mode`: `VARCHAR(50) NOT NULL` (`remote`, `hybrid`, `onsite`)
- `experience_level`: `VARCHAR(50)` (`entry`, `mid`, `senior`, `lead`, `executive`)
- `salary_min`: `INTEGER`
- `salary_max`: `INTEGER`
- `currency`: `VARCHAR(10) DEFAULT 'USD'`
- `description_raw`: `TEXT NOT NULL`
- `description_structured`: `JSONB`
- `apply_url`: `VARCHAR(1024) NOT NULL`
- `content_hash`: `VARCHAR(64) NOT NULL` (SHA-256 for duplicate detection)
- `is_active`: `BOOLEAN NOT NULL DEFAULT true`
- `is_sponsored`: `BOOLEAN NOT NULL DEFAULT false`
- `posted_at`: `TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `expires_at`: `TIMESTAMPTZ`
- `created_at`: `TIMESTAMPTZ NOT NULL DEFAULT NOW()`

#### `job_skills` *(REQUIRED FOR V1)*
Extracted skill requirements linked to canonical jobs.
- `id`: `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `job_id`: `UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE`
- `skill_name`: `VARCHAR(100) NOT NULL`
- `is_required`: `BOOLEAN NOT NULL DEFAULT true`
- `proficiency_tier`: `VARCHAR(50)` (`foundational`, `proficient`, `expert`)

---

### 3.4. Applications Subsystem

#### `applications` *(REQUIRED FOR V1)*
Candidate job application tracking.
- `id`: `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `candidate_id`: `UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE`
- `job_id`: `UUID NOT NULL REFERENCES jobs(id) ON DELETE RESTRICT`
- `resume_version_id`: `UUID REFERENCES resume_versions(id) ON DELETE SET NULL`
- `mode`: `VARCHAR(50) NOT NULL` (`redirect`, `assisted`, `automated`)
- `status`: `VARCHAR(50) NOT NULL` (`saved`, `applied`, `screening`, `interviewing`, `offered`, `rejected`, `withdrawn`)
- `notes`: `TEXT`
- `applied_at`: `TIMESTAMPTZ`
- `created_at`: `TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `updated_at`: `TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- *Constraint*: `UNIQUE(candidate_id, job_id)` (Strictly prevents duplicate applications)

#### `application_events` *(REQUIRED FOR V1)*
Immutable timeline log of application transitions.
- `id`: `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `application_id`: `UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE`
- `event_type`: `VARCHAR(50) NOT NULL` (`status_changed`, `interview_scheduled`, `note_added`)
- `old_status`: `VARCHAR(50)`
- `new_status`: `VARCHAR(50)`
- `notes`: `TEXT`
- `occurred_at`: `TIMESTAMPTZ NOT NULL DEFAULT NOW()`

#### `application_questions` & `application_answers` *(FUTURE)*
Assisted application form field mapping and storage.

---

### 3.5. Learning, Institutes, and Courses

#### `institutes` *(REQUIRED FOR V1 FOUNDATION)*
Educational organizations and academies.
- `id`: `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `name`: `VARCHAR(255) UNIQUE NOT NULL`
- `description`: `TEXT`
- `website`: `VARCHAR(512)`
- `logo_url`: `VARCHAR(512)`
- `is_verified`: `BOOLEAN DEFAULT false`
- `created_at`: `TIMESTAMPTZ NOT NULL DEFAULT NOW()`

#### `courses` & `learning_resources` *(REQUIRED FOR V1 FOUNDATION)*
Targeted training materials mapped to skill gaps.
- `id`: `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `institute_id`: `UUID REFERENCES institutes(id) ON DELETE CASCADE`
- `title`: `VARCHAR(255) NOT NULL`
- `description`: `TEXT`
- `url`: `VARCHAR(1024) NOT NULL`
- `duration`: `VARCHAR(50)`
- `format`: `VARCHAR(50)` (`self_paced`, `cohort`, `certificate`)
- `skills_covered`: `TEXT[]` NOT NULL
- `is_sponsored`: `BOOLEAN NOT NULL DEFAULT false`
- `created_at`: `TIMESTAMPTZ NOT NULL DEFAULT NOW()`

#### `sponsored_listings` *(FUTURE)*
Monetized ranking promotions for courses and job listings.

---

### 3.6. Subscriptions, Credits, and Billing

#### `plans` & `subscriptions` *(FUTURE IN V1.x)*
Subscription tiers and billing lifecycle.
- **`plans`**: `id`, `name`, `code`, `monthly_credits`, `price_cents`, `currency`, `features` (`JSONB`).
- **`subscriptions`**: `id`, `user_id`, `plan_id`, `status`, `current_period_start`, `current_period_end`, `external_customer_id`, `external_subscription_id`.

#### `credits` & `credit_transactions` *(REQUIRED FOR V1 FOUNDATION)*
Token ledger governing AI compute allocations.
- **`credits`**:
  - `id`: `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
  - `user_id`: `UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE`
  - `balance`: `INTEGER NOT NULL DEFAULT 100`
  - `updated_at`: `TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- **`credit_transactions`**:
  - `id`: `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
  - `user_id`: `UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE`
  - `amount`: `INTEGER NOT NULL` (Negative for deductions, positive for top-ups)
  - `action`: `VARCHAR(50) NOT NULL` (`resume_tailor`, `ats_analysis`, `interview_prep`, `monthly_grant`)
  - `reference_id`: `UUID` (e.g. `resume_version_id`)
  - `created_at`: `TIMESTAMPTZ NOT NULL DEFAULT NOW()`

---

### 3.7. AI Gateway Telemetry & Auditability

#### `ai_requests` & `ai_usage` *(REQUIRED FOR V1)*
Tracking AI gateway invocations, costs, and token consumption.
- `id`: `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `user_id`: `UUID REFERENCES users(id) ON DELETE SET NULL`
- `provider`: `VARCHAR(50) NOT NULL` (`gemini`, `openai`)
- `model_name`: `VARCHAR(50) NOT NULL`
- `operation`: `VARCHAR(50) NOT NULL` (`resume_parse`, `job_parse`, `matching`, `tailoring`, `interview_prep`)
- `prompt_tokens`: `INTEGER NOT NULL`
- `completion_tokens`: `INTEGER NOT NULL`
- `latency_ms`: `INTEGER NOT NULL`
- `status`: `VARCHAR(20) NOT NULL` (`success`, `fallback`, `error`)
- `error_message`: `TEXT`
- `created_at`: `TIMESTAMPTZ NOT NULL DEFAULT NOW()`

#### `audit_logs` & `notifications` *(REQUIRED FOR V1)*
- **`audit_logs`**: `id`, `user_id`, `action`, `entity_type`, `entity_id`, `ip_address`, `user_agent`, `created_at`.
- **`notifications`**: `id`, `user_id`, `title`, `body`, `type`, `is_read`, `link_url`, `created_at`.
