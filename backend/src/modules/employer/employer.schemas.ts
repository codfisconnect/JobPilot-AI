import { z } from 'zod';
import { EmployerRole, EmployerJobStatus, EmployerApplicationStage, EmploymentType, RemoteType } from '@prisma/client';

export const createOrganizationSchema = z.object({
  name: z.string().min(2).max(100),
  domain: z.string().min(3).max(100).optional(),
  website: z.string().url().optional(),
  industry: z.string().max(100).optional(),
  description: z.string().max(2000).optional(),
  headquarters: z.string().max(100).optional(),
  logoUrl: z.string().url().optional()
});

export const createEmployerJobSchema = z.object({
  title: z.string().min(3).max(150),
  description: z.string().min(20).max(10000),
  requirements: z.array(z.string()).default([]),
  responsibilities: z.array(z.string()).default([]),
  preferredQualifications: z.array(z.string()).default([]),
  location: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
  city: z.string().max(100).optional(),
  remoteType: z.nativeEnum(RemoteType).default(RemoteType.UNKNOWN),
  employmentType: z.nativeEnum(EmploymentType).default(EmploymentType.FULL_TIME),
  salaryMin: z.number().positive().optional(),
  salaryMax: z.number().positive().optional(),
  salaryCurrency: z.string().length(3).default('USD'),
  experienceMin: z.number().nonnegative().optional(),
  experienceMax: z.number().nonnegative().optional(),
  skills: z.array(z.string()).default([])
});

export const updateEmployerJobSchema = createEmployerJobSchema.partial();

export const updateApplicationStageSchema = z.object({
  stage: z.nativeEnum(EmployerApplicationStage),
  rating: z.number().min(1).max(5).optional(),
  notes: z.string().max(2000).optional()
});

export const addApplicationNoteSchema = z.object({
  notes: z.string().min(1).max(2000),
  rating: z.number().min(1).max(5).optional()
});

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type CreateEmployerJobInput = z.input<typeof createEmployerJobSchema>;
export type UpdateEmployerJobInput = z.input<typeof updateEmployerJobSchema>;
export type UpdateApplicationStageInput = z.infer<typeof updateApplicationStageSchema>;
export type AddApplicationNoteInput = z.infer<typeof addApplicationNoteSchema>;
