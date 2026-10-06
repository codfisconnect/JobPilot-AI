# Pilot Mama User Journeys Specification

> **Document Status**: Production Baseline Specification  
> **Target Version**: Pilot Mama V1.0  
> **Location**: `docs/product/user-journeys.md`  

---

## 1. Candidate Journey

The Candidate journey is the core workflow of Pilot Mama, driving user acquisition, engagement, and conversion through an end-to-end career copilot experience.

```
       [ 1. Onboarding & Parsing ]
                    │
                    ▼
       [ 2. Profile Verification ]
                    │
                    ▼
       [ 3. Discovery & Matching ]
                    │
                    ▼
       [ 4. Skill-Gap & Strategy ]
                    │
                    ▼
       [ 5. Resume Tailoring Studio ]
                    │
                    ▼
       [ 6. Application Execution ]
                    │
                    ▼
       [ 7. Interview Prep & Learning ]
```

### Stage 1: Onboarding & Resume Ingestion
- **Step 1.1**: Candidate registers via Email/Password or OAuth.
- **Step 1.2**: Uploads existing resume (PDF, DOCX, or TXT format).
- **Step 1.3**: The ingestion engine runs format validation, text extraction, and the AI Structured Parser.
- **Step 1.4**: Structured data is populated into the candidate's normalized store: contact details, professional summary, work experience items, education history, projects, certifications, and extracted technical/soft skills.

### Stage 2: Profile Verification & Preference Setup
- **Step 2.1**: Candidate reviews parsed profile in the Profile Studio, correcting dates, adjusting job titles, or adding unmentioned skills.
- **Step 2.2**: Sets career preferences: target job titles, preferred work modes (Remote, Hybrid, On-site), geographic preferences, minimum target salary, and industry domains.

### Stage 3: Job Discovery & Live Match Evaluation
- **Step 3.1**: Candidate browses curated job listings aggregated from corporate career portals and direct postings.
- **Step 3.2**: System triggers automated matching analysis for viewed jobs, displaying:
  - **ATS Compatibility Score (0-100%)**: Strict syntactic matching of required keywords and standard sections.
  - **Job Match Score (0-100%)**: Deep semantic capability match evaluating role seniority, experience relevance, and project impact.
  - **Match Breakdown**: Matched skills vs. missing critical skills.

### Stage 4: Skill-Gap Diagnostic & Career Strategy
- **Step 4.1**: Candidate navigates to Job Analysis or Learning Radar.
- **Step 4.2**: The engine categorizes deficiencies into:
  - *Immediate Bridges* (skills adjacent to candidate's existing stack, achievable in < 2 weeks).
  - *Significant Gaps* (foundational skills requiring dedicated training).
- **Step 4.3**: Candidate receives direct course recommendations and certified institute programs mapped specifically to bridge their identified gaps.

### Stage 5: Resume Tailoring Studio & Truth Guard
- **Step 5.1**: Candidate requests tailored resume generation for a specific target job.
- **Step 5.2**: Selects strategy archetype:
  - **Full Resume**: Comprehensive, multi-page archival document.
  - **Focused Resume**: High-impact 1-page format tailored for high-volume recruiter scanning.
  - **Targeted Resume**: Precision-aligned version emphasizing exact matches to the target position.
- **Step 5.3**: AI Generator rewrites bullet points to emphasize relevant projects and achievements.
- **Step 5.4**: **Zero-Fabrication Guard** runs:
  - Validates all generated entities against the Master Profile.
  - Rejects any invented dates, roles, or unauthorized credentials.
  - Validates **Target Company Leakage**: ensures the prospective employer's company name is never falsely injected into historical employment lines.
- **Step 5.5**: ATS Export Engine generates downloadable, cleanly formatted PDF or DOCX documents.

### Stage 6: Application Execution & Kanban Tracking
- **Step 6.1**: Candidate applies via supported mode:
  - **Redirect**: Click-through to employer's direct application URL with copied tailored credentials.
  - **Assisted**: Form-filling assistant via browser companion.
- **Step 6.2**: Application card is automatically registered in the Kanban Tracker with initial status `Applied` or `Saved`.
- **Step 6.3**: Candidate moves applications across stages: `Applied` ➔ `Screening` ➔ `Interviewing` ➔ `Offer` / `Rejected`.

### Stage 7: Interview Preparation & Readiness
- **Step 7.1**: Candidate initiates Interview Preparation Copilot for an active application.
- **Step 7.2**: Engine synthesizes targeted questions:
  - *Technical Deep Dives* on matched technologies.
  - *STAR-Method Behavioral Prompts* mapped to candidate's actual documented projects.
  - *Company-Specific Challenges* derived from the employer's business model.
- **Step 7.3**: Candidate practices and reviews model answer frameworks.

---

## 2. Employer Journey

The Employer journey empowers talent acquisition teams to hire verified talent with high efficiency.

```
       [ 1. Profile Claim & Setup ]
                    │
                    ▼
       [ 2. Vacancy Creation / Source Sync ]
                    │
                    ▼
       [ 3. Automated Ingestion & Indexing ]
                    │
                    ▼
       [ 4. Pipeline & Applicant Review ]
                    │
                    ▼
       [ 5. Candidate Outreach ]
```

### Stage 1: Profile Setup & Verification
- **Step 1.1**: Employer registers company domain account (e.g. `talent@acme.corp`).
- **Step 1.2**: Completes company profile: industry, headquarters, remote policies, brand bio, and logo.

### Stage 2: Job Publication & Source Sync
- **Step 2.1**: **Direct Posting**: Creates new job vacancies through a rich editor with structured skill tagging, experience range, and salary disclosure.
- **Step 2.2**: **ATS Source Sync**: Connects organization's career endpoint (Greenhouse, Lever, Ashby, or career page URL) for automated polling.

### Stage 3: Ingestion Normalization & Algorithmic Indexing
- **Step 3.1**: Platform processes jobs through the Canonical Ingestion Hub.
- **Step 3.2**: Extracts required technical skills, responsibilities, and experience tier.
- **Step 3.3**: Jobs become searchable across the candidate network.

### Stage 4: Applicant Review & Pipeline Management
- **Step 4.1**: Employer views inbound applications via the Candidate Pipeline.
- **Step 4.2**: Candidates are indexed with calculated match scores against the position criteria.
- **Step 4.3**: Recruiter inspects candidate's verified structured profile and tailored resume version.

### Stage 5: Candidate Progression
- **Step 5.1**: Recruiter updates candidate stage (`Under Review`, `Shortlisted`, `Interviewing`, `Archived`).
- **Step 5.2**: System notifies candidate of status change, fostering transparency and positive candidate sentiment.

---

## 3. Institute Journey

The Institute journey connects accredited education providers with motivated job seekers facing concrete skill gaps.

```
       [ 1. Institution Registration & Accreditation ]
                    │
                    ▼
       [ 2. Course & Program Catalog Publishing ]
                    │
                    ▼
       [ 3. Skill Taxonomy Mapping ]
                    │
                    ▼
       [ 4. Sponsored Placement & Engagement ]
                    │
                    ▼
       [ 5. Student Cohort Analytics ]
```

### Stage 1: Institutional Onboarding
- **Step 1.1**: University, bootcamp, or certification authority creates an institutional account.
- **Step 1.2**: Submits verification credentials (accreditation documents, official website).

### Stage 2: Course Catalog Publishing
- **Step 2.1**: Institute publishes training programs, bootcamps, and certification tracks.
- **Step 2.2**: Defines curriculum specifics: duration, format (self-paced, live cohort, hybrid), tuition, and prerequisites.

### Stage 3: Skill Taxonomy Alignment
- **Step 3.1**: Tags courses with standardized skill nodes from Pilot Mama's master ontology (e.g., `Kubernetes`, `System Design`, `Next.js`).
- **Step 3.2**: System establishes bidirectional links: whenever a candidate exhibits a deficit in those tagged skills, the institute's course becomes eligible for algorithmic recommendation.

### Stage 4: Sponsored Placements & Student Inquiries
- **Step 4.1**: Institute allocates sponsorship budget to feature courses prominently on skill-gap reports.
- **Step 4.2**: Candidates review course syllabus and request enrollment info directly from the recommendation card.
- **Step 4.3**: Institute manages inbound leads within their partner dashboard.

### Stage 5: Cohort Placement Insights (Post-V1)
- **Step 5.1**: Institute connects student cohort accounts to track aggregate graduate employment progress.
- **Step 5.2**: Receives real-time intelligence on which new industry skills are trending among hiring employers.

---

## 4. Admin Journey

The Admin journey ensures system health, data hygiene, compliance, and platform security.

```
       [ 1. System Telemetry & Health Monitoring ]
                    │
                    ▼
       [ 2. Job Ingestion & Spider Operations ]
                    │
                    ▼
       [ 3. AI Gateway Governance & Token Audit ]
                    │
                    ▼
       [ 4. User Moderation & Data Compliance ]
                    │
                    ▼
       [ 5. Revenue & Platform Configuration ]
```

### Stage 1: Daily Operations & Health Monitoring
- **Step 1.1**: Admin logs in via mandatory Multi-Factor Authentication.
- **Step 1.2**: Reviews system overview: active users, API error rates, database connection pools, queue latencies.

### Stage 2: Ingestion Pipeline Management
- **Step 2.1**: Inspects job source health dashboard (Greenhouse, Lever, Ashby, custom scrapers).
- **Step 2.2**: Reviews failed crawl alerts, SSL errors, or broken HTML parsers.
- **Step 2.3**: Triggers targeted connector recrawls or adjusts rate-limiting throttles.

### Stage 3: AI Gateway Governance & Cost Tracking
- **Step 3.1**: Monitors aggregate token consumption and cost burn across providers (Gemini, OpenAI fallback).
- **Step 3.2**: Inspects cache hit rates for job parsing and embedding calculations.
- **Step 3.3**: Tunes model temperature, timeout policies, or prompt version rollouts.

### Stage 4: User & Data Moderation
- **Step 4.1**: Reviews flagged job postings (scams, spam, illegal content) and purges violating listings.
- **Step 4.2**: Manages user privilege escalations and processes GDPR/CCPA data deletion requests.
- **Step 4.3**: Audits administrative activity through immutable system logs.
