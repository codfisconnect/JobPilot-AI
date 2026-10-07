import { z } from 'zod';
import { PlanCode } from '@prisma/client';

export const CheckoutRequestSchema = z.object({
  planCode: z.nativeEnum(PlanCode, {
    errorMap: () => ({ message: 'Invalid plan code. Expected FREE, BASIC, or PRO' })
  })
});

export const VerifyPaymentSchema = z.object({
  providerOrderId: z.string().min(1, 'providerOrderId is required'),
  providerPaymentId: z.string().min(1, 'providerPaymentId is required'),
  providerSignature: z.string().min(1, 'providerSignature is required')
});

export const LedgerQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0)
});
