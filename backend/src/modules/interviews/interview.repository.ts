import { prisma } from '../../database/prisma.js';
import type {
  InterviewPreparationSession,
  InterviewQuestion,
  InterviewAnswer,
  InterviewEvaluation,
  InterviewQuestionType,
  QuestionDifficulty,
  SessionStatus
} from '@prisma/client';

export class InterviewRepository {
  public static async createSession(data: {
    candidateProfileId: string;
    jobId: string;
    resumeVersionId?: string | null;
    title?: string;
    inputHash?: string | null;
  }): Promise<InterviewPreparationSession> {
    return prisma.interviewPreparationSession.create({
      data: {
        candidateProfileId: data.candidateProfileId,
        jobId: data.jobId,
        resumeVersionId: data.resumeVersionId || null,
        title: data.title || 'Interview Preparation Session',
        inputHash: data.inputHash || null,
        status: 'IN_PROGRESS'
      },
      include: {
        job: { select: { id: true, title: true, company: { select: { name: true } } } },
        resumeVersion: { select: { id: true, versionName: true, title: true } },
        questions: { orderBy: { displayOrder: 'asc' } }
      }
    });
  }

  public static async findSessionById(id: string) {
    return prisma.interviewPreparationSession.findUnique({
      where: { id },
      include: {
        job: {
          select: {
            id: true,
            title: true,
            description: true,
            responsibilities: true,
            requirements: true,
            preferredQualifications: true,
            company: { select: { id: true, name: true } }
          }
        },
        resumeVersion: { select: { id: true, versionName: true, title: true, structuredContent: true } },
        questions: {
          orderBy: { displayOrder: 'asc' },
          include: {
            answers: {
              orderBy: { submittedAt: 'desc' },
              include: { evaluation: true }
            }
          }
        }
      }
    });
  }

  public static async findSessionsByCandidate(candidateProfileId: string) {
    return prisma.interviewPreparationSession.findMany({
      where: { candidateProfileId },
      orderBy: { createdAt: 'desc' },
      include: {
        job: { select: { id: true, title: true, company: { select: { name: true } } } },
        resumeVersion: { select: { id: true, versionName: true, title: true } },
        questions: {
          select: {
            id: true,
            type: true,
            difficulty: true,
            answers: { select: { id: true, evaluation: { select: { overallScore: true } } } }
          }
        }
      }
    });
  }

  public static async findLatestSessionForCandidateAndJob(candidateProfileId: string, jobId: string) {
    return prisma.interviewPreparationSession.findFirst({
      where: { candidateProfileId, jobId },
      orderBy: { createdAt: 'desc' },
      include: {
        job: { select: { id: true, title: true, company: { select: { name: true } } } },
        resumeVersion: { select: { id: true, versionName: true, title: true } },
        questions: {
          orderBy: { displayOrder: 'asc' },
          include: {
            answers: {
              orderBy: { submittedAt: 'desc' },
              include: { evaluation: true }
            }
          }
        }
      }
    });
  }

  public static async createQuestions(sessionId: string, questions: Array<{
    type: InterviewQuestionType;
    difficulty: QuestionDifficulty;
    question: string;
    context?: string | null;
    suggestedAnswerGuide?: string | null;
    sourceSkill?: string | null;
    displayOrder: number;
  }>): Promise<InterviewQuestion[]> {
    const created: InterviewQuestion[] = [];
    for (const q of questions) {
      const item = await prisma.interviewQuestion.create({
        data: {
          sessionId,
          type: q.type,
          difficulty: q.difficulty,
          question: q.question,
          context: q.context || null,
          suggestedAnswerGuide: q.suggestedAnswerGuide || null,
          sourceSkill: q.sourceSkill || null,
          displayOrder: q.displayOrder
        }
      });
      created.push(item);
    }
    return created;
  }

  public static async findQuestionById(id: string) {
    return prisma.interviewQuestion.findUnique({
      where: { id },
      include: {
        session: {
          include: {
            candidateProfile: true,
            job: { include: { company: true } },
            resumeVersion: true
          }
        },
        answers: {
          orderBy: { submittedAt: 'desc' },
          include: { evaluation: true }
        }
      }
    });
  }

  public static async createAnswer(questionId: string, answerText: string): Promise<InterviewAnswer> {
    return prisma.interviewAnswer.create({
      data: {
        questionId,
        answerText
      }
    });
  }

  public static async findAnswerById(id: string) {
    return prisma.interviewAnswer.findUnique({
      where: { id },
      include: {
        question: {
          include: {
            session: {
              include: {
                candidateProfile: true,
                job: { include: { company: true } }
              }
            }
          }
        },
        evaluation: true
      }
    });
  }

  public static async upsertEvaluation(answerId: string, data: {
    clarityScore: number;
    accuracyScore?: number | null;
    relevanceScore: number;
    structureScore: number;
    overallScore: number;
    strengths: string[];
    missingPoints: string[];
    suggestions: string[];
    feedback: string;
  }): Promise<InterviewEvaluation> {
    return prisma.interviewEvaluation.upsert({
      where: { answerId },
      update: {
        clarityScore: data.clarityScore,
        accuracyScore: data.accuracyScore ?? null,
        relevanceScore: data.relevanceScore,
        structureScore: data.structureScore,
        overallScore: data.overallScore,
        strengths: data.strengths,
        missingPoints: data.missingPoints,
        suggestions: data.suggestions,
        feedback: data.feedback,
        evaluatedAt: new Date()
      },
      create: {
        answerId,
        clarityScore: data.clarityScore,
        accuracyScore: data.accuracyScore ?? null,
        relevanceScore: data.relevanceScore,
        structureScore: data.structureScore,
        overallScore: data.overallScore,
        strengths: data.strengths,
        missingPoints: data.missingPoints,
        suggestions: data.suggestions,
        feedback: data.feedback
      }
    });
  }

  public static async updateSessionStatus(sessionId: string, status: SessionStatus) {
    return prisma.interviewPreparationSession.update({
      where: { id: sessionId },
      data: { status }
    });
  }
}
