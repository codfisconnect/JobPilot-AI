# Sprint 9: Advanced AI Career Agent Architecture Blueprint (Pilot Mama V1)

## Executive Summary
Sprint 9 implements the **Controlled Orchestration AI Career Agent** for Pilot Mama V1.
The agent acts as a hyper-personalized, truthful career copilot that orchestrates career recommendations, tailored application strategies, and interview readiness without ever taking destructive unapproved actions or inventing candidate credentials.

---

## 1. Controlled Orchestration Architecture

```
User Query / Task
       ↓
Agent Session & Intent Classification
       ↓
Context Gathering (Profile, Skills, Resumes, Jobs, Applications)
       ↓
Prompt Injection Sanitization & System Policy Boundary
       ↓
Tool Calling & Structured Output Validation (Zod Registry)
       ↓
Action Classifier:
  - READ Action   -> Auto-execute & return grounded evidence
  - WRITE Action  -> Generate Pending Approval with deterministic preview
       ↓
Credit Check & Atomic Consumption (Sprint 7 Billing Integration)
       ↓
Auditable Action Execution on User Approval
```

### 1.1 Core Safety & Truth Invariants
1. **Never Invent Data**: The agent strictly operates upon existing candidate qualifications and explicit job requirements. It cannot hallucinate skills, titles, or experience.
2. **Untrusted External Data**: Resumes, job descriptions, and external text are treated as untrusted data wrapped in strict delimiter boundaries to prevent prompt injection.
3. **Approval Gate for Writes**: Updating resumes, creating applications, or executing credit-consuming tasks require explicit user approval (`WAITING_FOR_APPROVAL` -> `APPROVED`).
4. **Authoritative Credit Integration**: Every billable agent action queries the Sprint 7 `CreditService` and executes atomic consumption before execution.

---

## 2. Agent Data Model (Prisma)

```prisma
enum AgentSessionStatus {
  ACTIVE
  PAUSED
  COMPLETED
  ARCHIVED
}

enum AgentActionStatus {
  PROPOSED
  WAITING_FOR_APPROVAL
  APPROVED
  REJECTED
  EXECUTED
  FAILED
}

enum AgentActionType {
  RECOMMENDATION
  TAILOR_RESUME
  PREPARE_INTERVIEW
  CREATE_APPLICATION_DRAFT
  UPDATE_LEARNING_PLAN
}

model AgentSession {
  id                 String             @id @default(uuid())
  candidateProfileId String             @map("candidate_profile_id")
  title              String             @default("Career Copilot Session")
  status             AgentSessionStatus @default(ACTIVE)
  summaryContext     Json?              @map("summary_context")
  createdAt          DateTime           @default(now()) @map("created_at")
  updatedAt          DateTime           @updatedAt @map("updated_at")

  candidateProfile   CandidateProfile   @relation(fields: [candidateProfileId], references: [id], onDelete: Cascade)
  messages           AgentMessage[]
  actions            AgentAction[]

  @@index([candidateProfileId])
  @@map("agent_sessions")
}

model AgentMessage {
  id        String       @id @default(uuid())
  sessionId String       @map("session_id")
  role      String       // USER, ASSISTANT, SYSTEM
  content   String
  metadata  Json?
  createdAt DateTime     @default(now()) @map("created_at")

  session   AgentSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  @@index([sessionId])
  @@map("agent_messages")
}

model AgentAction {
  id          String            @id @default(uuid())
  sessionId   String            @map("session_id")
  actionType  AgentActionType   @map("action_type")
  description String
  payload     Json              // Proposed execution payload
  status      AgentActionStatus @default(PROPOSED)
  creditCost  Int               @default(0) @map("credit_cost")
  executedAt  DateTime?         @map("executed_at")
  createdAt   DateTime          @default(now()) @map("created_at")
  updatedAt   DateTime          @updatedAt @map("updated_at")

  session     AgentSession      @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  @@index([sessionId])
  @@index([status])
  @@map("agent_actions")
}
```

---

## 3. Tool Registry
- `getCandidateContext`: Pulls profile, skills, preferences, and resumes.
- `searchPrioritizedJobs`: Searches active jobs ranked by match score.
- `proposeResumeTailoring`: Creates pending approval for tailoring a resume to a specific job (costs 5 credits).
- `proposeInterviewSession`: Generates structured interview questions for a target job (costs 3 credits).
- `generateNextBestActions`: Evaluates application pipeline and suggests concrete next steps.

---

## 4. API Endpoints (`/api/v1/agent`)
- `POST /api/v1/agent/sessions`: Initialize or resume an agent session.
- `GET /api/v1/agent/sessions`: List candidate's agent sessions.
- `GET /api/v1/agent/sessions/:id`: Get session details with conversation history and actions.
- `POST /api/v1/agent/sessions/:id/messages`: Send user message and receive structured copilot response with recommendations/proposed actions.
- `POST /api/v1/agent/actions/:id/approve`: Approve and execute a pending action with atomic credit consumption.
- `POST /api/v1/agent/actions/:id/reject`: Reject a proposed action.
