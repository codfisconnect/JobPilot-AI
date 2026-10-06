import { Router } from 'express';
import { EmployerController } from './employer.controller.js';
import { authenticateJwt } from '../../middleware/auth.middleware.js';

export const employerRouter = Router();
const controller = new EmployerController();

// All employer routes require JWT authentication
employerRouter.use(authenticateJwt);

// Organization Profile & Onboarding
employerRouter.get('/me', controller.getMyOrganization);
employerRouter.post('/organizations', controller.createOrganization);
employerRouter.get('/dashboard', controller.getDashboardMetrics);

// Job Management
employerRouter.get('/jobs', controller.listJobs);
employerRouter.post('/jobs', controller.createJob);
employerRouter.get('/jobs/:id', controller.getJob);
employerRouter.patch('/jobs/:id', controller.updateJob);
employerRouter.post('/jobs/:id/publish', controller.publishJob);
employerRouter.post('/jobs/:id/pause', controller.pauseJob);
employerRouter.post('/jobs/:id/close', controller.closeJob);

// Applicant Pipeline
employerRouter.get('/jobs/:id/applications', controller.listJobApplications);
employerRouter.get('/applications/:id', controller.getApplicationDetail);
employerRouter.patch('/applications/:id/stage', controller.updateApplicationStage);
employerRouter.post('/applications/:id/notes', controller.addApplicationNote);
