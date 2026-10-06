# Application Subsystem & Engine Specification

> **Document Status**: Production Baseline Specification  
> **Target Version**: Pilot Mama V1.0  
> **Location**: `docs/architecture/application-engine.md`  

---

## 1. Subsystem Scope & Mission

The Application Subsystem manages the full lifecycle of a candidate's job application, from intent generation and document linkage to status tracking and interview scheduling.

A core tenet of Pilot Mama is **Application Transparency**:
1. We **never** fabricate or falsely claim an application was submitted externally when it was not.
2. We prevent accidental duplicate applications by enforcing database-level uniqueness on `(candidate_id, job_id)`.
3. Every status transition is captured in an immutable event ledger (`application_events`), providing complete auditing.

---

## 2. Supported Application Modes

To support diverse corporate ATS portals while respecting legal terms of service, Pilot Mama defines three distinct application modes:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        PILOT MAMA APPLICATION MODES                    │
├─────────────────────┬──────────────────────────┬───────────────────────┤
│ 1. Direct Redirect  │ 2. Assisted Application  │ 3. Supported Direct   │
│    (Standard V1)    │    (V1 / Extension)      │    (Partner ATS API)  │
├─────────────────────┼──────────────────────────┼───────────────────────┤
│ Transfers candidate │ Pre-populates fields     │ Directly dispatches   │
│ to official career  │ via browser extension    │ candidate application │
│ portal URL with     │ or clipboard helper      │ payload via partner   │
│ tailored resume ready│ while candidate reviews │ authenticated API.    │
│ to upload.          │ and submits manually.    │                       │
└─────────────────────┴──────────────────────────┴───────────────────────┘
```

### Mode 1: Redirect Application (Standard Baseline)
- The candidate clicks **Apply** on Pilot Mama.
- The platform records an application entity in status `applied` (or `saved`), records the active `resume_version_id`, and opens the official external career URL in a new tab.
- Ensures zero ToS violations and works universally across 100% of employers.

### Mode 2: Assisted Application (Browser Helper)
- For high-friction ATS systems (Workday, Taleo), the candidate utilizes Pilot Mama's web companion or browser extension.
- The companion reads the candidate's structured profile and automatically fills matching form fields (name, phone, LinkedIn, previous employment, education).
- The candidate retains final human review and manually hits "Submit" on the employer's page.

### Mode 3: Supported Direct Automation (Authorized Partner ATS)
- Used exclusively where an employer has authorized direct API integration (e.g. Greenhouse Harvest API, Ashby direct partner application endpoints).
- The application is submitted server-to-server with explicit cryptographic receipts.

---

## 3. Application State Lifecycle & Transitions

```
[ Saved ] ──> [ Applied ] ──> [ Screening ] ──> [ Interviewing ] ──> [ Offered ]
    │              │                 │                  │                 │
    ▼              ▼                 ▼                  ▼                 ▼
[ Archived ]  [ Rejected ]      [ Rejected ]       [ Rejected ]      [ Accepted ]
```

### Supported Status Enums:
- `saved`: Candidate bookmarked the job for later action.
- `applied`: Candidate executed application action (redirect or direct submission).
- `screening`: Employer recruiter initiated resume review or initial questionnaire.
- `interviewing`: Candidate has active interview rounds scheduled.
- `offered`: Formal employment offer received.
- `rejected`: Application was declined by employer or candidate withdrew.
- `withdrawn`: Candidate voluntarily rescinded consideration.

---

## 4. Entity Schema & Event Immutability

### Application Record
Every record in `applications` strictly binds:
- `id`: Unique UUID.
- `candidate_id`: Authenticated candidate ID.
- `job_id`: Canonical Job ID.
- `resume_version_id`: The exact tailored resume version utilized for this application.
- `mode`: `redirect` | `assisted` | `automated`.
- `status`: Active state enum.
- `notes`: Candidate's private notes regarding hiring managers, referrals, or salary discussions.
- `applied_at`: Timestamp of application dispatch.

### Immutable Event Ledger (`application_events`)
Whenever an application status changes, the service writes an append-only event record:
```json
{
  "id": "evt_91c2b53e",
  "applicationId": "app_48f10a72",
  "eventType": "status_changed",
  "oldStatus": "screening",
  "newStatus": "interviewing",
  "notes": "Technical screening passed. System Design round scheduled for next Thursday.",
  "occurredAt": "2026-10-05T19:15:00.000Z"
}
```
This guarantees an immutable timeline for every job application, allowing candidates to visualize their complete job search velocity and conversion rates over time.
