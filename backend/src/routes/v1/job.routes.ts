import { Router } from 'express';
import { JobControllerV1 } from '../../controllers/v1/job.controller.js';
import { JobMatchingControllerV1 } from '../../controllers/v1/jobMatching.controller.js';
import { InterviewControllerV1 } from '../../modules/interviews/interview.controller.js';
import { authenticateJwt, optionalAuthenticateJwt } from '../../middleware/auth.middleware.js';

export const jobRouter = Router();

// Personalized Recommendations Route (Registered before /:id wildcard)
jobRouter.get('/recommended', optionalAuthenticateJwt, JobControllerV1.getRecommendedJobs);

// Public or Authenticated Job Search and Detail (candidates discover jobs without requiring an admin token)
jobRouter.get('/', optionalAuthenticateJwt, JobControllerV1.listJobs);
jobRouter.get('/:id', optionalAuthenticateJwt, JobControllerV1.getJobById);

// Sprint 4: Matching, Skill Gap, and Resume Intelligence Routes
jobRouter.get('/:id/match', authenticateJwt, JobMatchingControllerV1.getMatch);
jobRouter.post('/:id/match/recalculate', authenticateJwt, JobMatchingControllerV1.recalculateMatch);
jobRouter.get('/:id/skill-gap', authenticateJwt, JobMatchingControllerV1.getSkillGap);
jobRouter.post('/:id/tailor-resume', authenticateJwt, JobMatchingControllerV1.tailorResume);
jobRouter.get('/:id/tailored-resumes', authenticateJwt, JobMatchingControllerV1.getTailoredResumes);

// Sprint 6: Interview Preparation Session Creation for Target Job
jobRouter.post('/:id/interview/sessions', authenticateJwt, InterviewControllerV1.createSessionForJob);

// Ingestion trigger (restricted to authenticated admin/internal users)
jobRouter.post('/sync', authenticateJwt, JobControllerV1.syncJobs);

