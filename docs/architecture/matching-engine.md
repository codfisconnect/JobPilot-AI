# Pilot Mama — Matching Engine Architecture (Sprint 4)

## Overview
The Pilot Mama Matching Engine is a transparent, explainable scoring and evidence-mapping subsystem that evaluates verified candidate history against canonical job requirements.

## Architecture
```
Candidate Profile + Master Resume + Canonical Job Opening
                    ↓
        Deterministic Career Track Detection
                    ↓
        Deterministic Truth & Skill Evidence Mapping
                    ↓
        Weighted Multi-Factor Scoring (0-100)
                    ↓
        PostgreSQL Caching (`job_matches` table)
```

## Scoring Formula
The core match score is deterministic:
1. **Technical Skills (40%)**:
   - `VERIFIED (GREEN)` = 100% weight
   - `PARTIAL / ADJACENT (YELLOW)` = 60% weight
   - `MISSING (RED)` = 0% weight
2. **Years of Experience Fit (25%)**: Evaluated against JD minimum required experience.
3. **Target Role & Career Track Fit (20%)**: Aligned career track vs cross-domain leap detection.
4. **Location / Remote Preference (10%)**: Work mode and geographical alignment.
5. **Seniority Fit (5%)**: Seniority balance between role level and experience.

## Recommendation Categories
- **Strong Match** (90–100): High alignment across required core competencies and career track.
- **Good Match** (75–89): Solid alignment with minor adjacent skill transitions.
- **Partial Match** (50–74): Moderate overlap with clear skill gaps requiring explanation.
- **Low Match** (<50): Substantial misalignment in tech stack or domain.

## Caching Strategy
Matches are hashed deterministically based on:
`SHA-256(candidate.updatedAt + skillCount + experienceCount + job.contentHash + engineVersion)`
Persisted in the `job_matches` PostgreSQL table. Identical inputs return instant cached responses; candidate updates or job modifications trigger automatic recalculation.
