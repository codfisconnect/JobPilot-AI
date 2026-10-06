# Development Branching Strategy & Release Workflow

> **Document Status**: Production Standard  
> **Applies to**: Engineering Team, Interns, and Contributors  
> **Repository**: `codfisconnect/JobPilot-AI`  
> **Location**: `docs/development/branching-strategy.md`  

---

## 1. Core Branch Topology

To maintain extreme platform stability while fostering parallel development across multiple developers and interns, Pilot Mama strictly enforces a modified **Git Flow** strategy.

```
 [main] ──────────────────────────● Release v1.0 ──────────● Release v1.1
   │                               ▲                         ▲
   │                               │                         │
 [develop] ──────●────────●────────┴─────────●───────────────┴────────
   │             ▲        ▲                  ▲
   │             │        │                  │
   ├── [feature/auth-pg]  │                  │
   │             │        │                  │
   └── [feature/theme-engine]                │
                          │                  │
                          └── [feature/job-sync-hub]
```

### Permanent Branches:
1. **`main` (Production Branch)**:
   - Contains exclusively battle-tested, verified production code.
   - Protected: Direct pushes and force pushes are strictly disabled.
   - Merges into `main` occur only from `develop` via formal Release Pull Requests reviewed and signed off by the Founder / Technical Product Owner.
2. **`develop` (Integration Branch)**:
   - Serves as the central staging branch for ongoing sprint features.
   - All completed features undergo integration testing and QA sign-off here before production deployment.

### Ephemeral Branches:
3. **`feature/<module-name>`**:
   - Branched from: `develop`
   - Merged back into: `develop`
   - Naming convention: `feature/<short-description>` (e.g., `feature/postgres-user-auth`, `feature/ats-score-guard`).
4. **`bugfix/<issue-name>`**:
   - Branched from: `develop`
   - Merged back into: `develop`
   - Used for non-emergency defect resolutions during sprint QA cycles.
5. **`hotfix/<incident-id>`**:
   - Branched from: `main`
   - Merged back into: `main` AND `develop`
   - Reserved strictly for high-severity production outages or security vulnerabilities.

---

## 2. Pull Request (PR) & Code Review Protocol

### 2.1. Non-Negotiable Intern Rule: Zero Direct Pushes
**Interns and junior developers are strictly prohibited from pushing code directly to `main` or `develop`.** All changes must originate on an isolated feature branch and undergo formal PR review.

### 2.2. Pull Request Lifecycle
1. **Branch Creation**: Developer branches off the latest `develop` (`git checkout -b feature/auth-foundation develop`).
2. **Atomic Commits**: Commits follow conventional commit syntax (`feat: add argon2 password hashing`, `fix: handle null salary edge case`).
3. **Self-Review & Automated Checks**: Before opening PR:
   - TypeScript compilation passes (`npm run build`).
   - Linting passes with zero errors.
   - Unit tests pass.
4. **Pull Request Submission**: Developer opens PR targeting `develop`, completing the standard PR template:
   - Summary of changes and architectural rationale.
   - Modules affected.
   - Manual QA test steps and evidence (screenshots, API logs).
5. **Peer & Lead Review**: Requires at least one technical review and sign-off from the Tech Lead.
6. **QA Acceptance**: Product/QA Lead verifies acceptance criteria on preview deployment.
7. **Squash & Merge**: Tech Lead executes squash and merge into `develop`.

---

## 3. Release Checklist & Cadence

Before any release branch is merged from `develop` to `main`:
1. Full test suite passes on CI (Unit, API, Integration).
2. Database migration rollback tested on staging PostgreSQL instance.
3. Smoke test executed against core candidate journeys (Registration ➔ Resume Upload ➔ Job Match ➔ Tailor ➔ Kanban Update).
4. Release version tag created (e.g. `git tag -a v1.0.0 -m "Pilot Mama Production Release 1.0.0"`).
