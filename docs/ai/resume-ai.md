# Resume AI Subsystem Specification

> **Document Status**: Production Baseline Specification  
> **Target Version**: Pilot Mama V1.0  
> **Component**: Resume Parsing, Tailoring, Validation, and Compilation  
> **Location**: `docs/ai/resume-ai.md`  

---

## 1. Resume Subsystem Philosophy & Ground Rules

The Resume Subsystem is the flagship intelligence engine of Pilot Mama. Its fundamental mission is to optimize candidate presentation for maximum recruiter and ATS resonance **without compromising professional integrity**.

### 1.1. Absolute Rules of Resume Generation
1. **Zero Fabrication Policy**: The engine shall **NEVER** fabricate, exaggerate, or invent:
   - Employment roles, job titles, or company names
   - Employment tenures, start dates, or end dates
   - Academic degrees, institutions, or GPA scores
   - Certifications, licenses, or issuing bodies
   - Projects, repositories, or portfolio URLs
   - Metrics, revenue numbers, or scale statistics unless explicitly documented in the candidate's master profile
   - Programming languages, tools, or libraries not substantiated in master evidence
2. **Target Company Leakage Prohibition**:
   - The name of the target prospective employer **shall NEVER appear** within the candidate's historical employment records, projects, or summary as a previous employer or client unless the candidate genuinely worked there according to their verified master profile.
   - Injecting target company names into historical bullets is an amateur AI artifact that instantly disqualifies applicants in professional recruiting pipelines.
3. **No Fake 80%+ ATS Guarantees**:
   - The platform **strictly refuses** to inflate ATS compatibility scores to artificial high-water marks (e.g., claiming 85%+ match) when the candidate is fundamentally unqualified for the role.
   - Two transparent, distinct scores are provided:
     - **ATS Compatibility Score**: Mechanical keyword overlap and format readability.
     - **Job Match Score**: Deep contextual capability, role seniority, and domain alignment.

---

## 2. End-to-End Resume Processing Pipeline

```
┌────────────────────────────────────────────────────────────────────────┐
│                        1. MASTER RESUME INGESTION                      │
│   (PDF / DOCX Upload ──> Text Sanitization ──> AI Structured Parser)   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    2. STRUCTURED CANDIDATE PROFILE                     │
│    (Verified entities: Skills, History, Education, Projects, Metrics)   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        3. TARGET JOB DECONSTRUCTION                    │
│    (Identifies core competencies, keywords, seniority, domain context) │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        4. EVIDENCE-BASED TAILORING                     │
│    (Re-ranks experience, highlights relevant achievements, aligns terminology)│
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     5. AUTOMATED TRUTH & LEAKAGE AUDIT                 │
│    • Entity Validation: Verifies all tailored claims exist in master   │
│    • Leakage Check: Confirms target company name is not in history     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ PASS
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     6. ATS VALIDATION & EXPORT ENGINE                  │
│    (Computes ATS score, produces standard clean PDF/DOCX layouts)      │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Resume Tailoring Archetypes

The candidate can select one of three tailoring strategies depending on their career stage and application target:

### 3.1. Full Resume (Archival / Executive)
- **Target Audience**: Senior engineers, directors, research scientists, academia, federal positions.
- **Length**: Multi-page (2-4 pages).
- **Behavior**: Preserves complete employment chronology and all documented publications, projects, and credentials. Bullet points are subtly enhanced for keyword clarity without removing secondary accomplishments.

### 3.2. Focused Resume (High-Impact Fast Scan)
- **Target Audience**: General corporate recruitment, agencies, standard mid-level roles.
- **Length**: Strict 1-2 pages.
- **Behavior**: Prioritizes the top 3-4 most recent and relevant roles. Collapses older non-relevant positions into summary lines. Selects top 3 projects demonstrating skills directly asked for in the job description.

### 3.3. Targeted Resume (Precision Alignment)
- **Target Audience**: Highly specialized technical positions, competitive tier-1 employers.
- **Length**: Strict 1 page.
- **Behavior**: Mathematically optimizes space allocation towards the exact requirements of the target job posting. Bullet points are rewritten using the Action-Context-Result framework to directly reflect relevant skills found in the candidate's master experience.

---

## 4. Truth Validation & Leakage Detection Engine

Before any generated resume can be exported or saved as a version, it must pass through an automated, deterministic verification gate.

```typescript
export interface ValidationAuditResult {
  passed: boolean;
  violations: Array<{
    type: 'FABRICATED_SKILL' | 'FABRICATED_METRIC' | 'TARGET_COMPANY_LEAK' | 'DATE_MISMATCH';
    field: string;
    description: string;
  }>;
  atsCompatibilityScore: number;
  jobMatchScore: number;
}
```

### Deterministic Checks Enforced:
1. **Target Company Leakage Check**:
   - Extract `targetJob.companyName` (and common normalized aliases).
   - Perform case-insensitive token search across `tailoredResume.experiences[*].companyName` and `tailoredResume.experiences[*].roleTitle`.
   - If a match is found and that company name is **not** present in `masterCandidateProfile.experiences`, trigger immediate rejection `TARGET_COMPANY_LEAK`.
2. **Skill Grounding Check**:
   - Every skill listed in the tailored resume's skills section must either exist in the candidate's master skill bank or be extracted directly from a verifiable bullet point in their verified master experience.
3. **Chronology & Organization Check**:
   - Verifies that job start and end dates match master records exactly (zero date shifting).

---

## 5. ATS Compatibility vs. Job Match Scoring

To provide truthful, actionable feedback to candidates, Pilot Mama explicitly separates mechanical ATS compatibility from genuine job capability:

| Metric | Definition | Key Factors Evaluated |
| :--- | :--- | :--- |
| **ATS Compatibility Score (0-100%)** | Syntactic readability and parseability by legacy ATS scanners (e.g., Workday, Taleo, Greenhouse). | • Standard section header naming (`Work Experience`, `Education`, `Skills`).<br>• Absence of multi-column tables, text boxes, or embedded images.<br>• Exact keyword frequency overlap with job description.<br>• Clean date formatting (`Month YYYY`). |
| **Job Match Score (0-100%)** | Deep semantic qualification match evaluating candidate's real capacity to succeed in the role. | • Seniority tier alignment (e.g., junior vs. staff).<br>• Domain and architectural relevance.<br>• Core tech stack mastery vs. secondary tool gaps.<br>• Project complexity and measurable business impact. |

---

## 6. Document Generation & Export Standards

1. **Typographic Cleanliness**: Standard web-safe, universally installed fonts (`Inter`, `Helvetica`, `Calibri`, `Times New Roman`).
2. **Machine Readability**: Exported PDFs contain searchable text layers (zero rasterized text or flat image PDFs).
3. **Clean Layout**: Single-column vertical layout ensures 100% parse accuracy across all enterprise applicant tracking parsers.
4. **Standard File Formats**: Generates both `.pdf` and `.docx` representations with consistent styling and margin parameters.
