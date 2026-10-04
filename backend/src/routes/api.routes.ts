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

const upload = multer({
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

export const apiRouter = Router();

// Candidate Routes
apiRouter.get('/candidates', CandidateController.getAll);
apiRouter.get('/candidates/:id', CandidateController.getById);
apiRouter.put('/candidates/:id', CandidateController.update);
apiRouter.post('/candidates/upload', upload.single('resume'), CandidateController.uploadResume);

// Job Routes
apiRouter.get('/jobs', JobController.getAll);
apiRouter.get('/jobs/sources', JobController.getSources);
apiRouter.get('/jobs/source-health', LearningController.getSourceHealth);
apiRouter.post('/jobs/sync-source', JobController.syncSource);
apiRouter.get('/jobs/:id', JobController.getById);
apiRouter.post('/jobs/parse', JobController.parseAndCreate);
apiRouter.post('/jobs/extract-url', JobController.extractUrl);

// Company Registry Routes
apiRouter.get('/companies', CompanyController.getAll);

// Matching & Strategy Routes
apiRouter.post('/match/analyze', MatchController.analyze);
apiRouter.get('/match/:candidateId/:jobId', MatchController.getByCandidateAndJob);
apiRouter.post('/strategy/evaluate', StrategyController.getStrategy);

// Tailored Resume Routes
apiRouter.post('/resumes/tailor', ResumeController.tailor);
apiRouter.post('/resumes/validate', ResumeController.validate);
apiRouter.post('/resumes/export', ResumeController.exportDocument);
apiRouter.post('/resumes/versions', ResumeController.saveVersion);
apiRouter.get('/resumes/versions/:candidateId', ResumeController.getVersions);
apiRouter.get('/resumes', ResumeController.getAll);
apiRouter.get('/resumes/:id', ResumeController.getById);

// Applications Routes
apiRouter.get('/applications', ApplicationController.getAll);
apiRouter.get('/applications/:id', ApplicationController.getById);
apiRouter.post('/applications', ApplicationController.createOrUpdate);
apiRouter.delete('/applications/:id', ApplicationController.delete);
apiRouter.delete('/applications', ApplicationController.deleteByCandidateAndJob);

// Interview Preparation Routes
apiRouter.post('/interview/generate', InterviewController.generate);
apiRouter.get('/interview/:candidateId/:jobId', InterviewController.getByCandidateAndJob);

// Learning & Skill Gap Routes
apiRouter.get('/learning/skill-gaps', LearningController.getSkillGaps);
apiRouter.get('/learning/resources', LearningController.getResources);
apiRouter.get('/learning/institutes', LearningController.getInstitutes);

