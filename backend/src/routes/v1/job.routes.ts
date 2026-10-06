import { Router } from 'express';
import { JobControllerV1 } from '../../controllers/v1/job.controller.js';
import { authenticateJwt } from '../../middleware/auth.middleware.js';

export const jobRouter = Router();

// Public or Authenticated Job Search and Detail
jobRouter.get('/', authenticateJwt, JobControllerV1.listJobs);
jobRouter.get('/:id', authenticateJwt, JobControllerV1.getJobById);

// Ingestion trigger (restricted to authenticated admin/internal users)
jobRouter.post('/sync', authenticateJwt, JobControllerV1.syncJobs);
