import { Router } from 'express';
import { JobControllerV1 } from '../../controllers/v1/job.controller.js';
import { JobMatchingControllerV1 } from '../../controllers/v1/jobMatching.controller.js';
import { authenticateJwt } from '../../middleware/auth.middleware.js';

export const jobRouter = Router();

// Public or Authenticated Job Search and Detail
jobRouter.get('/', authenticateJwt, JobControllerV1.listJobs);
jobRouter.get('/:id', authenticateJwt, JobControllerV1.getJobById);

// Sprint 4: Matching, Skill Gap, and Resume Intelligence Routes
jobRouter.get('/:id/match', authenticateJwt, JobMatchingControllerV1.getMatch);
jobRouter.post('/:id/match/recalculate', authenticateJwt, JobMatchingControllerV1.recalculateMatch);
jobRouter.get('/:id/skill-gap', authenticateJwt, JobMatchingControllerV1.getSkillGap);
jobRouter.post('/:id/tailor-resume', authenticateJwt, JobMatchingControllerV1.tailorResume);
jobRouter.get('/:id/tailored-resumes', authenticateJwt, JobMatchingControllerV1.getTailoredResumes);

// Ingestion trigger (restricted to authenticated admin/internal users)
jobRouter.post('/sync', authenticateJwt, JobControllerV1.syncJobs);

