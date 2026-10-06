# Pilot Mama V1 - Sprint 1 Implementation Guide

> **Sprint**: Sprint 01 - Production Foundation  
> **Status**: Completed  
> **Date**: October 2026  
> **Target Branch**: `develop`  
> **Repository**: `codfisconnect/JobPilot-AI`  

---

## 1. Overview & Objectives Achieved

Sprint 1 established the **production architectural foundation** for Pilot Mama V1 without breaking or modifying the working reference prototype.

Key milestones accomplished:
1. **Prisma ORM & PostgreSQL Schema**: Initialized Prisma 6.4.1 with PostgreSQL provider, created normalized V1 schema (`backend/prisma/schema.prisma`), and generated initial migration script (`backend/prisma/migrations/20261005_init/migration.sql`).
2. **Environment Validation**: Implemented strict Zod-based startup configuration validator (`backend/src/config/env.ts`) providing safe development fallbacks and fatal exits on missing production keys.
3. **Structured Request Logging**: Implemented `requestLogger.middleware.ts` generating unique `x-request-id` trace tokens, tracking latency, and redacting sensitive PII, passwords, and tokens.
4. **Global Error Handling**: Standardized API error envelopes (`error.middleware.ts`) supporting Zod validation issues, typed `AppError` exceptions, Prisma conflicts, and sanitized 500 responses.
5. **Production Authentication & RBAC**:
   - Implemented Argon2id password hashing (`utils/password.ts`).
   - Implemented JWT access tokens (15m expiry) and secure HttpOnly refresh token rotation (`utils/jwt.ts`).
   - Built layered Controller ➔ Service ➔ Repository architecture (`AuthController`, `AuthService`, `UserRepository`).
   - Endpoints: `POST /api/v1/auth/register`, `POST /api/v1/auth/login`, `POST /api/v1/auth/refresh`, `POST /api/v1/auth/logout`, `GET /api/v1/auth/me`.
   - RBAC middleware (`auth.middleware.ts`) enforcing role authorization (`CANDIDATE`, `EMPLOYER`, `INSTITUTE`, `ADMIN`).
6. **Health Telemetry**: Created `GET /api/v1/health` checking PostgreSQL connection status, database latency, and process uptime.
7. **Frontend Auth & API Client**: Centralized `apiClient` (`frontend/src/api/client.ts`), `AuthProvider` / `useAuth` hook (`frontend/src/context/AuthContext.tsx`), and responsive `AuthPage` (`frontend/src/pages/AuthPage.tsx`).
8. **App Shell & Theme Persistence**: Integrated user session display and sign-out controls into `Sidebar.tsx`, preserving Light/Dark theme persistence and 44px mobile touch ergonomics.
9. **Automated Test Suites**: Built Node test runner suites for authentication unit tests (`auth.test.ts`), API integration tests (`api.test.ts`), and full end-to-end authentication lifecycle integration tests (`lifecycle.test.ts`). All 26 new automated tests and all 63 existing prototype tests pass (89/89 total).
10. **PostgreSQL 18 Verification**:
   - PostgreSQL schema verified and migration status confirmed up-to-date on live local PostgreSQL 18 instance (`pilot_mama_dev`).
   - Registration, login, `/me` profile retrieval verified.
   - Refresh token rotation verified with newly issued access tokens and rotated cookies.
   - Replay defense verified: previously rotated tokens return 401 Unauthorized.
   - Logout token invalidation verified: refresh tokens purged from database and cookie cleared.
   - Post-logout refresh rejection verified (returns 401 Unauthorized).

---

## 2. Local Development & PostgreSQL Setup

### 2.1. PostgreSQL Connection
When running a local PostgreSQL instance (via Docker or native service):
```bash
# Example Docker command:
docker run --name pilotmama-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=pilotmama -p 5432:5432 -d postgres:16
```

Set the connection string in `backend/.env`:
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/pilotmama?schema=public
```

### 2.2. Prisma Commands
```bash
# Validate Prisma schema
npm run prisma -- validate (or npx prisma validate)

# Generate Prisma Client types
npx prisma generate

# Apply migrations to database
npx prisma migrate deploy
```

---

## 3. Development Startup & Testing Commands

### Backend:
```bash
cd backend
npm run dev      # Runs with tsx watch
npm test         # Runs 63 prototype critical tests
npx tsx --test src/tests/auth.test.ts  # Runs Sprint 1 Auth tests (12/12 pass)
npx tsx --test src/tests/api.test.ts   # Runs Sprint 1 API tests (6/6 pass)
npm run build    # Compiles TypeScript without errors
```

### Frontend:
```bash
cd frontend
npm run dev      # Runs Vite dev server
npm run build    # Validates TypeScript and compiles production bundle
```

---

## 4. Authentication Architecture & Token Flow

```
[ Client Login Request ]
         │
         ▼
[ POST /api/v1/auth/login ]
         │
         ├── 1. Validate Email & Password format with Zod
         ├── 2. Fetch User from PostgreSQL via UserRepository
         ├── 3. Verify Argon2id hash
         ├── 4. Sign JWT Access Token (15 min) + Refresh Token (7 days)
         ├── 5. Hash Refresh Token (SHA-256) & store in PostgreSQL
         ├── 6. Set HttpOnly, Secure, SameSite=Lax cookie: pm_refresh_token
         └── 7. Return JSON: { success: true, data: { user, accessToken } }
```

- Subsequent API calls include `Authorization: Bearer <accessToken>`.
- When access token expires, client issues `POST /api/v1/auth/refresh` sending the HttpOnly cookie. Server validates hash, revokes previous token, and issues rotated pair.
