import { Router } from 'express';
import { AuthController } from '../../controllers/v1/auth.controller.js';
import {
  validateRequest,
  RegisterSchema,
  LoginSchema,
  VerifyOtpSchema,
  RequestOtpSchema,
  GoogleSchema,
  LinkedInSchema
} from '../../middleware/validate.middleware.js';
import { authenticateJwt } from '../../middleware/auth.middleware.js';

export const authRouter = Router();

// Public Authentication Endpoints
authRouter.post('/register', validateRequest({ body: RegisterSchema }), AuthController.register);
authRouter.post('/verify-otp', validateRequest({ body: VerifyOtpSchema }), AuthController.verifyOtp);
authRouter.post('/request-otp', validateRequest({ body: RequestOtpSchema }), AuthController.requestOtp);
authRouter.post('/resend-otp', validateRequest({ body: RequestOtpSchema }), AuthController.resendOtp);
authRouter.post('/login', validateRequest({ body: LoginSchema }), AuthController.login);
authRouter.post('/reset-password', validateRequest({ body: VerifyOtpSchema }), AuthController.verifyOtp);
authRouter.post('/refresh', AuthController.refresh);
authRouter.post('/google', validateRequest({ body: GoogleSchema }), AuthController.googleAuth);
authRouter.post('/linkedin', validateRequest({ body: LinkedInSchema }), AuthController.linkedinAuth);

// Authenticated Endpoints
authRouter.post('/logout', authenticateJwt, AuthController.logout);
authRouter.get('/me', authenticateJwt, AuthController.me);
