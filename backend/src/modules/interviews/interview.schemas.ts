import { z } from 'zod';

export const CreateInterviewSessionSchema = z.object({
  jobId: z.string().uuid({ message: 'Valid Job UUID is required' }).optional(),
  resumeVersionId: z.string().uuid({ message: 'Invalid resumeVersionId' }).optional()
});

export const GenerateQuestionsSchema = z.object({
  count: z.number().int().min(1).max(10).default(5),
  focusTypes: z.array(z.enum([
    'TECHNICAL',
    'BEHAVIORAL',
    'RESUME_BASED',
    'ROLE_SPECIFIC',
    'SKILL_GAP',
    'GENERAL'
  ])).optional()
});

export const SubmitAnswerSchema = z.object({
  answerText: z.string().min(1, { message: 'Answer cannot be empty' })
});

export const GeneratedQuestionItemSchema = z.object({
  type: z.enum([
    'TECHNICAL',
    'BEHAVIORAL',
    'RESUME_BASED',
    'ROLE_SPECIFIC',
    'SKILL_GAP',
    'GENERAL'
  ]),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']),
  question: z.string().min(5),
  context: z.string().optional(),
  suggestedAnswerGuide: z.string().optional(),
  sourceSkill: z.string().optional()
});

export const GeneratedQuestionListSchema = z.object({
  questions: z.array(GeneratedQuestionItemSchema).min(1)
});

export const EvaluatedAnswerOutputSchema = z.object({
  clarityScore: z.number().int().min(0).max(100),
  accuracyScore: z.number().int().min(0).max(100).nullable(),
  relevanceScore: z.number().int().min(0).max(100),
  structureScore: z.number().int().min(0).max(100),
  overallScore: z.number().int().min(0).max(100),
  strengths: z.array(z.string()).default([]),
  missingPoints: z.array(z.string()).default([]),
  suggestions: z.array(z.string()).default([]),
  feedback: z.string().min(1)
});

export type CreateInterviewSessionInput = z.infer<typeof CreateInterviewSessionSchema>;
export type GenerateQuestionsInput = z.infer<typeof GenerateQuestionsSchema>;
export type SubmitAnswerInput = z.infer<typeof SubmitAnswerSchema>;
export type GeneratedQuestionItem = z.infer<typeof GeneratedQuestionItemSchema>;
export type EvaluatedAnswerOutput = z.infer<typeof EvaluatedAnswerOutputSchema>;
