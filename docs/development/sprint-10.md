# Sprint 10: Production Hardening & Launch Architecture (Pilot Mama V1)

## Executive Summary
Sprint 10 represents the final production-hardening pass across all modules of Pilot Mama V1 (Sprints 1 through 9).
It establishes robust operational health checks, security policies, strict typed environment validation, CI pipelines, and a structured deployment checklist.

---

## 1. System Audits & Security Hardening

### 1.1 Authentication & Token Rotation
- Argon2id password hashing with modern salt bounds.
- Dual-token architecture: Short-lived access token (15m) + secure HttpOnly refresh token (7d) with automatic rotation and token reuse detection.
- Cross-site request protection with explicit CORS allowlist matching client origins.

### 1.2 Data Authority & Zero Client Trust
- All commercial pricing, subscription status, credit balances, and employer permissions remain 100% database-authoritative.
- Atomic balance consumption via conditional SQL updates (`WHERE balance >= :cost`) preventing concurrency overdraws.
- Razorpay payments verified strictly server-side using constant-time HMAC-SHA256 comparison (`crypto.timingSafeEqual`).
- Webhook idempotency maintained through tracked `providerEventId` records in `webhook_events`.

### 1.3 Tenant Isolation & Candidate Privacy
- Employer portal enforces strict multi-tenant boundary checks: Organization A can never inspect or alter Organization B's jobs or applicant reviews.
- Candidates' private accounts remain protected; recruiters only access explicit `ResumeVersion` attachments submitted to their jobs.

### 1.4 AI Safety & Grounded Truth
- AI tools enforce Zod structured schemas.
- Untrusted text from job postings or resumes is sanitized and bounded.
- The AI Career Agent requires explicit user approvals (`WAITING_FOR_APPROVAL` -> `APPROVED`) before executing write actions or consuming credits.
- Hallucination prevention rule: Zero fake credentials or unverifiable accomplishments.

---

## 2. Observability & Health Monitoring
- Liveness check at `GET /api/v1/health` reporting uptime, PostgreSQL latency, and environment state.
- Readiness check at `GET /api/v1/ready` reporting service readiness and DB reachability for container orchestrators (Kubernetes / ECS).

---

## 3. Deployment & CI Configuration
- Automated GitHub Actions workflow (`.github/workflows/ci.yml`) validating:
  1. Prisma validation & schema generation
  2. Full backend regression test execution (135 tests)
  3. Backend production compilation (`tsc`)
  4. Frontend typecheck & production bundle generation (`vite build`)
