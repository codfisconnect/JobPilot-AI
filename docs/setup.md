# JobPilot AI — Setup & Installation Guide

## Prerequisites
- **Node.js**: v18+ (tested on Node.js v24.21.0)
- **npm**: v9+ (tested on npm 11.19.0)
- **Google Chrome**: (for Manifest V3 extension)

---

## 1. Quick Start

### Step 1: Install Dependencies
From the monorepo root:
```bash
npm install
npm --prefix backend install
npm --prefix frontend install
npm --prefix extension install
```

### Step 2: Seed SQLite Database
Populate 5 realistic demo candidates, 10 industry job postings, and demo applications:
```bash
npm run seed
```

### Step 3: Start Application
Run both backend and frontend concurrently:
```bash
npm run dev
```
- **Backend API**: `http://localhost:5000`
- **Frontend App**: `http://localhost:5173`

---

## 2. Chrome Extension Setup

1. Build extension distribution:
   ```bash
   npm run extension
   ```
2. Open Google Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** toggle in the top-right corner.
4. Click **Load unpacked** and select the folder:
   `d:\VS Code - Actual\Jobpilot-AI\extension\dist`
5. Open any job opening webpage and click the **JobPilot AI** extension icon to analyze it!

---

## 3. Gemini Free-Tier Configuration (Optional)

JobPilot includes a resilient deterministic fallback engine that runs immediately out of the box without requiring an API key.

To enable full Gemini 1.5 Flash live generative reasoning:
1. Copy `.env.example` to `backend/.env`:
   ```bash
   cp .env.example backend/.env
   ```
2. Insert your free API key from [Google AI Studio](https://aistudio.google.com/):
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   ```
3. Restart the backend process.
