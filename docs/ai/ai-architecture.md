# AI Subsystem Architecture Specification

> **Document Status**: Production Baseline Specification  
> **Target Version**: Pilot Mama V1.0  
> **Location**: `docs/ai/ai-architecture.md`  

---

## 1. AI Gateway Architecture Overview

Pilot Mama treats Large Language Models (LLMs) as external, non-deterministic compute providers that must be governed through strict architectural boundaries. The **AI Gateway** sits between core application services and upstream model providers to ensure **reliability, structured type-safety, cost containment, and vendor neutrality**.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        APPLICATION DOMAIN SERVICES                     │
│  (Resume Parser, Job Analyzer, Match Engine, Tailoring, Interview)     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ AIRequestPayload (Zod Typed)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                           AI GATEWAY ENGINE                            │
├────────────────────────────────────────────────────────────────────────┤
│ • Prompt Registry & Versioning (`prompts/v1/...`)                      │
│ • Deterministic Request Cache (SHA-256 payload key)                    │
│ • Token Budgeting & Cost Accounting Ledger                             │
│ • Exponential Backoff & Circuit Breaker Logic                          │
│ • Output Sanitizer & Zod JSON Schema Enforcement                       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                     ┌──────────────┴──────────────┐
                     ▼                             ▼
       ┌───────────────────────────┐ ┌───────────────────────────┐
       │   Gemini Adapter (Primary)│ │  OpenAI Adapter (Fallback)│
       │   • Gemini 2.5 Flash      │ │  • GPT-4o-mini / GPT-4o   │
       │   • Low latency, rich ctx │ │  • High-reliability failover
       └───────────────────────────┘ └───────────────────────────┘
```

---

## 2. Gateway Core Responsibilities

### 2.1. Provider Abstraction Interface
All AI operations are invoked through a unified contract:
```typescript
export interface AIProviderResponse<T> {
  data: T;
  rawText: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    estimatedCostUsd: number;
  };
  provider: 'gemini' | 'openai';
  model: string;
  latencyMs: number;
  cached: boolean;
}

export interface IAIProvider {
  generateStructured<T>(
    promptName: string,
    promptVersion: string,
    variables: Record<string, any>,
    schema: z.ZodType<T>,
    options?: { maxTokens?: number; temperature?: number; priority?: 'high' | 'batch' }
  ): Promise<AIProviderResponse<T>>;
}
```

### 2.2. Structured Output & Schema Enforcement
- **No Free-Form Text**: All core business operations (parsing, tailoring, match evaluation) require JSON schemas.
- **Strict Validation via Zod**: If a model outputs malformed JSON or hallucinates required schema fields, the Gateway automatically retries up to 2 times with explicit schema correction instructions before raising an error.
- **Deterministic Response Formatting**: Prompt instructions enforce raw JSON blocks without conversational commentary or markdown wrapping that can break deserialization.

### 2.3. Request Caching & Cost Containment
- **Deterministic Keying**: Prompts that accept static inputs (e.g., job description parsing or base resume extraction) generate a cryptographic cache key:
  `Key = SHA256(PromptName + PromptVersion + JSON.stringify(NormalizedInputVariables))`
- **Cache Hit Savings**: Repeated analysis of the same job posting or resume bypasses external LLM API calls entirely, achieving up to 60% savings on production AI compute costs.

### 2.4. Provider Fallback & Resilience
- **Timeout Management**: All model requests enforce strict timeouts (15s for synchronous match analysis, 45s for deep multi-page resume tailoring).
- **Graceful Failover**: If Gemini returns `RESOURCE_EXHAUSTED` (HTTP 429), `SERVICE_UNAVAILABLE` (HTTP 503), or times out, the Gateway switches transparently to OpenAI without failing the user's action.

---

## 3. Core AI Modules & Operations

### 3.1. Resume Extraction (`resume_parse`)
- **Input**: Clean raw text extracted from uploaded candidate document (PDF/DOCX).
- **Task**: Extract contact details, professional summary, structured work history (company, title, dates, bullet points), education history, certifications, projects, and categorized skills.
- **Output Schema**: `CandidateProfileDataSchema`.

### 3.2. Job Description Parsing (`job_parse`)
- **Input**: Raw text or scraped HTML body of external job vacancies.
- **Task**: Extract job title, department, employment type, location mode, experience level, salary boundaries, core responsibilities, and categorize required vs. optional skills.
- **Output Schema**: `JobDescriptionDataSchema`.

### 3.3. Deterministic & Semantic Matching (`matching_eval`)
- **Input**: Structured Candidate Profile + Structured Job Description.
- **Task**: Synthesize keyword alignment, domain seniority comparison, and compute:
  - **ATS Keyword Compatibility (0-100%)**: Exact and synonymous matches across required skills.
  - **Job Match Score (0-100%)**: Semantic fit, project relevance, and technical breadth.
  - **Identified Deficiencies**: Critical missing skills vs. adjacent bridge skills.
- **Output Schema**: `MatchAnalysisResultSchema`.

### 3.4. Resume Tailoring Engine (`resume_tailor`)
- **Input**: Master Candidate Profile + Target Job Description + Strategy Archetype (`full`, `focused`, `targeted`).
- **Task**: Contextually reframe candidate bullet points to highlight skills demanded by the target job.
- **Output Schema**: `TailoredResumeContentSchema`.
- **Governing Rule**: Must pass the **Zero-Fabrication Guard** and **Target Company Leakage Check** before acceptance.

### 3.5. Interview Preparation Simulator (`interview_prep`)
- **Input**: Candidate Experience + Target Job Requirements + Company Domain.
- **Task**: Synthesize targeted behavioral questions (with STAR framing guidance), technical deep dives on candidate's stack, and company-specific architectural challenges.
- **Output Schema**: `InterviewPrepPackageSchema`.

---

## 4. Prompt Engineering & Governance Standards

1. **Version Controlled Assets**: All prompts are stored as immutable text templates in source control under `backend/src/ai/prompts/<module>/<version>.txt` (e.g. `prompts/tailor/v1.2.txt`).
2. **Explicit Negative Constraints**: Every prompt incorporates non-negotiable negative constraints (e.g., *"NEVER hallucinate employment tenures"*, *"NEVER use the target employer's name in candidate history"*).
3. **Auditability**: Every AI invocation logs prompt version, token usage, latency, and status in the `ai_requests` database table for operational governance.
