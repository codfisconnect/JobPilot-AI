import { Router } from 'express';
import { AuthController } from '../../controllers/v1/auth.controller.js';
import { validateRequest, RegisterSchema, LoginSchema } from '../../middleware/validate.middleware.js';
import { authenticateJwt } from '../../middleware/auth.middleware.js';

export const authRouter = Router();

// Public Authentication Endpoints
authRouter.post('/register', validateRequest({ body: RegisterSchema }), AuthController.register);
authRouter.post('/login', validateRequest({ body: LoginSchema }), AuthController.login);
authRouter.post('/refresh', AuthController.refresh);

// Authenticated Endpoints
authRouter.post('/logout', authenticateJwt, AuthController.logout);
authRouter.get('/me', authenticateJwt, AuthController.me);
