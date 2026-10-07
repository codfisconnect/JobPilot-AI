import { Router } from 'express';
import { adminController } from './admin.controller.js';
import { authenticateJwt, requireRole } from '../../middleware/auth.middleware.js';
import { UserRole } from '@prisma/client';

export const adminRouter = Router();

// 1. Strict Admin Authentication & Authorization
// Requires valid JWT AND UserRole.ADMIN in both JWT and verified role check
adminRouter.use(authenticateJwt);
adminRouter.use(requireRole([UserRole.ADMIN]));

// 2. Admin API Endpoints
adminRouter.get('/dashboard', (req, res, next) => adminController.getDashboard(req, res, next));
adminRouter.get('/candidates', (req, res, next) => adminController.getCandidates(req, res, next));
adminRouter.get('/candidates/:id', (req, res, next) => adminController.getCandidateById(req, res, next));
adminRouter.get('/resumes', (req, res, next) => adminController.getResumes(req, res, next));
adminRouter.get('/jobs', (req, res, next) => adminController.getJobs(req, res, next));
adminRouter.get('/applications', (req, res, next) => adminController.getApplications(req, res, next));
adminRouter.get('/employers', (req, res, next) => adminController.getEmployers(req, res, next));
adminRouter.get('/payments', (req, res, next) => adminController.getPayments(req, res, next));
adminRouter.get('/subscriptions', (req, res, next) => adminController.getSubscriptions(req, res, next));
adminRouter.get('/credits', (req, res, next) => adminController.getCredits(req, res, next));
adminRouter.get('/health', (req, res, next) => adminController.getHealth(req, res, next));
