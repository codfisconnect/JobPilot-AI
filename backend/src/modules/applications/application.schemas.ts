import { z } from 'zod';
import { ApplicationStatus } from '@prisma/client';

export const ApplicationStatusEnum = z.nativeEnum(ApplicationStatus);

export const CreateApplicationSchema = z.object({
  jobId: z.string().uuid('Job ID must be a valid UUID'),
  resumeVersionId: z.string().uuid('Resume version ID must be a valid UUID').optional(),
  status: ApplicationStatusEnum.optional().default(ApplicationStatus.SAVED),
  externalUrl: z.string().url('External URL must be a valid URL').optional().or(z.literal('')),
  notesSummary: z.string().max(2000, 'Notes summary must not exceed 2000 characters').optional(),
  customAnswers: z.record(z.any()).optional(),
  metadata: z.record(z.any()).optional()
});

export const UpdateApplicationSchema = z.object({
  resumeVersionId: z.string().uuid('Resume version ID must be a valid UUID').nullable().optional(),
  externalUrl: z.string().url('External URL must be a valid URL').nullable().optional().or(z.literal('')),
  notesSummary: z.string().max(2000, 'Notes summary must not exceed 2000 characters').nullable().optional(),
  customAnswers: z.record(z.any()).nullable().optional(),
  metadata: z.record(z.any()).nullable().optional()
});

export const UpdateApplicationStatusSchema = z.object({
  status: ApplicationStatusEnum,
  reason: z.string().max(500, 'Reason must not exceed 500 characters').optional()
});

export const CreateApplicationNoteSchema = z.object({
  content: z.string().min(1, 'Note content cannot be empty').max(5000, 'Note content must not exceed 5000 characters')
});

export const CreateApplicationReminderSchema = z.object({
  title: z.string().min(1, 'Reminder title cannot be empty').max(200, 'Reminder title must not exceed 200 characters'),
  dueDate: z.string().datetime({ message: 'Due date must be a valid ISO-8601 string' }).transform(str => new Date(str))
});

export const ApplicationFilterSchema = z.object({
  status: ApplicationStatusEnum.optional(),
  search: z.string().max(100).optional(),
  page: z.string().optional().transform(v => (v ? Math.max(1, parseInt(v, 10) || 1) : 1)),
  pageSize: z.string().optional().transform(v => (v ? Math.min(100, Math.max(1, parseInt(v, 10) || 20)) : 20)),
  sortBy: z.enum(['createdAt', 'appliedAt', 'updatedAt']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc')
});

export const SaveJobBodySchema = z.object({
  notes: z.string().max(1000).optional()
});
