# Pilot Mama V1 - Product Requirements Document (PRD)

> **Document Status**: Production Baseline Specification  
> **Target Version**: Pilot Mama V1.0  
> **Product Brand**: Pilot Mama  
> **Repository**: `codfisconnect/JobPilot-AI`  
> **Branch**: `develop`  
> **Target Audience**: Product, Engineering, QA, Operations  

---

## 1. Product Vision & Executive Summary

**Pilot Mama** is an intelligent, ethical career navigation platform designed to bridge the gap between job candidates, hiring employers, and educational institutions. 

While legacy job portals act as passive bulletin boards, Pilot Mama acts as an **Active Career Copilot**. It continuously analyzes candidate qualifications against live market demand, maps skill deficiencies, synthesizes evidence-backed tailored application materials, guides high-conversion applications, and provides targeted interview preparation and upskilling pathways.

### Core Philosophy: "Integrity-First AI"
Modern job boards and AI tools encourage reckless resume exaggeration or spray-and-pray applications that pollute hiring pipelines and damage applicant credibility. Pilot Mama operates on **Zero Fabrication Principles**:
1. AI will **never** invent employment history, job titles, tenures, certifications, or accomplishments.
2. AI optimizes relevance, framing, and terminology strictly using substantiated evidence already existing in the candidate's master profile.
3. Matching scores transparently separate **Hard ATS Keyword Compatibility** from **Deep Semantic Capability Match**.

---

## 2. Problem Statement

### For Job Candidates
- **The ATS Black Hole**: Qualified candidates get automatically rejected because resume wording fails syntactic keyword filters.
- **Application Fatigue**: Applying to hundreds of roles with generic resumes yields sub-2% response rates.
- **Ambiguous Rejection Reasons**: Candidates do not know whether rejection was due to missing core skills, seniority mismatch, or poor formatting.
- **Skill Gap Blindspots**: Candidates lack concrete roadmaps showing which specific missing skills will unlock the highest volume of target job opportunities.

### For Employers
- **High-Noise Inboxes**: Hundreds of non-tailored or hallucinated AI resumes flood ATS systems without verifiable qualifications.
- **Long Time-to-Fill**: Manual screening of bloated applications delays hiring cycles.

### For Educational Institutes
- **Disconnection from Live Market Demand**: Curricula lag behind real-time corporate technical demands.
- **Placement Visibility Gaps**: Career centers struggle to track student application pipelines and guide students toward high-probability openings.

---

## 3. Target User Personas & Roles

| Role | Primary Goal | Key Interaction with Pilot Mama |
| :--- | :--- | :--- |
| **Candidate** | Land high-fit roles faster with verified, tailored applications. | Upload master resume, discover verified jobs, review skill gaps, generate tailored resumes, prepare for interviews. |
| **Employer** | Hire verified talent with transparent skill matches and reduced screening time. | Post jobs, access pipeline dashboards, review matched candidates, manage applicants. |
| **Institute** | Elevate graduate placement rates and monetize targeted training. | Maintain institution profile, publish accredited courses mapped to live skill gaps, view student cohort analytics. |
| **Admin** | Maintain platform health, monitor data hygiene, oversee monetization and moderation. | System metrics, job scraping health, AI gateway rate limits, user management, audit logging. |

---

## 4. Product Modules Overview

```
┌────────────────────────────────────────────────────────────────────────┐
│                          PILOT MAMA PLATFORM                           │
├───────────────┬─────────────────┬───────────────────┬──────────────────┤
│ 1. Identity   │ 2. Job Engine   │ 3. AI Copilot     │ 4. Ecosystem     │
│   & Profile   │                 │                   │                  │
├───────────────┼─────────────────┼───────────────────┼──────────────────┤
│ • Auth & RBAC │ • Ingestion Hub │ • Match Engine    │ • Application Hub│
│ • Master CV   │ • Canonical DB  │ • Skill Gap Radar │ • Learning Hub   │
│ • Structured  │ • ATS Sources   │ • Resume Studio   │ • Interview Prep │
│   Profile     │ • Company Index │ • ATS Validator   │ • Monetization   │
└───────────────┴─────────────────┴───────────────────┴──────────────────┘
```

---

## 5. End-to-End Candidate Journey (V1)

```
[1. Registration & Auth]
        ↓
[2. Master Resume Upload] ──> (Multi-format Parser extracts skills, work history, projects)
        ↓
[3. Profile Curation] ─────> (Candidate confirms & enriches structured profile)
        ↓
[4. Job Discovery] ────────> (Ingested canonical jobs with multi-filter search)
        ↓
[5. Deep Job Analysis] ────> (Deconstructs required skills, experience, company context)
        ↓
[6. Match & Gap Engine] ───> (Computes ATS score, Semantic Match, identifies Skill Gaps)
        ↓
[7. Tailoring Studio] ─────> (Generates Full, Focused, or Targeted tailored resume draft)
        ↓
[8. Truth & Leakage Check] > (Verifies zero hallucinations & prevents target employer leaks)
        ↓
[9. Export & Validation] ──> (Clean PDF/DOCX generated with strict ATS typographic safety)
        ↓
[10. Application Action] ──> (Redirect, Assisted Form Fill, or Supported Integration)
        ↓
[11. Tracker & Learning] ──> (Kanban tracking + curated course recommendations for gaps)
        ↓
[12. Interview Readiness] ─> (Generates STAR questions, technical prompts, company prep)
```

---

## 6. Detailed Feature Scope Classification

### A. Confirmed V1 Requirements (Core Launch)
1. **Unified Authentication & Security**: Email/password authentication, JWT session management, RBAC (Candidate vs Admin), secure password hashing (Argon2/Bcrypt), CSRF/CORS protections.
2. **Master Profile & Structured Resume Store**: Normalized candidate skills, verified experiences, education, and portfolio links. Multiple resume versions linked to single profile.
3. **Multi-Source Job Ingestion**: Connectors for ATS systems (Greenhouse, Lever, Ashby, Workable) and verified career pages with content hashing, deduplication, and freshness monitoring.
4. **Deterministic & Semantic Matching Engine**: Dual-score paradigm (ATS Keyword Compatibility vs Deep Semantic Capability Match).
5. **Truth-Enforced Resume Tailoring**: Contextual bullet point reordering and phrasing optimization with deterministic hallucination detection and company leakage guardrails.
6. **Application Tracking Subsystem**: Multi-state Kanban tracking (Saved, Applied, Interviewing, Offered, Rejected) with immutable audit events.
7. **Skill Gap & Learning Hub**: Actionable breakdown of missing skills with direct links to learning resources and partner educational institutes.
8. **Interview Preparation Copilot**: Job-specific behavioral, technical, and situational interview generation with STAR framing guidelines.
9. **Responsive High-Performance UI**: Dark/Light mode theme engine, full mobile/tablet/desktop responsive compliance (320px to 1920px+).

### B. Proposed Architecture (Foundation Built in V1, Activated in V1.x)
1. **Credit-Based Monetization Gateway**: Database ledger for tokenized feature usage (Resume tailoring, Cover letters, AI interview prep).
2. **Institute Partner Program**: Verified badges and course placement linkage mapped to specific skill gap nodes.
3. **Direct Employer Job Postings**: Self-serve portal for direct vacancy creation.
4. **Automated Application Fill Extension**: Production extension bridge consuming common REST APIs for assisted form completion.

### C. Future Enhancements (Post-V1 Roadmap)
1. **Native Mobile Applications**: React Native / Expo shared client for iOS and Android.
2. **Automated Headless Submissions**: Fully automated background application dispatch where ATS APIs explicitly permit.
3. **Employer Pipeline Screening Suite**: Direct candidate matching search for recruiters with candidate privacy consent.
4. **Institutional LMS Integrations**: LTI (Learning Tools Interoperability) integrations with university portals.

---

## 7. Monetization Concepts (Non-Pricing Framework)

The monetization model is built around fair usage, compute cost recovery, and value realization across three distinct stakeholders:

### Candidate Model
- **Free Tier**: Complete job discovery, manual application tracking, master profile storage, up to 3 basic ATS match scores per month, general learning roadmaps.
- **Premium Tier (Credit-Based)**: Monthly allocation of compute credits. Credits are debited for compute-intensive AI operations:
  - High-precision resume tailoring & PDF/DOCX compilation.
  - Deep ATS validation runs.
  - Custom STAR-method interview simulator generation.
  - Cover letter synthesis.

### Employer Model
- **Direct Vacancy Listings**: Pay-per-listing or active job bundle slots.
- **Featured / Sponsored Postings**: Highlighted placement on search result pages, marked with non-intrusive transparency indicators while respecting algorithmic skill relevance.
- **Candidate Talent Pool Sourcing**: Tiered seats to search anonymized candidate profiles who have opted into recruiter discovery.

### Institute Model
- **Accredited Partner Profiles**: Institutional directory listings for verified colleges, bootcamps, and certification bodies.
- **Skill-Gap Course Affiliation**: Qualified course recommendations presented to candidates when relevant skill deficiencies are identified.
- **Student Cohort Analytics**: Enterprise portal for university career centers to track graduate employment trends.

---

## 8. International & Cross-Platform Requirements

### Global Job Market Support
- **Multi-Currency & Salary Normalization**: Ingestion must parse and normalize diverse compensation formats (USD, EUR, GBP, INR, AED, CAD, remote hourly).
- **Location & Remote Archetypes**: Canonical classification into `On-site`, `Hybrid`, `Fully Remote (Global)`, and `Remote (Timezone/Geo-bounded)`.
- **International Resume Standards**: Export engine must support standard US Letter (8.5" x 11") and International A4 (210mm x 297mm) geometries with configurable personal info sections (e.g., omitting photos and marital status to meet US/UK/EU anti-discrimination laws).

### Multi-Device Responsiveness
- All views must guarantee touch ergonomics (minimum 44px hit targets), safe area insets for iOS Dynamic Island and gesture indicators, and responsive card-to-table transformations across small phones, foldables, tablets, and desktop widescreen displays.
