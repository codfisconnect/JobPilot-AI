import { Router } from 'express';
import { adminController } from './admin.controller.js';
import { authenticateJwt, requireRole } from '../../middleware/auth.middleware.js';
import { UserRole } from '@prisma/client';

import { AdminJobSourcesController } from '../../controllers/v1/adminJobSources.controller.js';
import { AdminBulkJobSourcesController } from '../../controllers/v1/adminBulkJobSources.controller.js';

export const adminRouter = Router();

// 1. Strict Admin Authentication & Authorization
// Requires valid JWT AND UserRole.ADMIN in both JWT and verified role check
adminRouter.use(authenticateJwt);
adminRouter.use(requireRole([UserRole.ADMIN]));

// 2. Admin Job Sources - Bulk Endpoints (MUST be registered before parameterized /:id routes)
adminRouter.post('/job-sources/bulk/validate', AdminBulkJobSourcesController.validateBatch);
adminRouter.post('/job-sources/bulk', AdminBulkJobSourcesController.startBulkImport);
adminRouter.get('/job-sources/bulk', AdminBulkJobSourcesController.listBulkImports);
adminRouter.get('/job-sources/bulk/:id', AdminBulkJobSourcesController.getBulkImportById);
adminRouter.get('/job-sources/bulk/:id/items', AdminBulkJobSourcesController.getBulkImportItems);
adminRouter.post('/job-sources/bulk/:id/cancel', AdminBulkJobSourcesController.cancelBulkImport);
adminRouter.post('/job-sources/bulk/:id/items/:itemId/retry', AdminBulkJobSourcesController.retrySourceItem);

// 3. Admin Job Sources Endpoints (Universal Discovery & Management)
adminRouter.post('/job-sources/discover', AdminJobSourcesController.discoverAndConnect);
adminRouter.get('/job-sources/discovery-tasks', AdminJobSourcesController.getDiscoveryTasks);
adminRouter.get('/job-sources/discovery-tasks/:id', AdminJobSourcesController.getDiscoveryTaskById);
adminRouter.post('/job-sources/discovery-tasks/:id/cancel', AdminJobSourcesController.cancelDiscoveryTask);
adminRouter.post('/job-sources/discovery-tasks/:id/retry', AdminJobSourcesController.retryDiscoveryTask);
adminRouter.get('/job-sources', AdminJobSourcesController.listSources);
adminRouter.get('/job-sources/:id', AdminJobSourcesController.getSourceById);
adminRouter.post('/job-sources/:id/sync', AdminJobSourcesController.syncSource);
adminRouter.patch('/job-sources/:id', AdminJobSourcesController.updateSource);
adminRouter.delete('/job-sources/:id', AdminJobSourcesController.deleteSource);

// 4. Admin API Endpoints
adminRouter.get('/dashboard', (req, res, next) => adminController.getDashboard(req, res, next));
adminRouter.get('/candidates', (req, res, next) => adminController.getCandidates(req, res, next));
adminRouter.get('/candidates/:id', (req, res, next) => adminController.getCandidateById(req, res, next));
adminRouter.get('/resumes', (req, res, next) => adminController.getResumes(req, res, next));
adminRouter.get('/jobs', (req, res, next) => adminController.getJobs(req, res, next));
adminRouter.get('/jobs/:id', (req, res, next) => adminController.getJobById(req, res, next));
adminRouter.get('/applications', (req, res, next) => adminController.getApplications(req, res, next));
adminRouter.get('/employers', (req, res, next) => adminController.getEmployers(req, res, next));
adminRouter.get('/payments', (req, res, next) => adminController.getPayments(req, res, next));
adminRouter.get('/subscriptions', (req, res, next) => adminController.getSubscriptions(req, res, next));
adminRouter.get('/credits', (req, res, next) => adminController.getCredits(req, res, next));
adminRouter.get('/health', (req, res, next) => adminController.getHealth(req, res, next));
