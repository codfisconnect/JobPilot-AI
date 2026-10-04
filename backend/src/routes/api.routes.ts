import { Router } from 'express';
import multer from 'multer';
import {
  CandidateController,
  JobController,
  MatchController,
  ResumeController,
  ApplicationController,
  InterviewController
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
apiRouter.get('/jobs/:id', JobController.getById);
apiRouter.post('/jobs/parse', JobController.parseAndCreate);
apiRouter.post('/jobs/extract-url', JobController.extractUrl);

// Matching Routes
apiRouter.post('/match/analyze', MatchController.analyze);
apiRouter.get('/match/:candidateId/:jobId', MatchController.getByCandidateAndJob);

// Tailored Resume Routes
apiRouter.post('/resumes/tailor', ResumeController.tailor);
apiRouter.get('/resumes', ResumeController.getAll);
apiRouter.get('/resumes/:id', ResumeController.getById);

// Applications Routes
apiRouter.get('/applications', ApplicationController.getAll);
apiRouter.get('/applications/:id', ApplicationController.getById);
apiRouter.post('/applications', ApplicationController.createOrUpdate);

// Interview Preparation Routes
apiRouter.post('/interview/generate', InterviewController.generate);
apiRouter.get('/interview/:candidateId/:jobId', InterviewController.getByCandidateAndJob);
