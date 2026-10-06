# Sprint 04 — Job Matching, Skill Gap & AI Resume Intelligence

## Objective
Implement the production intelligence layer on top of verified candidate profiles, master resumes, and canonical job descriptions without violating the Absolute Truth Rule.

## Scope Delivered
1. **Database Schema & Prisma Migration**:
   - Added `JobMatch` model with `overallScore`, `category`, `breakdown`, `truthCheck`, `careerTrack`, `atsAnalysis`, and `inputHash`.
   - Applied migration `20261006112232_sprint4_job_match`.
2. **Deterministic Matching Engine**:
   - Multi-factor scoring (Skill 40%, Experience 25%, Role 20%, Location 10%, Seniority 5%).
   - Career track detection with transparent cross-track gap explanations.
   - Categorization: `STRONG_MATCH`, `GOOD_MATCH`, `PARTIAL_MATCH`, `LOW_MATCH`.
3. **Skill Gap Engine & Prioritization**:
   - Classification into `VERIFIED`, `PARTIAL`, `MISSING`.
   - Integration with verified `learning_resources`.
4. **AI Resume Tailoring Pipeline**:
   - Absolute Truth enforcement (zero fabrication of dates, companies, or tools).
   - Target Company Leakage Guard preventing target employer names from contaminating generated summaries.
   - Modes: `FULL`, `FOCUSED`, `TARGETED`.
   - Immutable persistence in `ResumeVersion`.
5. **Production REST Endpoints**:
   - `GET /api/v1/jobs/:id/match`
   - `POST /api/v1/jobs/:id/match/recalculate`
   - `GET /api/v1/jobs/:id/skill-gap`
   - `POST /api/v1/jobs/:id/tailor-resume`
   - `GET /api/v1/jobs/:id/tailored-resumes`
6. **Frontend Integration**:
   - Updated `JobsPage` and `JobDetailModal` with direct "Analyze Fit" action.
   - Upgraded `JobAnalysisPage` to call production `/api/v1` matching and tailoring endpoints with responsive UI.
