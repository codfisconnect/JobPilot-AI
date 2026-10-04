import {
  CandidateProfile,
  JobDescription,
  SmartResumeStrategy,
  ResumeMode,
  TruthCheckResult
} from '../types/index.js';

export class ResumeStrategyEngine {
  /**
   * Determine the optimal resume presentation strategy based on candidate fit and JD alignment.
   */
  public static evaluateStrategy(
    candidate: CandidateProfile,
    job: JobDescription,
    truthCheck: TruthCheckResult,
    isSameTrack: boolean
  ): SmartResumeStrategy {
    const verifiedSkills = truthCheck.items.filter(i => i.status === 'GREEN').map(i => i.requirement);
    const transferableSkills = truthCheck.items.filter(i => i.status === 'YELLOW').map(i => i.requirement);
    const redGaps = truthCheck.items.filter(i => i.status === 'RED').map(i => i.requirement);

    // Determine Mode
    let mode: ResumeMode = 'FOCUSED';
    let whyMode = '';

    if (isSameTrack && truthCheck.greenCount >= 4) {
      mode = 'TARGETED';
      whyMode = `Direct career track alignment (${candidate.targetRoles[0]} → ${job.role}) with strong verified technical foundation. Target role demands sharp prioritization of matching skills.`;
    } else if (!isSameTrack) {
      mode = 'FOCUSED';
      whyMode = `Cross-domain transition to ${job.careerTrack}. Emphasizes verified transferable architecture and execution competencies while honestly addressing domain gaps.`;
    } else {
      mode = 'FULL';
      whyMode = `Broad generalist positioning. Presents balanced comprehensive career progression with contextual highlights across all past employers.`;
    }

    const whatToEmphasize = [
      `Promote verified technical skills: ${verifiedSkills.slice(0, 5).join(', ') || 'Core engineering competencies'}`,
      `Elevate metrics and achievements aligned with ${job.role}`,
      `Position ${candidate.yearsOfExperience}+ years of overall experience at top of profile`
    ];

    const whatToCompress = [
      'Older non-target responsibilities condensed into brief milestone lines',
      'Irrelevant tools not requested by the target JD summarized succinctly'
    ];

    const whatToDeemphasize = [
      'Outdated legacy tools and non-essential frameworks'
    ];

    const transferableCapabilities = transferableSkills.map(s => {
      const related = candidate.primarySkills.find(ps => ps.toLowerCase().includes(s.toLowerCase())) || 'Engineering Foundation';
      return {
        capability: related,
        transferableTo: s,
        rationale: `Strong hands-on background in ${related} allows rapid ramp-up in ${s} without falsifying experience.`
      };
    });

    const truthWarnings = redGaps.map(g =>
      `JD requires ${g}, but profile lacks verified record. Strict Anti-Fabrication Rule: ${g} will NOT be injected into the resume.`
    );

    return {
      mode,
      targetRole: job.role,
      targetCompany: job.company,
      whyMode,
      whatToEmphasize,
      whatToCompress,
      whatToDeemphasize,
      transferableCapabilities,
      genuineSkillGaps: redGaps,
      truthWarnings,
      candidateApproved: true
    };
  }
}
