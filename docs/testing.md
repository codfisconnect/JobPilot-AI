# JobPilot AI Testing & Verification Guide

## 1. Automated Test Suite

JobPilot includes automated integration tests verifying core backend engines:
- Resume parsing (text & structured extraction)
- Job description parsing
- Truth Check accuracy (GREEN, YELLOW, RED classification)
- Career Track detection & cross-domain transition checks
- Deterministic Match Scoring Engine
- Resume tailoring with strict anti-fabrication enforcement
- ATS analysis simulation & scoring algorithms

Run the automated test suite anytime:
```bash
npm run test
```

### Verification Output:
```text
--- Running JobPilot AI Critical Backend Test Suite ---
[PASS] Resume Parser extracts candidate name
[PASS] Resume Parser extracts years of experience
[PASS] Resume Parser extracts primary skills (Java)
[PASS] Job Parser identifies correct role
[PASS] Job Parser identifies must-have skill Java
[PASS] Job Parser identifies must-have skill Playwright
[PASS] Truth Check correctly marks matching skills as GREEN
[PASS] Truth Check passes for strong match candidate
[PASS] Truth Check detects missing unverified skills as RED
[PASS] Career track detector confirms same track for QA -> QA
[PASS] Career track detector detects cross-track for QA -> Data Analytics
[PASS] Match Engine gives high score for aligned QA job (>80%)
[PASS] Match Engine provides Recommended or Strongly Recommended
[PASS] Resume generator formats version name correctly: HCLTechnologies_SeniorQA_v1
[PASS] Tailored resume verifies truth check flag
[PASS] Tailored resume documents transparent modifications with rationale
[PASS] ATS Analyzer computes estimated score
[PASS] ATS Analyzer includes required disclaimer

Test Results: 18/18 passed.
ALL CRITICAL BACKEND TESTS PASSED SUCCESSFULLY!
```

---

## 2. End-to-End Manual Workflow Verification

Follow this end-to-end journey in the browser to verify full functionality:

1. **Open Dashboard**: Go to `http://localhost:5173`.
2. **Switch Demo Candidates**: Use the top-left dropdown in the sidebar to alternate between:
   - Aarav Sharma (QA Automation, 5.5 yrs)
   - Priya Iyer (Java Backend, 4.8 yrs)
   - Rohan Deshmukh (Data Analyst, 3.5 yrs)
   - Sneha Patel (Manual QA transitioning to Automation, 3.0 yrs)
   - Vikram Malhotra (Full Stack, 5.0 yrs)
3. **Inspect Profile**: Go to **My Profile** to view verified technical skills, work history, and contact details. Edit and save changes.
4. **Inspect Job Opportunities**: Go to **Jobs & Matching**. Filter by track or search by technology.
5. **Run Evaluation**: Click **Launch AI Analysis** on *HCL Technologies — Senior QA Automation Engineer*.
6. **Verify Match Dimensions**: Review the overall score, Truth Check breakdown, ATS simulation, and suggested application answers.
7. **Generate Tailored Resume**: Click **Generate Job-Specific Tailored Resume**.
8. **Inspect Resume Studio**: Review the side-by-side diff comparing the original summary vs. tailored summary.
9. **Continue Application**: Click **Continue Application & Track**. The application is stored in the pipeline.
10. **Inspect Pipeline**: Go to **Applications** to view saved applications with their exact resume versions.
11. **Generate Interview Prep**: Click **Open Interview Prep** to generate role-specific technical questions, resume defense inquiries, and behavioral outlines.
