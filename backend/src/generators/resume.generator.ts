import {
  CandidateProfile,
  JobDescription,
  TailoredResume,
  TruthCheckResult
} from '../types/index.js';
import { AIServiceFactory } from '../ai/index.js';

export class ResumeTailorService {
  public static async tailorResume(
    candidate: CandidateProfile,
    job: JobDescription,
    truthCheck: TruthCheckResult,
    existingVersionCount = 0
  ): Promise<TailoredResume> {
    const cleanCompany = job.company.replace(/[^a-zA-Z0-9]/g, '');
    const cleanRole = job.role.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8);
    const versionName = `${cleanCompany}_${cleanRole}_v${existingVersionCount + 1}`;

    // Filter skills: STRICT TRUTH CHECK. Never invent RED skills.
    // Order skills placing matched job skills first
    const greenAndYellow = truthCheck.items
      .filter(i => i.status === 'GREEN' || i.status === 'YELLOW')
      .map(i => i.requirement);

    const orderedSkills: string[] = [
      ...greenAndYellow,
      ...candidate.primarySkills.filter(s => !greenAndYellow.includes(s)),
      ...candidate.technologies.filter(s => !greenAndYellow.includes(s))
    ].slice(0, 15);

    // AI or heuristic summary tailoring
    const ai = AIServiceFactory.getProvider();
    let tailoredSummary = '';

    if (ai.isAvailable()) {
      try {
        const prompt = `
You are an expert technical resume writer.
Tailor this professional summary for the role of "${job.role}" at "${job.company}".
STRICT CONSTRAINT: DO NOT FABRICATE EXPERIENCE OR SKILLS. Only use the candidate's verified skills (${candidate.primarySkills.join(', ')}).
Original Summary:
${candidate.summary}

Candidate Experience: ${candidate.yearsOfExperience} years.
Key matching keywords: ${greenAndYellow.join(', ')}.

Write a high-impact 3-sentence summary emphasizing the relevant strengths for this job.
`;
        tailoredSummary = await ai.generateText(prompt);
      } catch (err) {
        console.warn('AI Resume Summary tailoring fallback:', err);
      }
    }

    if (!tailoredSummary) {
      tailoredSummary = `Results-driven ${candidate.targetRoles[0] || 'Software Professional'} with ${candidate.yearsOfExperience}+ years of proven engineering experience specializing in ${greenAndYellow.slice(0, 4).join(', ')}. Adept at designing robust solutions, driving cross-team collaboration, and delivering resilient software systems tailored for ${job.company}'s engineering initiatives.`;
    }

    // Reorder experience bullet highlights to emphasize matched technologies first
    const tailoredExperiences = candidate.experiences.map(exp => {
      const sortedHighlights = [...exp.highlights].sort((a, b) => {
        const aMatches = greenAndYellow.filter(k => a.toLowerCase().includes(k.toLowerCase())).length;
        const bMatches = greenAndYellow.filter(k => b.toLowerCase().includes(k.toLowerCase())).length;
        return bMatches - aMatches;
      });

      return {
        ...exp,
        highlights: sortedHighlights
      };
    });

    // Reorder projects to prioritize relevant tech
    const tailoredProjects = [...candidate.projects].sort((a, b) => {
      const aMatches = a.technologies.filter(t => greenAndYellow.some(gy => gy.toLowerCase() === t.toLowerCase())).length;
      const bMatches = b.technologies.filter(t => greenAndYellow.some(gy => gy.toLowerCase() === t.toLowerCase())).length;
      return bMatches - aMatches;
    });

    const modifications = [
      {
        section: 'Professional Summary',
        original: candidate.summary || 'General software engineer profile summary.',
        tailored: tailoredSummary,
        reason: `Rephrased to target ${job.role} requirements and emphasize verified competencies in ${greenAndYellow.slice(0, 3).join(', ')}.`
      },
      {
        section: 'Skills Hierarchy',
        original: candidate.primarySkills.join(', '),
        tailored: orderedSkills.slice(0, 8).join(', '),
        reason: 'Restructured technical stack to spotlight priority job keywords first while maintaining 100% truthful profile verification.'
      },
      {
        section: 'Experience Bullet Priority',
        original: 'Chronological responsibility ordering.',
        tailored: 'Job-relevant metric and tool prioritization.',
        reason: 'Surfaced bullet points containing matching keywords higher within each position for rapid recruiter scanning.'
      }
    ];

    return {
      id: `resume-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      versionName,
      candidateId: candidate.id,
      jobId: job.id,
      targetRole: job.role,
      targetCompany: job.company,
      tailoredSummary: tailoredSummary.trim(),
      orderedSkills,
      experiences: tailoredExperiences,
      projects: tailoredProjects,
      modifications,
      truthCheckVerified: true,
      createdAt: new Date().toISOString()
    };
  }
}
