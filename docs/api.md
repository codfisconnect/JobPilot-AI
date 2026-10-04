# JobPilot AI REST API Documentation

Base URL: `http://localhost:5000/api`

---

## 1. Candidate Endpoints

### `GET /candidates`
Returns all candidate profiles (including pre-seeded demo candidates).

### `GET /candidates/:id`
Returns a single candidate profile by ID.

### `PUT /candidates/:id`
Updates candidate master profile fields (contact info, verified skills, work history).

### `POST /candidates/upload`
Uploads and parses a master resume file (`multipart/form-data`, key `resume`, supports `.pdf`, `.docx`, `.txt`).
- **Response**: `{ success: true, data: CandidateProfile, extractedRawText: string }`

---

## 2. Jobs Endpoints

### `GET /jobs`
Returns all cataloged job descriptions.

### `GET /jobs/:id`
Returns a specific job by ID.

### `POST /jobs/parse`
Parses raw job description text into structured JSON.
- **Body**: `{ rawText: string, sourceType?: string, sourceUrl?: string }`

### `POST /jobs/extract-url`
Attempts to fetch public job page content. Provides graceful fallback prompt if page is blocked by authentication or anti-bot measures.
- **Body**: `{ url: string }`

---

## 3. Matching & Evaluation

### `POST /match/analyze`
Executes full 14-point evaluation comparing candidate profile against job requirements.
- **Body**: `{ candidateId: string, jobId: string }`
- **Returns**: Match scores, recommendation, whyMatch breakdown, career-track detection, truth check results, ATS simulation, and suggested application answers.

### `GET /match/:candidateId/:jobId`
Retrieves existing match analysis.

---

## 4. Tailored Resumes

### `POST /resumes/tailor`
Generates a tailored resume version preserving truth integrity and documenting all text modifications.
- **Body**: `{ candidateId: string, jobId: string }`

### `GET /resumes`
Retrieves all generated tailored resumes.

### `GET /resumes/:id`
Retrieves a specific tailored resume document.

---

## 5. Applications Pipeline

### `GET /applications?candidateId=:id`
Retrieves tracked job applications for candidate.

### `GET /applications/:id`
Retrieves full application details including linked job, exact resume version snapshot, and answers.

### `POST /applications`
Creates or updates an application record.
- **Body**: ApplicationRecord payload.

---

## 6. Interview Preparation

### `POST /interview/generate`
Synthesizes comprehensive interview preparation pack based on exact JD, submitted resume, and candidate background.
- **Body**: `{ candidateId: string, jobId: string, resumeVersionId?: string }`

### `GET /interview/:candidateId/:jobId`
Retrieves generated interview preparation guide.
