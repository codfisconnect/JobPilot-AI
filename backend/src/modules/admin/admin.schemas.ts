import { z } from 'zod';

export const paginationQuerySchema = z.object({
  page: z.string().optional().transform(v => (v ? Math.max(1, parseInt(v, 10) || 1) : 1)),
  pageSize: z.string().optional().transform(v => (v ? Math.min(100, Math.max(1, parseInt(v, 10) || 20)) : 20)),
  search: z.string().optional().transform(v => v?.trim() || undefined)
});

export const jobsFilterSchema = paginationQuerySchema.extend({
  status: z.enum(['ACTIVE', 'EXPIRED', 'CLOSED', 'ALL']).optional(),
  source: z.string().optional().transform(v => v?.trim() || undefined),
  company: z.string().optional().transform(v => v?.trim() || undefined)
});

export const resumesFilterSchema = paginationQuerySchema.extend({
  status: z.enum(['UPLOADED', 'PARSING', 'PARSED', 'PARSE_REVIEW_REQUIRED', 'FAILED', 'ARCHIVED', 'ALL']).optional()
});

export const applicationsFilterSchema = paginationQuerySchema.extend({
  status: z.enum(['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'INTERVIEW_SCHEDULED', 'OFFERED', 'REJECTED', 'ACCEPTED', 'WITHDRAWN', 'ALL']).optional()
});

export const paymentsFilterSchema = paginationQuerySchema.extend({
  status: z.enum(['CREATED', 'AUTHORIZED', 'CAPTURED', 'REFUNDED', 'FAILED', 'ALL']).optional()
});

export const subscriptionsFilterSchema = paginationQuerySchema.extend({
  status: z.enum(['ACTIVE', 'PAST_DUE', 'CANCELED', 'EXPIRED', 'TRIALING', 'ALL']).optional()
});

export const candidateIdParamSchema = z.object({
  id: z.string().uuid()
});
