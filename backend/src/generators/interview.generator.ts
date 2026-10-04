import {
  CandidateProfile,
  JobDescription,
  InterviewPreparation,
  TailoredResume
} from '../types/index.js';
import { AIServiceFactory } from '../ai/index.js';

export class InterviewPrepService {
  public static async generatePreparation(
    candidate: CandidateProfile,
    job: JobDescription,
    tailoredResume?: TailoredResume
  ): Promise<InterviewPreparation> {
    const ai = AIServiceFactory.getProvider();

    if (ai.isAvailable()) {
      try {
        const schema = `{
          "technicalTopics": ["Topic 1", "Topic 2", "Topic 3"],
          "technicalQuestions": [
            {"question": "Q?", "answerGuidance": "How to answer...", "difficulty": "Medium"}
          ],
          "resumeQuestions": [
            {"question": "Q?", "basedOn": "Resume item", "answerGuidance": "Guidance..."}
          ],
          "hrQuestions": [
            {"question": "Q?", "purpose": "Intent", "sampleOutline": "Outline..."}
          ],
          "roleSpecificQuestions": [
            {"scenario": "Scenario description", "keyCheckpoints": ["Point 1", "Point 2"]}
          ],
          "preparationAreas": ["Area 1", "Area 2"]
        }`;

        const prompt = `
Generate a comprehensive interview preparation pack for:
Role: ${job.role} at ${job.company}
Candidate: ${candidate.name} (${candidate.yearsOfExperience} yrs exp)
Skills: ${candidate.primarySkills.join(', ')}
JD Requirements: ${job.mustHaveSkills.join(', ')}
${tailoredResume ? 'Tailored Resume Summary: ' + tailoredResume.tailoredSummary : ''}
`;
        const result = await ai.generateJSON<Partial<InterviewPreparation>>(prompt, schema);

        return {
          id: `prep-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          candidateId: candidate.id,
          jobId: job.id,
          resumeVersionId: tailoredResume?.id,
          role: job.role,
          company: job.company,
          technicalTopics: result.technicalTopics || [],
          technicalQuestions: result.technicalQuestions || [],
          resumeQuestions: result.resumeQuestions || [],
          hrQuestions: result.hrQuestions || [],
          roleSpecificQuestions: result.roleSpecificQuestions || [],
          preparationAreas: result.preparationAreas || [],
          createdAt: new Date().toISOString()
        };
      } catch (err) {
        console.warn('AI Interview prep failed, falling back to rule-based generator:', err);
      }
    }

    // High quality deterministic fallback generator
    const topics = Array.from(new Set([...job.mustHaveSkills, ...candidate.primarySkills])).slice(0, 5);

    const technicalQuestions = topics.map((topic, idx) => ({
      question: `How have you designed and architected scalable solutions using ${topic} in production environments?`,
      answerGuidance: `Structure your answer with the STAR methodology (Situation, Task, Action, Result). Highlight specific metrics, latency improvements, or test coverage outcomes achieved with ${topic}.`,
      difficulty: (idx % 2 === 0 ? 'Medium' : 'Hard') as 'Easy' | 'Medium' | 'Hard'
    }));

    const resumeQuestions = (candidate.experiences[0]?.highlights || [
      'Led cross-functional testing automation initiatives'
    ]).slice(0, 3).map((hl, i) => ({
      question: `You mentioned in your resume: "${hl.slice(0, 90)}...". What were the primary engineering trade-offs you navigated?`,
      basedOn: `Past Experience at ${candidate.experiences[0]?.company || 'Previous Organization'}`,
      answerGuidance: `Clarify the technical context, how you evaluated alternatives, and how you ensured stability without causing regressions.`
    }));

    const hrQuestions = [
      {
        question: `Why are you interested in joining ${job.company} as a ${job.role}?`,
        purpose: 'Assessing genuine company research and intrinsic motivation.',
        sampleOutline: `1. Acknowledge ${job.company}'s market impact.\n2. Connect their current tech challenge with your skills.\n3. Reiterate your enthusiasm for long-term career growth.`
      },
      {
        question: `Tell me about a time when production requirements shifted unexpectedly close to release.`,
        purpose: 'Evaluating adaptability and calm execution under pressure.',
        sampleOutline: `Focus on rapid triage, transparent stakeholder communication, and maintaining software quality.`
      }
    ];

    const roleSpecificQuestions = [
      {
        scenario: `A critical regression fails in CI/CD pipeline 1 hour prior to a scheduled deployment for ${job.role}.`,
        keyCheckpoints: [
          'Immediate rollback or feature-flag disablement to protect main branch',
          'Root cause isolation using logs and localized regression tests',
          'Transparent stakeholder communication and blameless post-mortem'
        ]
      }
    ];

    return {
      id: `prep-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      candidateId: candidate.id,
      jobId: job.id,
      resumeVersionId: tailoredResume?.id,
      role: job.role,
      company: job.company,
      technicalTopics: topics,
      technicalQuestions,
      resumeQuestions,
      hrQuestions,
      roleSpecificQuestions,
      preparationAreas: [
        `Deep dive into ${topics.slice(0, 2).join(' & ')} core architecture and edge cases`,
        `Review past system design trade-offs at ${candidate.companies[0] || 'previous employer'}`,
        `Practice concise STAR-format behavioral responses for ${job.company}`
      ],
      createdAt: new Date().toISOString()
    };
  }
}
