# Environment Management & Configuration Strategy

> **Document Status**: Production Standard  
> **Applies to**: Engineering, DevOps, and Platform Operations  
> **Location**: `docs/operations/environment-strategy.md`  

---

## 1. Environment Tiers

To safeguard user data and ensure rigorous quality gates before production deployments, Pilot Mama operates three isolated environment tiers:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        PILOT MAMA ENVIRONMENT TIERS                    │
├─────────────────────┬──────────────────────────┬───────────────────────┤
│ 1. Local Development│ 2. Preview / Staging     │ 3. Production         │
├─────────────────────┼──────────────────────────┼───────────────────────┤
│ • Developer laptop  │ • Automated PR previews  │ • Live candidate base │
│ • Local Node / Vite │ • Ephemeral Render/Vercel│ • Render Web Service  │
│ • Local Docker PG   │ • Staging PostgreSQL     │ • Managed PostgreSQL  │
│ • Mock/Sandbox AI   │ • Sandbox AI keys        │ • Production AI Gateway│
└─────────────────────┴──────────────────────────┴───────────────────────┘
```

---

## 2. Environment Variables & Secret Taxonomy

### 2.1. Backend Environment Variables (`backend/.env`)

| Variable Name | Required | Allowed Environments | Description / Example |
| :--- | :---: | :--- | :--- |
| `NODE_ENV` | Yes | All | `development` \| `test` \| `production` |
| `PORT` | Yes | All | API port (default: `5000`) |
| `DATABASE_URL` | Yes | All | PostgreSQL connection string (`postgresql://user:pass@host:5432/dbname`) |
| `JWT_SECRET` | Yes | All | Cryptographic secret for signing JWT tokens (min 32 chars) |
| `JWT_EXPIRES_IN` | Yes | All | Access token expiry (e.g. `15m`) |
| `REFRESH_TOKEN_SECRET`| Yes | All | Cryptographic secret for refresh tokens |
| `REFRESH_TOKEN_EXPIRES`| Yes | All | Refresh token expiry (e.g. `7d`) |
| `CORS_ORIGIN` | Yes | All | Permitted frontend origins (e.g. `https://app.pilotmama.com`) |
| `GEMINI_API_KEY` | Yes | All | Google Gemini Generative AI API Secret |
| `OPENAI_API_KEY` | Optional | Staging / Prod | Fallback OpenAI API Secret |
| `STORAGE_ENDPOINT` | Optional | Staging / Prod | S3/R2 Endpoint for private document storage |
| `STORAGE_BUCKET` | Optional | Staging / Prod | Name of private object storage bucket |
| `STORAGE_ACCESS_KEY` | Optional | Staging / Prod | S3 API Access Key ID |
| `STORAGE_SECRET_KEY` | Optional | Staging / Prod | S3 API Secret Key |

### 2.2. Frontend Environment Variables (`frontend/.env`)

| Variable Name | Required | Allowed Environments | Description / Example |
| :--- | :---: | :--- | :--- |
| `VITE_API_URL` | Yes | All | Base API URL (e.g. `http://localhost:5000/api/v1` or `https://api.pilotmama.com/api/v1`) |
| `VITE_APP_ENV` | Yes | All | Active environment flag (`development`, `staging`, `production`) |

---

## 3. Secret Protection & Validation Rules

1. **No Production Secrets in Git**: `.env`, `.env.local`, and private key files are strictly forbidden from version control (`.gitignore` enforced).
2. **Startup Environment Validation**: At application boot, the backend runs a Zod validation schema over `process.env`. If any mandatory variable (`DATABASE_URL`, `JWT_SECRET`, `GEMINI_API_KEY`) is missing or malformed, the process immediately exits with an explicit error message:
   ```typescript
   const envSchema = z.object({
     NODE_ENV: z.enum(['development', 'test', 'production']),
     DATABASE_URL: z.string().url(),
     JWT_SECRET: z.string().min(32),
     GEMINI_API_KEY: z.string().min(1),
   });
   ```
3. **Safe Example Templates**: Production and development variable names (with empty or placeholder values) are maintained in `.env.example`.
