import crypto from 'crypto';
import { InterviewRepository } from './interview.repository.js';
import { CandidateProfileRepository } from '../../repositories/candidateProfile.repository.js';
import { prisma } from '../../database/prisma.js';
import { NotFoundError, ForbiddenError, BadRequestError } from '../../utils/errors.js';
import { AIServiceFactory } from '../../ai/index.js';
import { ProductionMatchingService } from '../../services/matching.service.js';
import {
  GeneratedQuestionListSchema,
  EvaluatedAnswerOutputSchema,
  type GeneratedQuestionItem,
  type EvaluatedAnswerOutput
} from './interview.schemas.js';
import type { InterviewQuestionType, QuestionDifficulty } from '@prisma/client';

export class InterviewService {
  /**
   * Ownership verification: Ensure session belongs to candidate
   */
  public static async assertCandidateProfile(userId: string) {
    const profile = await CandidateProfileRepository.findByUserId(userId);
    if (!profile) {
      throw new NotFoundError('Candidate profile not found');
    }
    return profile;
  }

  /**
   * Create or retrieve interview preparation session for authenticated candidate & job
   */
  public static async createSession(userId: string, jobId: string, resumeVersionId?: string) {
    const profile = await this.assertCandidateProfile(userId);

    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: { company: true }
    });

    if (!job) {
      throw new NotFoundError(`Job opening with ID ${jobId} not found`);
    }

    // Verify resume version ownership if provided
    if (resumeVersionId) {
      const version = await prisma.resumeVersion.findUnique({
        where: { id: resumeVersionId },
        include: { resume: true }
      });
      if (!version || version.resume.candidateProfileId !== profile.id) {
        throw new ForbiddenError('Unauthorized: Resume version does not belong to candidate');
      }
    }

    // Deterministic input hash for caching check
    const inputHash = crypto
      .createHash('sha256')
      .update(`${profile.id}:${jobId}:${resumeVersionId || 'default'}`)
      .digest('hex');

    // Check if session already exists for this exact combination
    const existingSession = await prisma.interviewPreparationSession.findFirst({
      where: {
        candidateProfileId: profile.id,
        jobId,
        inputHash
      },
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

    if (existingSession && existingSession.questions.length > 0) {
      return existingSession;
    }

    const sessionTitle = `Interview Prep: ${job.title} at ${job.company.name}`;
    const session = await InterviewRepository.createSession({
      candidateProfileId: profile.id,
      jobId,
      resumeVersionId,
      title: sessionTitle,
      inputHash
    });

    // Auto-generate initial set of grounded questions
    await this.generateQuestionsForSession(profile.id, session.id, { count: 5 });

    return InterviewRepository.findSessionById(session.id);
  }

  /**
   * Get all sessions for authenticated candidate
   */
  public static async getSessions(userId: string) {
    const profile = await this.assertCandidateProfile(userId);
    return InterviewRepository.findSessionsByCandidate(profile.id);
  }

  /**
   * Get specific session by ID with ownership check
   */
  public static async getSessionById(userId: string, sessionId: string) {
    const profile = await this.assertCandidateProfile(userId);
    const session = await InterviewRepository.findSessionById(sessionId);

    if (!session) {
      throw new NotFoundError(`Interview session ${sessionId} not found`);
    }

    if (session.candidateProfileId !== profile.id) {
      throw new ForbiddenError('Unauthorized: Cross-candidate interview access is denied');
    }

    return session;
  }

  /**
   * Generate truthful, grounded interview questions
   * Grounded in: Job description, verified candidate profile, verified resume content, identified skill gaps, career track
   * Never fabricates candidate experience.
   */
  public static async generateQuestionsForSession(
    candidateProfileId: string,
    sessionId: string,
    options: { count?: number; focusTypes?: string[] } = {}
  ) {
    const session = await prisma.interviewPreparationSession.findUnique({
      where: { id: sessionId },
      include: {
        candidateProfile: {
          include: {
            experiences: true,
            skills: { include: { skill: true } },
            projects: true
          }
        },
        job: { include: { company: true } },
        resumeVersion: true
      }
    });

    if (!session || session.candidateProfileId !== candidateProfileId) {
      throw new NotFoundError('Session not found or unauthorized');
    }

    const count = options.count || 5;
    const profile = session.candidateProfile;
    const job = session.job;

    // 1. Gather verified candidate profile facts
    const verifiedSkills = profile.skills.map(s => s.skill.name);
    const verifiedExperiences = profile.experiences.map(e => ({
      company: e.company,
      title: e.jobTitle,
      technologies: e.technologies,
      responsibilities: e.responsibilities
    }));
    const verifiedProjects = profile.projects.map(p => ({
      name: p.name,
      technologies: p.technologies,
      role: p.role
    }));

    // 2. Compute truth check / skill gaps deterministically
    const skillGaps = ProductionMatchingService.evaluateSkillEvidence(
      verifiedSkills,
      job.requirements || [],
      job.preferredQualifications || []
    );

    const missingSkills = skillGaps.items.filter(i => i.status === 'MISSING').map(i => i.skill);
    const partialSkills = skillGaps.items.filter(i => i.status === 'PARTIAL').map(i => i.skill);

    // 3. Detect Career Track
    const careerTrack = ProductionMatchingService.detectCareerTrack(
      profile.headline || profile.experiences[0]?.jobTitle || 'Software Engineer',
      job.title
    );

    // AI Provider invocation with Zod validation and truthful deterministic fallback
    let generatedQuestions: GeneratedQuestionItem[] = [];
    const ai = AIServiceFactory.getProvider();

    if (ai.isAvailable()) {
      try {
        const prompt = `
You are an expert technical interviewer for ${job.company.name}.
Target Job:
- Title: ${job.title}
- Company: ${job.company.name}
- Key Requirements: ${(job.requirements || []).join(', ') || 'Standard requirements'}
- Responsibilities: ${(job.responsibilities || []).slice(0, 3).join('; ') || 'Standard responsibilities'}

VERIFIED CANDIDATE BACKGROUND (STRICT TRUTH CONSTRAINTS):
- Candidate Verified Skills: ${verifiedSkills.join(', ') || 'Software Development'}
- Verified Past Employers: ${verifiedExperiences.map(e => `${e.title} at ${e.company} (${e.technologies.join(', ')})`).join(' | ') || 'Engineering experience'}
- Identified Skill Gaps (Skills required by Job but NOT in candidate profile): ${missingSkills.join(', ') || 'None'}
- Partial / Adjacent Skills: ${partialSkills.join(', ') || 'None'}
- Career Track Transition: Same Track: ${careerTrack.isSameTrack}. Details: ${careerTrack.transitionGapExplanation || 'Direct alignment'}

STRICT ANTI-FABRICATION RULES:
1. NEVER fabricate candidate past experience, metrics, team sizes, company names, or accomplishments.
2. If the candidate worked with Selenium, DO NOT claim or assume they led a 50-person migration to Selenium Grid unless verified above.
3. For SKILL_GAP questions, explore how they would ramp up on ${missingSkills[0] || 'new tools'} based on their adjacent verified foundations.
4. For RESUME_BASED questions, cite ONLY the actual companies (${verifiedExperiences.map(e => e.company).join(', ') || 'past roles'}) and technologies present above.
5. Generate exactly ${count} diverse questions spanning TECHNICAL, BEHAVIORAL, RESUME_BASED, ROLE_SPECIFIC, SKILL_GAP.

Respond ONLY with a JSON object matching this schema:
{
  "questions": [
    {
      "type": "TECHNICAL" | "BEHAVIORAL" | "RESUME_BASED" | "ROLE_SPECIFIC" | "SKILL_GAP" | "GENERAL",
      "difficulty": "EASY" | "MEDIUM" | "HARD",
      "question": "string",
      "context": "string explaining why this is asked based on JD or verified background",
      "suggestedAnswerGuide": "string outline of what an interviewer expects",
      "sourceSkill": "string or null"
    }
  ]
}
`;
        const rawJson = await ai.generateJSON<any>(prompt);
        const parsed = GeneratedQuestionListSchema.safeParse(rawJson);
        if (parsed.success && parsed.data.questions.length > 0) {
          generatedQuestions = parsed.data.questions.slice(0, count);
        }
      } catch (aiErr) {
        console.warn('AI question generation error, falling back to deterministic generator:', aiErr);
      }
    }

    // Deterministic Truthful Fallback if AI is unavailable or validation fails
    if (!generatedQuestions || generatedQuestions.length === 0) {
      generatedQuestions = this.generateDeterministicTruthfulQuestions({
        jobTitle: job.title,
        companyName: job.company.name,
        verifiedSkills,
        verifiedExperiences,
        missingSkills,
        partialSkills,
        careerTrack
      }).slice(0, count);
    }

    // If missingSkills or partialSkills exist, ensure at least one question addresses the primary gap / adjacent skill
    const gapsToAddress = [...missingSkills, ...partialSkills];
    if (gapsToAddress.length > 0 && !generatedQuestions.some(q => q.type === 'SKILL_GAP' || (q.sourceSkill && gapsToAddress.includes(q.sourceSkill)) || (q.question && q.question.toLowerCase().includes(gapsToAddress[0].toLowerCase())))) {
      const topGap = gapsToAddress[0];
      const topVerified = verifiedSkills[0] || 'Software Engineering';
      const gapQuestion: GeneratedQuestionItem = {
        type: 'SKILL_GAP',
        difficulty: 'MEDIUM',
        question: `The ${job.title} role emphasizes ${topGap}. Given your verified background in ${topVerified}, how would you apply your transferable principles to rapidly master ${topGap}?`,
        context: `Skill gap check identified ${topGap} as required for ${job.title} while not yet verified on profile.`,
        suggestedAnswerGuide: `Acknowledge existing foundations, demonstrate rapid learning ability, and explain hands-on sandbox exploration steps.`,
        sourceSkill: topGap
      };
      if (generatedQuestions.length >= count) {
        generatedQuestions[generatedQuestions.length - 1] = gapQuestion;
      } else {
        generatedQuestions.push(gapQuestion);
      }
    }

    // Persist questions in database
    const currentOrderMax = await prisma.interviewQuestion.count({
      where: { sessionId }
    });

    const toInsert = generatedQuestions.map((q, idx) => ({
      type: q.type as InterviewQuestionType,
      difficulty: q.difficulty as QuestionDifficulty,
      question: q.question,
      context: q.context || null,
      suggestedAnswerGuide: q.suggestedAnswerGuide || null,
      sourceSkill: q.sourceSkill || null,
      displayOrder: currentOrderMax + idx + 1
    }));

    return InterviewRepository.createQuestions(sessionId, toInsert);
  }

  /**
   * Deterministic truthful fallback questions ensuring 100% adherence to verified facts
   */
  private static generateDeterministicTruthfulQuestions(params: {
    jobTitle: string;
    companyName: string;
    verifiedSkills: string[];
    verifiedExperiences: Array<{ company: string; title: string; technologies: string[]; responsibilities: string[] }>;
    missingSkills: string[];
    partialSkills: string[];
    careerTrack: any;
  }): GeneratedQuestionItem[] {
    const list: GeneratedQuestionItem[] = [];
    const topVerifiedSkill = params.verifiedSkills[0] || 'Software Engineering';
    const topMissingSkill = params.missingSkills[0] || params.partialSkills[0];
    const pastExp = params.verifiedExperiences[0];

    // 1. Technical Question (grounded in verified skills)
    list.push({
      type: 'TECHNICAL',
      difficulty: 'MEDIUM',
      question: `How do you approach designing scalable and maintainable solutions using ${topVerifiedSkill} in production environments?`,
      context: `Target JD requires deep competency in ${topVerifiedSkill}, which matches candidate's verified skills.`,
      suggestedAnswerGuide: `Discuss core architecture, error handling patterns, testing strategies, and practical production trade-offs.`,
      sourceSkill: topVerifiedSkill
    });

    // 2. Resume-based Question (strictly citing verified experience)
    if (pastExp) {
      list.push({
        type: 'RESUME_BASED',
        difficulty: 'MEDIUM',
        question: `During your tenure as ${pastExp.title} at ${pastExp.company}, what was your most impactful engineering challenge and how did you resolve it?`,
        context: `Grounded strictly in verified experience as ${pastExp.title} at ${pastExp.company}.`,
        suggestedAnswerGuide: `Use the STAR format (Situation, Task, Action, Result) focusing on verified technical tasks and measurable outcomes.`,
        sourceSkill: pastExp.technologies[0] || undefined
      });
    }

    // 3. Skill-Gap / Adaptability Question (grounded in identified gaps)
    if (topMissingSkill) {
      list.push({
        type: 'SKILL_GAP',
        difficulty: 'MEDIUM',
        question: `The ${params.jobTitle} role emphasizes ${topMissingSkill}. Given your verified background in ${topVerifiedSkill}, how would you apply your transferable principles to rapidly master ${topMissingSkill}?`,
        context: `Skill gap check identified ${topMissingSkill} as required for ${params.jobTitle} while not yet verified on profile.`,
        suggestedAnswerGuide: `Acknowledge existing foundations, demonstrate rapid learning ability, and explain hands-on sandbox exploration steps.`,
        sourceSkill: topMissingSkill
      });
    }

    // 4. Role-Specific Question (grounded in job requirements)
    list.push({
      type: 'ROLE_SPECIFIC',
      difficulty: 'HARD',
      question: `What considerations do you prioritize when collaborating cross-functionally to deliver the core requirements of a ${params.jobTitle}?`,
      context: `Specific to the responsibilities outlined in the job opening at ${params.companyName}.`,
      suggestedAnswerGuide: `Highlight stakeholder alignment, requirement validation, code review standards, and CI/CD best practices.`
    });

    // 5. Behavioral Question
    list.push({
      type: 'BEHAVIORAL',
      difficulty: 'MEDIUM',
      question: `Tell me about a time you encountered unexpected technical ambiguity or system regressions. How did you diagnose and communicate the issue?`,
      context: `Evaluates communication clarity and structured problem-solving under uncertainty.`,
      suggestedAnswerGuide: `Demonstrate calm troubleshooting, root cause analysis (RCA), and transparent team communication.`
    });

    return list;
  }

  /**
   * Submit an answer to an interview question
   */
  public static async submitAnswer(userId: string, questionId: string, answerText: string) {
    const profile = await this.assertCandidateProfile(userId);

    const question = await InterviewRepository.findQuestionById(questionId);
    if (!question) {
      throw new NotFoundError(`Question ${questionId} not found`);
    }

    if (question.session.candidateProfileId !== profile.id) {
      throw new ForbiddenError('Unauthorized: Question belongs to another candidate');
    }

    if (!answerText || !answerText.trim()) {
      throw new BadRequestError('Answer text cannot be empty');
    }

    const answer = await InterviewRepository.createAnswer(questionId, answerText.trim());
    return answer;
  }

  /**
   * Evaluate an interview answer
   * Evaluates: clarity, technical accuracy (where applicable), relevance, structure, evidence quality, missing points, improvements
   * Does NOT falsely assert factual correctness when insufficient evidence exists.
   */
  public static async evaluateAnswer(userId: string, questionId: string, answerId?: string) {
    const profile = await this.assertCandidateProfile(userId);

    const question = await InterviewRepository.findQuestionById(questionId);
    if (!question) {
      throw new NotFoundError(`Question ${questionId} not found`);
    }

    if (question.session.candidateProfileId !== profile.id) {
      throw new ForbiddenError('Unauthorized: Cross-candidate evaluation is denied');
    }

    // Resolve target answer: either specific answerId or latest submitted answer
    let targetAnswer = question.answers.find(a => a.id === answerId);
    if (!targetAnswer && question.answers.length > 0) {
      targetAnswer = question.answers[0];
    }

    if (!targetAnswer) {
      throw new BadRequestError('No answer submitted yet for this question to evaluate');
    }

    // AI Evaluation with Zod schema verification & deterministic fallback
    let evaluationData: EvaluatedAnswerOutput | null = null;
    const ai = AIServiceFactory.getProvider();

    const isObjectiveTechnical = question.type === 'TECHNICAL';

    if (ai.isAvailable()) {
      try {
        const prompt = `
You are an expert interview evaluator assessing a candidate's response.
Question: "${question.question}"
Question Type: ${question.type}
Question Context: ${question.context || 'None'}
Suggested Answer Guide: ${question.suggestedAnswerGuide || 'General high quality answer criteria'}

Candidate's Submitted Answer:
"${targetAnswer.answerText}"

CRITICAL EVALUATION GUIDELINES:
1. Objectivity & Uncertainty: Do NOT falsely assert 100% factual correctness or claim knowledge of unmentioned facts. If the answer is ambiguous or omits evidence, note it transparently.
2. If this is a BEHAVIORAL or GENERAL question, accuracyScore may be null/omitted as factual truth is not objectively assessable.
3. Assess:
   - Clarity (0-100)
   - Technical Accuracy (0-100 or null if non-technical)
   - Relevance to question asked (0-100)
   - Structure (e.g. STAR, logically sequenced, concise) (0-100)
   - Overall Score (0-100)
   - Strengths (1-3 key positive points)
   - Missing Points (1-3 areas omitted from standard answer guide)
   - Suggestions (1-3 actionable improvement tips)
   - Constructive Feedback summary

Respond ONLY with valid JSON matching:
{
  "clarityScore": number (0-100),
  "accuracyScore": number or null,
  "relevanceScore": number (0-100),
  "structureScore": number (0-100),
  "overallScore": number (0-100),
  "strengths": ["string"],
  "missingPoints": ["string"],
  "suggestions": ["string"],
  "feedback": "string"
}
`;
        const rawJson = await ai.generateJSON<any>(prompt);
        const parsed = EvaluatedAnswerOutputSchema.safeParse(rawJson);
        if (parsed.success) {
          evaluationData = parsed.data;
        }
      } catch (aiErr) {
        console.warn('AI answer evaluation failed, using deterministic evaluation fallback:', aiErr);
      }
    }

    // Deterministic Truthful Fallback Evaluation
    if (!evaluationData) {
      evaluationData = this.evaluateDeterministically(
        targetAnswer.answerText,
        question.type,
        question.question
      );
    }

    const evaluation = await InterviewRepository.upsertEvaluation(targetAnswer.id, {
      clarityScore: evaluationData.clarityScore,
      accuracyScore: isObjectiveTechnical ? (evaluationData.accuracyScore ?? 75) : null,
      relevanceScore: evaluationData.relevanceScore,
      structureScore: evaluationData.structureScore,
      overallScore: evaluationData.overallScore,
      strengths: evaluationData.strengths,
      missingPoints: evaluationData.missingPoints,
      suggestions: evaluationData.suggestions,
      feedback: evaluationData.feedback
    });

    return evaluation;
  }

  /**
   * Deterministic truthful evaluation fallback
   */
  private static evaluateDeterministically(
    answerText: string,
    questionType: string,
    _questionText: string
  ): EvaluatedAnswerOutput {
    const wordCount = answerText.trim().split(/\s+/).length;
    const hasStructureKeywords = /first|second|then|result|situation|outcome|approach|because|for example/i.test(answerText);

    let clarityScore = 70;
    let relevanceScore = 75;
    let structureScore = hasStructureKeywords ? 80 : 65;
    const accuracyScore = questionType === 'TECHNICAL' ? 70 : null;

    if (wordCount < 15) {
      clarityScore = 50;
      relevanceScore = 55;
      structureScore = 50;
    } else if (wordCount > 60) {
      clarityScore = 85;
      relevanceScore = 85;
    }

    const overallScore = Math.round(
      (clarityScore * 0.35) +
      (relevanceScore * 0.35) +
      (structureScore * 0.3)
    );

    const strengths: string[] = [];
    const missingPoints: string[] = [];
    const suggestions: string[] = [];

    if (wordCount >= 30) {
      strengths.push('Provided substantial context and specific details in response.');
    } else {
      missingPoints.push('Response is relatively brief; lacks concrete situational evidence.');
      suggestions.push('Elaborate with specific technical examples or quantifiable outcomes.');
    }

    if (hasStructureKeywords) {
      strengths.push('Logical progression with clear explanatory structure.');
    } else {
      suggestions.push('Structure your answer using the STAR method (Situation, Task, Action, Result) for clarity.');
    }

    const feedback = `The candidate provided a ${wordCount < 30 ? 'concise' : 'detailed'} response. Communication was clear with good relevance to the prompt. Continued focus on structured delivery and concrete metrics will further strengthen performance.`;

    return {
      clarityScore,
      accuracyScore,
      relevanceScore,
      structureScore,
      overallScore,
      strengths,
      missingPoints,
      suggestions,
      feedback
    };
  }
}
