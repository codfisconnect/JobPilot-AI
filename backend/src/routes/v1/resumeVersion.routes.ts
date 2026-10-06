import { Router } from 'express';
import { authenticateJwt } from '../../middleware/auth.middleware.js';
import { ResumeControllerV1 } from '../../controllers/v1/resume.controller.js';

export const resumeVersionRouter = Router();

resumeVersionRouter.use(authenticateJwt);

resumeVersionRouter.get('/:id', ResumeControllerV1.getVersionById);
