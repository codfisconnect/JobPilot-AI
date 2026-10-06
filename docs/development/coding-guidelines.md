# Coding Guidelines and Engineering Standards

> **Document Status**: Production Standard  
> **Applies to**: Frontend, Backend, AI Services  
> **Repository**: `codfisconnect/JobPilot-AI`  
> **Location**: `docs/development/coding-guidelines.md`  

---

## 1. Universal TypeScript Standards

1. **Strict Type Safety**: `strict: true` must be enabled across all `tsconfig.json` configurations.
2. **No Implicit or Explicit `any`**: The use of `any` is strictly prohibited in production code. If an unknown payload is received from external APIs or user input, type it as `unknown` and parse it using a **Zod** schema.
3. **Explicit Function Signatures**: All exported functions, service methods, and API handlers must declare explicit parameter types and return types:
   ```typescript
   // ❌ Bad
   export async function findCandidate(id) { ... }

   // ✅ Good
   export async function findCandidate(id: string): Promise<CandidateProfile | null> { ... }
   ```
4. **Colocated Interfaces**: Type definitions shared across modules belong in dedicated `types/` directories. Component-specific prop interfaces must be colocated with the component file.

---

## 2. Backend Engineering Standards (Node.js & Express)

### 2.1. Layered Architecture Separation
Backend code strictly follows the **Controller - Service - Repository** pattern:
- **Routes (`routes/`)**: Mount URL endpoints and attach middleware (auth, rate limits).
- **Controllers (`controllers/`)**: Handle HTTP serialization, parse parameters, invoke services, and return standard JSON response envelopes. Zero database queries or AI calls belong in controllers.
- **Services (`services/`)**: Enforce business logic, orchestrate multiple repositories, trigger AI evaluations, and handle complex domain validations.
- **Repositories (`repositories/` or `database/`)**: Execute SQL queries, manage database transactions, and map relational rows to domain models.

### 2.2. Request Validation
Every request body, query string, or URL parameter must be validated using Zod:
```typescript
import { z } from 'zod';

export const CreateJobSchema = z.object({
  title: z.string().min(3).max(255),
  companyName: z.string().min(2),
  location: z.string(),
  workMode: z.enum(['remote', 'hybrid', 'onsite']),
  salaryMin: z.number().int().positive().optional(),
  salaryMax: z.number().int().positive().optional(),
});
```

### 2.3. Error Handling & Logging
- **Standard HTTP Exceptions**: Throw typed domain exceptions (`NotFoundError`, `UnauthorizedError`, `ValidationError`) that are caught by the centralized Express error middleware.
- **Structured JSON Logging**: All application logs must be structured (timestamp, level, traceId, message, context). Never use raw `console.log()` for production error reporting.
- **Trace IDs**: Every incoming HTTP request is assigned a unique `x-request-id` header to trace logs across services and AI Gateway calls.

---

## 3. Frontend Engineering Standards (React + TypeScript)

### 3.1. Component Architecture
- **Single Responsibility Principle**: Components must remain focused and concise (< 250 lines of code). Break complex views into modular sub-components.
- **Custom Hooks for State Logic**: Separate business logic and data fetching into custom hooks (e.g. `useJobs()`, `useResumeTailor()`), keeping UI components purely presentational.

### 3.2. Styling & Design System Compliance
- **Zero Inline Styles**: Styling must use CSS variables defined in `global.css` (`var(--bg-primary)`, `var(--text-primary)`, `var(--brand-gradient)`).
- **No Hardcoded Hex Colors**: Direct hex values (e.g. `#111827`) inside component CSS are strictly forbidden to ensure clean Dark and Light mode theme adaptability.
- **Component Colocated CSS**: Component-specific styling belongs in `<ComponentName>.css` alongside `<ComponentName>.tsx`.

### 3.3. Accessibility (a11y) & SEO Standards
- All interactive elements must have unique, descriptive `id` or `data-testid` attributes.
- Images must have meaningful `alt` text.
- Headings must follow strict semantic hierarchy (`h1` ➔ `h2` ➔ `h3`).
- Interactive buttons and inputs must satisfy the minimum touch target requirement of **44px × 44px**.

---

## 4. Secrets & Configuration Management

1. **Zero Hardcoded Secrets**: Secrets (DB passwords, JWT signing keys, Gemini API keys) must be loaded through environment variables validated at startup.
2. **Environment Variable Validation**: Backend must utilize a startup validator (e.g. Zod schema for `process.env`) ensuring missing variables halt boot with a descriptive error.
3. **Frontend Leakage Prevention**: Never prefix sensitive backend API secrets with `VITE_`. Only public configuration (e.g. `VITE_API_URL`) may be surfaced to the browser bundle.
