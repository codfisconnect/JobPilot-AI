# Pilot Mama — AI Resume Tailoring Pipeline (Sprint 4)

## Guiding Principles: Absolute Truth Rule
1. **Zero Fabrication**: The AI engine never invents employers, roles, employment dates, projects, technologies, achievements, or degrees.
2. **Permitted AI Enhancements**:
   - Reordering bullet points to surface the most relevant verified accomplishments first.
   - Refined professional summary tailored to target role keywords without mentioning target company names.
   - Emphasizing verified tools while keeping unverified RED skills completely absent from experience claims.
   - Compressing irrelevant historical details for brevity.
3. **Target Company Leakage Guard**:
   - The target company name and domain are checked against candidate past employers.
   - If the target company name appears in generated summaries, skills, or responsibilities without historical employment justification, the output is immediately **REJECTED**.

## Tailoring Modes
- **FULL**: Preserves complete end-to-end work history.
- **FOCUSED**: Highlights the most relevant roles and projects while condensing older roles.
- **TARGETED**: Highly optimized bullet arrangement matching job requirements while remaining strictly truthful.

## Immutable Resume Versioning
Tailored outputs create an immutable `ResumeVersion` entity referencing:
- `resumeId` (Master Resume root)
- `jobId` (Target Canonical Job)
- `versionName` (Deterministic convention: `[Company]_[Role]_v[Num]`)
- `strategy` (`FULL` | `FOCUSED` | `TARGETED`)
- `atsScore` (Estimated compatibility rating)
- `structuredContent` (Immutable snapshot of the generated resume)
