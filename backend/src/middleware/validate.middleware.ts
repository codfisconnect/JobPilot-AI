import type { Request, Response, NextFunction } from 'express';
import { z, type AnyZodObject } from 'zod';

export function validateRequest(schema: { body?: z.ZodTypeAny; query?: z.ZodTypeAny; params?: z.ZodTypeAny }) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (schema.body) {
        req.body = await schema.body.parseAsync(req.body);
      }
      if (schema.query) {
        req.query = (await schema.query.parseAsync(req.query)) as any;
      }
      if (schema.params) {
        req.params = (await schema.params.parseAsync(req.params)) as any;
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

export const RegisterSchema = z.object({
  email: z.string().trim().toLowerCase().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  fullName: z.string().optional(),
  phone: z.string().optional(),
  role: z.enum(['CANDIDATE', 'EMPLOYER', 'INSTITUTE', 'ADMIN']).optional().default('CANDIDATE'),
  location: z.string().optional(),
  experience: z.union([z.number(), z.string()]).optional(),
  designation: z.string().optional(),
  companyName: z.string().optional(),
  companyWebsite: z.string().optional(),
  industry: z.string().optional(),
  companySize: z.string().optional()
});

export const LoginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required').optional(),
  code: z.string().optional()
});

export const VerifyOtpSchema = z.object({
  email: z.string().trim().toLowerCase().email('Please enter a valid email address'),
  code: z.string().min(6, 'Verification code must be 6 digits').max(6, 'Verification code must be 6 digits'),
  purpose: z.enum(['SIGNUP', 'LOGIN', 'PASSWORD_RESET', 'EMAIL_CHANGE']).optional().default('SIGNUP'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters long').optional()
});

export const RequestOtpSchema = z.object({
  email: z.string().trim().toLowerCase().email('Please enter a valid email address'),
  purpose: z.enum(['SIGNUP', 'LOGIN', 'PASSWORD_RESET', 'EMAIL_CHANGE']).optional().default('LOGIN')
});

export const GoogleSchema = z.object({
  credential: z.string().optional(),
  code: z.string().optional(),
  redirectUri: z.string().optional()
}).refine(data => data.credential || data.code, {
  message: 'Either credential or authorization code must be provided'
});

export const LinkedInSchema = z.object({
  token: z.string().optional(),
  code: z.string().optional(),
  redirectUri: z.string().optional()
}).refine(data => data.token || data.code, {
  message: 'Either token or authorization code must be provided'
});
