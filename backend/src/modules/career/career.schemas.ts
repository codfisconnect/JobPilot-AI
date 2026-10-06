import { z } from 'zod';

export const CreateLearningPlanSchema = z.object({
  jobId: z.string().uuid().optional(),
  targetJobId: z.string().uuid().optional(),
  title: z.string().min(3).optional(),
  description: z.string().optional(),
  targetRole: z.string().optional()
});

export const UpdateLearningPlanItemSchema = z.object({
  status: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED']).optional(),
  hoursSpent: z.number().min(0).optional(),
  loggedHours: z.number().min(0).optional(),
  notes: z.string().optional(),
  targetDate: z.string().optional()
});

export const VerifiedResourceSchema = z.object({
  title: z.string(),
  url: z.string().url(),
  provider: z.string(),
  type: z.string().optional(),
  isFree: z.boolean().default(true),
  description: z.string().optional()
});

export type CreateLearningPlanInput = z.infer<typeof CreateLearningPlanSchema>;
export type UpdateLearningPlanItemInput = z.infer<typeof UpdateLearningPlanItemSchema>;
export type VerifiedResource = z.infer<typeof VerifiedResourceSchema>;
