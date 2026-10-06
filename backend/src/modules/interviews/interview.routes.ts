import { Router } from 'express';
import { authenticateJwt } from '../../middleware/auth.middleware.js';
import { InterviewControllerV1 } from './interview.controller.js';

export const interviewRouter = Router();

// All Interview routes strictly require authentication
interviewRouter.use(authenticateJwt);

// Interview Sessions
interviewRouter.get('/sessions', InterviewControllerV1.getSessions);
interviewRouter.get('/sessions/:id', InterviewControllerV1.getSessionById);
interviewRouter.post('/sessions/:id/questions', InterviewControllerV1.generateQuestions);

// Questions and Evaluations
interviewRouter.post('/questions/:id/answer', InterviewControllerV1.submitAnswer);
interviewRouter.post('/questions/:id/evaluate', InterviewControllerV1.evaluateAnswer);
