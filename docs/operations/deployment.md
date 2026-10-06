# Production Deployment & Hosting Specification

> **Document Status**: Production Standard  
> **Applies to**: Platform Infrastructure & Continuous Delivery  
> **Location**: `docs/operations/deployment.md`  

---

## 1. Hosting Architecture Overview

Pilot Mama employs a modern, managed cloud topology designed to minimize operational overhead while providing high availability, global low-latency CDN delivery, and enterprise relational database durability.

```
                   [ Users Worldwide ]
                            │
               ┌────────────┴────────────┐
               │                         │
               ▼                         ▼
    [ Vercel Edge CDN ]         [ Render API Web Service ]
    • Global Static Hosting     • Node.js 22 LTS / Express
    • Automated Branch Deploys  • Automatic TLS / Health Checks
    • Client Single Page App    • Auto-Restart & Rollbacks
               │                         │
               │                         ▼
               │                [ Managed PostgreSQL ]
               │                • Automated Daily Backups
               │                • Connection Pooling
               │                         │
               └─────────────────────────┼─────────────────────────┐
                                         ▼                         ▼
                                [ Cloudflare R2 S3 ]      [ Gemini / LLM ]
                                • Encrypted Storage       • AI Gateway Hub
```

---

## 2. Infrastructure Provider Roles

| Component | Provider | Tier & Configuration | Rationale |
| :--- | :--- | :--- | :--- |
| **Frontend Web** | **Vercel** | Pro / Team | Zero-config Vite/React deployments, instant global edge routing, automatic preview URLs for every pull request. |
| **Backend API** | **Render** | Managed Web Service | Native Node.js runtime, zero-downtime rolling deploys, integrated health checks, private networking. |
| **Relational Database** | **Render PostgreSQL** (or Supabase/Neon) | Managed PostgreSQL 16+ | Managed automated backups, point-in-time recovery, connection pooler (PgBouncer), SSL-enforced queries. |
| **Object Storage** | **Cloudflare R2** / AWS S3 | S3-Compatible Object Store | Zero egress fees on Cloudflare R2, private bucket security, AES-256 server-side encryption. |
| **DNS & Edge Security**| **Cloudflare** | DNS + Proxy | DDoS protection, TLS 1.3 termination, rate limiting at edge. |

---

## 3. Continuous Integration & Deployment (CI/CD) Workflow

### 3.1. Pull Request Previews
- When a developer opens a PR against `develop`, Vercel automatically compiles and deploys an ephemeral preview build of the frontend.
- QA and Product Leads validate UI changes and test responsive layouts against preview deployments.

### 3.2. Staging Deployment (`develop` branch)
- Merging a PR into `develop` automatically triggers:
  1. Automated test suite execution on GitHub Actions.
  2. Deployment to the staging Render backend service.
  3. Staging database migration execution (`npm run db:migrate`).
  4. Deployment to the staging frontend domain (`staging.pilotmama.com`).

### 3.3. Production Deployment (`main` branch)
- Formal release pull request merged into `main`.
- Triggers production pipeline:
  1. Strict automated test checks.
  2. Production PostgreSQL migration applied during low-traffic window.
  3. Zero-downtime rolling update deployed to Render production service (`api.pilotmama.com`).
  4. Vercel deploys immutable production build to `app.pilotmama.com`.

---

## 4. Health Checks & Monitoring

- **API Health Endpoint**: `GET /api/v1/health`
  - Verifies Node process uptime.
  - Verifies active database connection pool responsiveness (`SELECT 1;`).
  - Returns `200 OK` with JSON telemetry:
    ```json
    {
      "status": "healthy",
      "uptime": 84210,
      "database": "connected",
      "timestamp": "2026-10-05T19:20:00.000Z"
    }
    ```
- Render's health checker polls `/api/v1/health` every 15 seconds. If the container fails two consecutive health checks, traffic is routed to the previous healthy container while the failing instance restarts.
