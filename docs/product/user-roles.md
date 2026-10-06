# User Roles and Permissions Specification

> **Document Status**: Production Specification  
> **Applies to**: Pilot Mama V1.0  
> **Location**: `docs/product/user-roles.md`  

---

## 1. Role Matrix Overview

Pilot Mama implements a strict **Role-Based Access Control (RBAC)** architecture. System privileges are enforced at the API gateway layer via cryptographically signed JWT tokens containing immutable role declarations.

```
       ┌────────────────────────────────────────────────────────┐
       │                   PILOT MAMA USERS                     │
       └──────────────────────────┬─────────────────────────────┘
                                  │
         ┌────────────────────────┼─────────────────────────┐
         ▼                        ▼                         ▼
   ┌───────────┐            ┌───────────┐             ┌───────────┐
   │ Candidate │            │ Employer  │             │ Institute │
   └─────┬─────┘            └─────┬─────┘             └─────┬─────┘
         │                        │                         │
         └────────────────────────┼─────────────────────────┘
                                  ▼
                            ┌───────────┐
                            │   Admin   │  (Platform Management & Audit)
                            └───────────┘
```

---

## 2. Detailed Role Specifications

### 2.1. Candidate Role (`ROLE_CANDIDATE`)

The candidate represents the core consumer user seeking career advancement, job matches, and targeted skill acquisition.

#### A. Capabilities & Permissions
- **Master Profile Management**: Create, update, view, and delete personal candidate profile data (education, employment history, certifications, verified skills, contact links).
- **Resume Management**: Upload raw resume files (PDF, DOCX, TXT), trigger structured parsing, store master resume artifacts, generate tailored versions, and download generated artifacts.
- **Job Discovery & Search**: Query, filter, bookmark, and inspect canonical job postings across all ingested sources.
- **Match & Skill Gap Analysis**: Execute matching evaluations against any published job, inspect decomposed match criteria (Skill Match, Experience Match, Keyword Match), and inspect detailed missing skills.
- **Tailoring Studio**: Access the AI tailoring studio to generate full, focused, and targeted variations of their resume against specific job requirements.
- **Application Tracking**: Create, update, and manage job application statuses across the Kanban workflow (Saved, Applied, Interviewing, Offer, Rejected), add private interview notes, and log timeline events.
- **Learning & Upskilling**: View curated learning resources and accredited institutes mapped directly to their identified skill gaps.
- **Interview Simulator**: Generate personalized behavioral, technical, and company-specific interview prep questions based on matched jobs and candidate profiles.
- **Account & Privacy**: Update authentication credentials, manage theme preference (Dark/Light), request personal data export (GDPR compliance), or initiate account deletion.

#### B. Restricted Data & Actions
- **Cannot** view private candidate profiles or resumes belonging to other users.
- **Cannot** view raw ATS source credentials, ingestion webhook secrets, or internal AI model prompts.
- **Cannot** publish or syndicate public job listings on behalf of companies.
- **Cannot** access system analytics, billing ledgers of other users, or administrative audit logs.

#### C. Future Capabilities (Post-V1)
- Public shareable profile link (anonymized or verified public portfolio).
- Direct messaging with recruiting employers who unlock their profile.
- Automated browser extension syncing with zero-click form completion.

---

### 2.2. Employer Role (`ROLE_EMPLOYER`)

The employer persona represents recruiters, hiring managers, and talent acquisition leaders seeking to post jobs and source qualified candidates.

#### A. Capabilities & Permissions (V1 Foundation / V1.x)
- **Company Profile Management**: Claim, configure, and maintain company brand presence (logo, website, culture description, locations, social channels).
- **Direct Job Posting**: Create, edit, publish, pause, or close proprietary job listings directly into the Pilot Mama canonical job pool.
- **Source Sync Configuration**: Provide verified career page URLs or ATS job board endpoints (Greenhouse, Lever, Ashby board tokens) for automated periodic ingestion.
- **Inbound Applicant Review**: Review candidates who submitted direct or assisted applications for their own published jobs.
- **Analytics Dashboard**: View aggregate impressions, click-through rates to career pages, and applicant qualification distributions.

#### B. Restricted Data & Actions
- **Cannot** view candidate profiles who have not applied to their specific listings or explicitly opted into talent pool discovery.
- **Cannot** view candidate interview notes, private application tracker statuses from competing companies, or private candidate documents.
- **Cannot** edit job listings belonging to other organizations.
- **Cannot** access platform-wide user analytics or administrative configuration.

#### C. Future Capabilities (Post-V1)
- Proactive candidate sourcing search with AI match filters.
- Direct interview scheduling integrations (Google Calendar, Outlook).
- Team seats with role hierarchy (Recruiter, Hiring Manager, Billing Admin).

---

### 2.3. Institute Role (`ROLE_INSTITUTE`)

The institute persona represents colleges, universities, professional academies, and certification organizations.

#### A. Capabilities & Permissions (V1 Foundation / V1.x)
- **Institute Profile Management**: Maintain institution credentials, accreditation status, physical/online campus information, and branding.
- **Course & Program Catalog**: Publish and manage accredited courses, degree programs, and micro-credentials.
- **Skill Mapping**: Tag published courses with standardized taxonomy skills (e.g., mapping a "FastAPI Masterclass" to `Python`, `REST APIs`, `FastAPI`, `Asynchronous Architecture`).
- **Sponsored Placement Management**: Allocate sponsorship credits to elevate course visibility on relevant candidate skill gap analysis pages.
- **Inquiry & Lead Management**: Receive and review prospective student inquiries originating from skill gap recommendations.

#### B. Restricted Data & Actions
- **Cannot** view individual student resumes or private employment applications without student consent.
- **Cannot** publish job listings (must register separate Employer profile if hiring).
- **Cannot** override platform relevance algorithms for sponsored courses.

#### C. Future Capabilities (Post-V1)
- Enterprise Career Center portal to monitor aggregate student cohort employment outcomes.
- Bulk student onboarding and coupon distribution for career copilot features.

---

### 2.4. Admin Role (`ROLE_ADMIN`)

The administrative persona represents platform engineers, operations managers, and superusers responsible for system reliability, data hygiene, and security.

#### A. Capabilities & Permissions
- **User & Role Administration**: Inspect, elevate, suspend, or terminate user accounts across Candidate, Employer, and Institute roles.
- **Job Source Ingestion Operations**: Inspect ingestion connector health, trigger manual crawls/syncs, review crawl error logs, and manage connector rate limits.
- **Canonical Job Moderation**: Moderate, flag, edit, or purge spam, duplicate, or expired job postings from the central database.
- **AI Gateway & Cost Governance**: Inspect real-time token utilization, cost per feature, provider fallback health (Gemini, OpenAI), cache hit rates, and error frequencies.
- **Audit Logging & Security**: Inspect immutable audit logs, suspicious login attempts, file upload quarantine logs, and payment webhook reconciliation.
- **System Configuration**: Manage feature flags, update skill taxonomy definitions, and inspect system telemetry.

#### B. Restricted Data & Actions
- Protected by Mandatory Multi-Factor Authentication (MFA).
- Cannot decrypt raw candidate passwords (one-way hashing).
- Cannot access candidate private documents without an explicit logged audit event specifying legitimate support rationale.

---

## 3. Role Permission Matrix (Summary)

| Permission Scope | Candidate | Employer | Institute | Admin |
| :--- | :---: | :---: | :---: | :---: |
| `profile:read_own` / `profile:write_own` | ✅ | ✅ | ✅ | ✅ |
| `resume:upload` / `resume:tailor` / `resume:export` | ✅ | ❌ | ❌ | ✅ (Support Audit) |
| `jobs:read_public` | ✅ | ✅ | ✅ | ✅ |
| `jobs:create_direct` / `jobs:manage_own` | ❌ | ✅ | ❌ | ✅ |
| `jobs:moderate_all` / `sources:sync_manual` | ❌ | ❌ | ❌ | ✅ |
| `applications:manage_own` | ✅ | ❌ | ❌ | ❌ |
| `applications:view_inbound_own_jobs` | ❌ | ✅ | ❌ | ✅ |
| `courses:manage_own` | ❌ | ❌ | ✅ | ✅ |
| `system:metrics` / `ai:governance` / `users:manage` | ❌ | ❌ | ❌ | ✅ |
