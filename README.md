# JobPilot AI 🚀
> **Your AI agent for smarter job applications.**

[![Node.js](https://img.shields.io/badge/Node.js-24+-green.svg)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-18-blue.svg)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org)
[![SQLite](https://img.shields.io/badge/Database-SQLite-blue.svg)](https://sqlite.org)
[![Manifest V3](https://img.shields.io/badge/Chrome_Extension-MV3-orange.svg)](https://developer.chrome.com/docs/extensions/mv3/intro/)

JobPilot AI is a functional, end-to-end prototype designed to help candidates apply smarter and more authentically. It processes candidate master resumes, analyzes real publicly accessible job descriptions, computes transparent match scores, performs ATS-style analysis, enforces strict **zero-fabrication truth checking**, generates tailored resume versions, tracks submitted applications with exact version history, and produces personalized interview preparation guides.

---

## Key Features

1. **Master Profile Synchronization**: Upload PDF/DOCX master resumes or switch between 5 pre-configured realistic demo candidates.
2. **Transparent 14-Point Match Engine**: Deterministic scoring across skills, experience, role track, location, and seniority.
3. **Strict Truth System**: Classifies job requirements into **GREEN** (verified), **YELLOW** (transferable), and **RED** (unverified). RED skills are strictly excluded from fabricated experience.
4. **ATS Analyzer Simulation**: Estimates keyword alignment and readability indexes with clear disclaimers.
5. **Resume Studio & Diff Comparison**: Generates immutable versioned resumes (`HCL_SeniorQA_v1`), displaying side-by-side modifications and reasoning.
6. **Pipeline Application Tracker**: Logs applied opportunities alongside exact resume snapshots and suggested Q&A answers.
7. **Interview Prep Studio**: Generates high-yield technical topics, resume defense questions, and STAR behavioral answers based on the exact JD and submitted resume.
8. **Manifest V3 Chrome Extension**: One-click extraction from public job pages directly to your JobPilot dashboard.

---

## Quick Start

### 1. Monorepo Setup
```bash
# Install all workspace dependencies
npm install
npm --prefix backend install
npm --prefix frontend install
npm --prefix extension install

# Seed SQLite database with test candidates and job opportunities
npm run seed

# Run Backend and Frontend concurrently
npm run dev
```

- **Frontend Application**: [http://localhost:5173](http://localhost:5173)
- **Backend REST API**: [http://localhost:5000](http://localhost:5000)

### 2. Run Test Suite
```bash
npm run test
```
Runs 18 automated integration tests verifying parser logic, scoring equations, truth checking, and resume tailoring.

### 3. Load Chrome Extension
1. Run `npm run extension` to compile TypeScript to `extension/dist`.
2. In Google Chrome, navigate to `chrome://extensions/`.
3. Toggle **Developer mode** ON (top-right).
4. Click **Load unpacked** and select `extension/dist`.

---

## Technology Stack

- **Frontend**: React 18, TypeScript, Vite, Lucide Icons, Vanilla CSS modular design system.
- **Backend**: Node.js, Express, TypeScript, Multer, PDF-Parse, Mammoth.
- **Database**: Embedded SQLite (via pure WebAssembly `sql.js`).
- **AI**: Google Gemini 1.5 Flash (free tier) with resilient deterministic fallback.
- **Extension**: Chrome Manifest V3, TypeScript.

---

## Project Structure

```
Jobpilot-AI/
├── frontend/             # React 18 + Vite client
├── backend/              # Node.js + Express + SQLite API
├── extension/            # Chrome Extension Manifest V3
├── database/             # SQLite storage and seed scripts
├── test-data/            # Candidates, jobs, and test fixtures
├── resumes/              # Resume templates and storage
├── docs/                 # Architecture, API, Setup, and Testing guides
└── package.json          # Root monorepo orchestration
```

---

## Documentation Links

- [Architecture & Scoring Specification](file:///d:/VS%20Code%20-%20Actual/Jobpilot-AI/docs/architecture.md)
- [REST API Reference](file:///d:/VS%20Code%20-%20Actual/Jobpilot-AI/docs/api.md)
- [Setup & Installation](file:///d:/VS%20Code%20-%20Actual/Jobpilot-AI/docs/setup.md)
- [Testing & Verification](file:///d:/VS%20Code%20-%20Actual/Jobpilot-AI/docs/testing.md)
