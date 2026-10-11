import { Router } from 'express';
import multer from 'multer';
import {
  CandidateController,
  JobController,
  MatchController,
  ResumeController,
  ApplicationController,
  InterviewController,
  CompanyController,
  StrategyController,
  LearningController
} from '../controllers/index.js';
import { authenticateJwt } from '../middleware/auth.middleware.js';
import { UnauthorizedError, ForbiddenError } from '../utils/errors.js';
import type { Request, Response, NextFunction } from 'express';

const upload = multer({
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

export const apiRouter = Router();

// Transitional Ownership Guard for legacy candidate mutations
function requireCandidateOwnership(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    throw new UnauthorizedError('Authentication required');
  }
  const requestedId = req.params.id || req.params.candidateId || req.body?.candidateId || req.query?.candidateId;
  // If the user is an admin or the requested ID matches the token identity or candidate ID, allow; otherwise block cross-tenant IDOR
  if (req.user.role === 'ADMIN') {
    return next();
  }
  if (requestedId && req.user.userId !== requestedId && !String(requestedId).includes(req.user.userId)) {
    // Only permit access if explicitly targeting the authenticated user's scope
    throw new ForbiddenError('Access denied: You cannot access or modify another candidate profile');
  }
  next();
}

// 1. Candidate Routes (Strictly Authenticated)
apiRouter.get('/candidates', authenticateJwt, CandidateController.getAll);
apiRouter.get('/candidates/:id', authenticateJwt, requireCandidateOwnership, CandidateController.getById);
apiRouter.put('/candidates/:id', authenticateJwt, requireCandidateOwnership, CandidateController.update);
apiRouter.post('/candidates/upload', authenticateJwt, upload.single('resume'), CandidateController.uploadResume);

// 2. Public / Semi-Public Job Discovery Routes
apiRouter.get('/jobs', JobController.getAll);
apiRouter.get('/jobs/sources', JobController.getSources);
apiRouter.get('/jobs/source-health', LearningController.getSourceHealth);
apiRouter.post('/jobs/sync-source', authenticateJwt, JobController.syncSource);
apiRouter.get('/jobs/:id', JobController.getById);
apiRouter.post('/jobs/parse', authenticateJwt, JobController.parseAndCreate);
apiRouter.post('/jobs/extract-url', authenticateJwt, JobController.extractUrl);

// 3. Company Registry Routes
apiRouter.get('/companies', CompanyController.getAll);

// 4. Matching & Strategy Routes (Authenticated)
apiRouter.post('/match/analyze', authenticateJwt, requireCandidateOwnership, MatchController.analyze);
apiRouter.get('/match/:candidateId/:jobId', authenticateJwt, requireCandidateOwnership, MatchController.getByCandidateAndJob);
apiRouter.post('/strategy/evaluate', authenticateJwt, requireCandidateOwnership, StrategyController.getStrategy);

// 5. Tailored Resume Routes (Authenticated)
apiRouter.post('/resumes/tailor', authenticateJwt, requireCandidateOwnership, ResumeController.tailor);
apiRouter.post('/resumes/validate', authenticateJwt, requireCandidateOwnership, ResumeController.validate);
apiRouter.post('/resumes/export', authenticateJwt, ResumeController.exportDocument);
apiRouter.post('/resumes/versions', authenticateJwt, ResumeController.saveVersion);
apiRouter.get('/resumes/versions/:candidateId', authenticateJwt, requireCandidateOwnership, ResumeController.getVersions);
apiRouter.get('/resumes', authenticateJwt, ResumeController.getAll);
apiRouter.get('/resumes/:id', authenticateJwt, ResumeController.getById);

// 6. Applications Routes (Authenticated)
apiRouter.get('/applications', authenticateJwt, ApplicationController.getAll);
apiRouter.get('/applications/:id', authenticateJwt, ApplicationController.getById);
apiRouter.post('/applications', authenticateJwt, requireCandidateOwnership, ApplicationController.createOrUpdate);
apiRouter.delete('/applications/:id', authenticateJwt, ApplicationController.delete);
apiRouter.delete('/applications', authenticateJwt, requireCandidateOwnership, ApplicationController.deleteByCandidateAndJob);

// 7. Interview Preparation Routes (Authenticated)
apiRouter.post('/interview/generate', authenticateJwt, requireCandidateOwnership, InterviewController.generate);
apiRouter.get('/interview/:candidateId/:jobId', authenticateJwt, requireCandidateOwnership, InterviewController.getByCandidateAndJob);

// 8. Learning & Skill Gap Routes (Authenticated / Public Resources)
apiRouter.get('/learning/skill-gaps', authenticateJwt, requireCandidateOwnership, LearningController.getSkillGaps);
apiRouter.get('/learning/resources', LearningController.getResources);
apiRouter.get('/learning/institutes', LearningController.getInstitutes);


