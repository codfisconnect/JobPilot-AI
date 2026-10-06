import { Router } from 'express';
import { AgentController } from './agent.controller.js';
import { authenticateJwt } from '../../middleware/auth.middleware.js';

export const agentRouter = Router();
const controller = new AgentController();

// All agent operations require candidate JWT authentication
agentRouter.use(authenticateJwt);

agentRouter.post('/sessions', controller.createSession);
agentRouter.get('/sessions', controller.listSessions);
agentRouter.get('/sessions/:id', controller.getSession);
agentRouter.post('/sessions/:id/messages', controller.sendMessage);
agentRouter.post('/actions/:id/approve', controller.approveAction);
agentRouter.post('/actions/:id/reject', controller.rejectAction);
