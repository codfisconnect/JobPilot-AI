# Monetization & Credit Economics Specification

> **Document Status**: Production Baseline Specification  
> **Target Version**: Pilot Mama V1.0  
> **Location**: `docs/product/monetization.md`  

---

## 1. Monetization Philosophy & Architecture

Pilot Mama adopts a **Value-Aligned Credit & Subscription Architecture**. 

Rather than charging candidates simply to view open jobs, all core discovery and basic tracking features are completely free. Monetization is applied exclusively to **compute-intensive AI operations** and **enterprise employer/institute enablement**.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        PILOT MAMA MONETIZATION TRIAD                   │
├─────────────────────┬──────────────────────────┬───────────────────────┤
│ 1. Candidate Stream │ 2. Employer Stream       │ 3. Institute Stream   │
├─────────────────────┼──────────────────────────┼───────────────────────┤
│ • Credit Allocation │ • Direct Job Postings    │ • Partner Directory   │
│ • Premium Tiers     │ • Sponsored Listings     │ • Course Placement    │
│ • Resume Generation │ • Talent Pool Sourcing   │ • Verified Badging    │
│ • Deep AI Analysis  │ • Pipeline Access        │ • Student Cohort Hub  │
└─────────────────────┴──────────────────────────┴───────────────────────┘
```

---

## 2. Candidate Monetization Model

### 2.1. Tier Structure (Conceptual Framework)
*Note: Pricing figures are illustrative tokens only; actual currency pricing will be finalized closer to commercial launch.*

- **Free Tier (Default)**:
  - Unlimited job search and browsing.
  - Manual application tracking (Kanban board).
  - Master profile storage and parsing.
  - 3 Basic ATS compatibility checks per calendar month.
  - Baseline skill-gap summaries.
- **Basic Premium Tier**:
  - Higher monthly credit allocation.
  - Tailored resume generation (Full, Focused, Targeted archetypes).
  - PDF and DOCX document exports.
  - Deep ATS validation with entity-level gap analysis.
- **Pro Tier**:
  - Generous monthly credit allocation.
  - Advanced STAR-method AI interview simulation packages.
  - Personalized cover letter generation.
  - Assisted form-fill browser extension priority.
  - Target company deep analysis and architectural interview prep.

### 2.2. Credit Economics & Debit Table
All AI actions are governed by an internal credit ledger (`credits` and `credit_transactions` tables). This decouples payment providers from application logic and prevents AI compute runaway costs:

| Action / Operation | Compute Intensity | Credit Cost (Units) |
| :--- | :--- | :---: |
| Basic ATS Match Check | Low (Cached / Rule-based) | Free (Quota-bounded) |
| Deep Semantic Match & Gap Diagnostic | Medium | 5 Credits |
| Resume Tailoring (Full / Focused / Targeted) | High (Multi-stage LLM + Truth Guard) | 20 Credits |
| Precision ATS Export (PDF / DOCX Compilation) | Low-Medium | 5 Credits |
| Personalized Cover Letter Generation | Medium | 10 Credits |
| Comprehensive STAR Interview Prep Simulator | High (Role-specific scenario generation) | 25 Credits |

---

## 3. Employer Monetization Model

### 3.1. Direct Job Vacancy Slots
- **Single Job Posting**: 30-day active listing indexed across search channels.
- **Subscription Bundles**: Packaged monthly slots for high-volume hiring teams (e.g. 5, 10, or 25 active concurrent postings).

### 3.2. Sponsored Job Listings
- Employers can sponsor specific vacancies to appear at the top of relevant candidate search feeds.
- **Algorithmic Integrity Safeguard**: Sponsored listings are clearly labelled with a distinct **"Sponsored"** tag. Furthermore, listings will only appear to candidates who possess a minimum algorithmic match threshold (>60%) to prevent irrelevant spam from degrading candidate trust.

### 3.3. Talent Discovery Access (Post-V1)
- Access to search anonymized, verified candidate profiles who have explicitly opted into recruiter outreach.

---

## 4. Institute & Educational Partner Monetization

### 4.1. Accredited Course Catalog Placement
- Educational academies, bootcamps, and universities can list verified programs.
- When candidates analyze job requirements and display specific skill gaps, matching partner courses are presented as actionable bridge pathways.

### 4.2. Sponsored Course Recommendations
- Institutes can sponsor course recommendations for high-demand skill nodes (e.g., *AWS Cloud Architecture*, *Rust Systems Engineering*).
- **Quality & Relevance Mandate**: Sponsored courses must strictly cover the specific missing skill nodes identified in the candidate's diagnostic. Irrelevant course spam is barred by automated taxonomy validation.

### 4.3. Institutional Cohort Portal (Enterprise)
- Annual subscription for university career centers to track student cohort employment outcomes and skill trends across live job markets.
