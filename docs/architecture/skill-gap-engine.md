# Pilot Mama — Skill Gap Engine Architecture (Sprint 4)

## Overview
The Skill Gap Engine compares target job requirements against candidate verified history and categorizes every competency deterministically.

## Classification Taxonomy
- **VERIFIED (GREEN)**: Explicitly substantiated in candidate master profile skills or work experience responsibilities.
- **PARTIAL / TRANSFERABLE (YELLOW)**: Not directly cited, but candidate possesses adjacent ecosystem knowledge (e.g., JUnit → TestNG; Selenium → Playwright; MySQL → PostgreSQL).
- **MISSING (RED)**: No historical record in candidate evidence. Strictly prohibited from being fabricated on tailored resumes.

## Priority Calculation
Missing and partial skills are ranked by:
1. **Critical**: Must-have requirement for the target role with no adjacent candidate competencies.
2. **High**: Requirement present in multiple target roles or core to the technical domain.
3. **Medium**: Preferred qualification or partial/transferable technology.
4. **Low**: Non-blocking requirement or already verified.

## Learning Recommendations Integration
Each identified gap links to verified learning assets in `learning_resources` (official documentation, reputable online courses, video tutorials). No URLs or institutions are fabricated.
