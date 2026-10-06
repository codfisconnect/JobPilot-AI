import { Router } from 'express';
import { authenticateJwt } from '../../middleware/auth.middleware.js';
import { CareerControllerV1 } from './career.controller.js';

export const careerRouter = Router();

// All Career endpoints strictly require authentication
careerRouter.use(authenticateJwt);

careerRouter.get('/profile', CareerControllerV1.getCareerProfile);
careerRouter.get('/skills', CareerControllerV1.getCareerSkills);
careerRouter.get('/learning-plan', CareerControllerV1.getLearningPlan);
careerRouter.post('/learning-plan', CareerControllerV1.createLearningPlan);
careerRouter.patch('/learning-plan/items/:id', CareerControllerV1.updatePlanItem);
