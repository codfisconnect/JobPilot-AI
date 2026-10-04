import { SkillGapItem, JobDescription, CandidateProfile } from '../types/index.js';

export class SkillGapEngine {
  /**
   * Analyze accumulated skill gaps across jobs and current candidate profile.
   */
  public static calculateGaps(candidate: CandidateProfile, jobs: JobDescription[]): SkillGapItem[] {
    const candSkills = new Set(
      [
        ...candidate.primarySkills,
        ...candidate.secondarySkills,
        ...candidate.technologies
      ].map(s => s.toLowerCase().trim())
    );

    const skillCounts: Record<string, { count: number; canonicalName: string }> = {};

    for (const job of jobs) {
      for (const skill of job.mustHaveSkills) {
        const lower = skill.toLowerCase().trim();
        if (!skillCounts[lower]) {
          skillCounts[lower] = { count: 1, canonicalName: skill };
        } else {
          skillCounts[lower].count++;
        }
      }
    }

    const gapItems: SkillGapItem[] = [];
    let sequence = 1;

    for (const [lower, data] of Object.entries(skillCounts)) {
      const isVerified = candSkills.has(lower);
      const isPartial = Array.from(candSkills).some(cs => cs.includes(lower) || lower.includes(cs));

      let status: 'VERIFIED' | 'PARTIAL' | 'TRANSFERABLE' | 'MISSING' = 'MISSING';
      let priority: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
      let reason = '';

      if (isVerified) {
        status = 'VERIFIED';
        priority = 'LOW';
        reason = 'Already verified in candidate master profile.';
      } else if (isPartial) {
        status = 'PARTIAL';
        priority = data.count >= 2 ? 'HIGH' : 'MEDIUM';
        reason = `Adjacent skills verified. Appears in ${data.count} target opportunities.`;
      } else {
        status = 'MISSING';
        priority = data.count >= 3 ? 'HIGH' : data.count >= 2 ? 'MEDIUM' : 'LOW';
        reason = `High industry demand in ${data.count} analyzed jobs. Core prerequisite for career advancement.`;
      }

      gapItems.push({
        skill: data.canonicalName,
        status,
        priority,
        frequencyInTargetJobs: data.count,
        importanceInTargetRole: data.count >= 2 ? 'Critical' : 'Beneficial',
        candidateStatus: isVerified ? 'Verified' : isPartial ? 'Adjacent / Familiar' : 'Not Found',
        reason,
        learningSequence: sequence++
      });
    }

    // Sort: Missing & Partial first, then by frequency descending
    return gapItems.sort((a, b) => {
      if (a.status === 'VERIFIED' && b.status !== 'VERIFIED') return 1;
      if (b.status === 'VERIFIED' && a.status !== 'VERIFIED') return -1;
      return b.frequencyInTargetJobs - a.frequencyInTargetJobs;
    });
  }
}
