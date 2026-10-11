import { z } from 'zod';
import { AgentActionType, AgentActionStatus } from '@prisma/client';

export const createAgentSessionSchema = z.object({
  title: z.string().min(2).max(100).optional()
});

export const sendAgentMessageSchema = z.object({
  message: z.string().min(1).max(3000)
});

export const approveActionSchema = z.object({
  actionId: z.string().uuid()
});

export const rejectActionSchema = z.object({
  actionId: z.string().uuid(),
  reason: z.string().max(500).optional()
});

export type CreateAgentSessionInput = z.infer<typeof createAgentSessionSchema>;
export type SendAgentMessageInput = z.infer<typeof sendAgentMessageSchema>;
