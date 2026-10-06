import { Router } from 'express';
import multer from 'multer';
import { authenticateJwt } from '../../middleware/auth.middleware.js';
import { ResumeControllerV1 } from '../../controllers/v1/resume.controller.js';

// Multer memory storage (files will be validated and piped to IResumeStorage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

export const resumeRouter = Router();

// Strictly enforce JWT authentication on all resume operations
resumeRouter.use(authenticateJwt);

// Resumes collection
resumeRouter.get('/', ResumeControllerV1.listResumes);
resumeRouter.post('/', upload.single('resume'), ResumeControllerV1.uploadResume);
resumeRouter.get('/:id', ResumeControllerV1.getResume);
resumeRouter.delete('/:id', ResumeControllerV1.deleteResume);

// Parsing & Confirmation pipeline
resumeRouter.post('/:id/parse', ResumeControllerV1.parseResume);
resumeRouter.post('/:id/confirm', ResumeControllerV1.confirmParsedResume);

// Immutable Resume Versions
resumeRouter.get('/:id/versions', ResumeControllerV1.listVersions);
resumeRouter.post('/:id/versions', ResumeControllerV1.createVersion);
