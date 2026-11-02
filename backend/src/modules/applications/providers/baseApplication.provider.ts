import { ApplicationExecutionContext, FieldMappingResult } from './applicationProvider.interface.js';
import { MissingFieldPrompt } from '../orchestrator/orchestrator.types.js';

export abstract class BaseApplicationProvider {
  /**
   * Extract verified candidate facts strictly without fabrication
   */
  protected extractVerifiedCandidateData(context: ApplicationExecutionContext): Record<string, any> {
    const { candidate, candidateResponses } = context;
    if (!candidate) return {};

    const fullName = candidate.fullName || '';
    const nameParts = fullName.trim().split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : firstName;

    const email = candidate.email || candidate.user?.email || '';
    const phone = candidate.phone || '';
    const location = candidate.location || candidate.city || '';
    const linkedin = candidate.linkedinUrl || '';
    const github = candidate.githubUrl || '';
    const portfolio = candidate.portfolioUrl || '';

    // Calculate experience from verified work history
    let yearsOfExperience = 0;
    if (Array.isArray(candidate.experiences) && candidate.experiences.length > 0) {
      let totalMonths = 0;
      for (const exp of candidate.experiences) {
        const start = new Date(exp.startDate);
        const end = exp.endDate ? new Date(exp.endDate) : new Date();
        const months = Math.max(1, (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()));
        totalMonths += months;
      }
      yearsOfExperience = Math.round(totalMonths / 12);
    }

    // Verified skills list
    const skills = Array.isArray(candidate.skills)
      ? candidate.skills.map((s: any) => s.skill?.name || s.name).filter(Boolean)
      : [];

    // Highest education
    const highestEducation = Array.isArray(candidate.educations) && candidate.educations.length > 0
      ? candidate.educations[0].degree || candidate.educations[0].institution
      : '';

    // Work authorization and preferences
    const willingToRelocate = candidate.preferences?.willingToRelocate ?? false;
    const preferredLocations = candidate.preferences?.preferredLocations || [];

    return {
      fullName,
      firstName,
      lastName,
      email,
      phone,
      location,
      linkedin,
      github,
      portfolio,
      yearsOfExperience,
      skills,
      highestEducation,
      willingToRelocate,
      preferredLocations,
      ...candidateResponses // Merged answers supplied by candidate for missing fields
    };
  }

  /**
   * Check if standard mandatory fields are missing from verified profile
   */
  protected detectMissingMandatoryFields(
    verifiedData: Record<string, any>,
    requiredKeys: Array<{ key: string; label: string; fieldType?: 'text' | 'number' | 'boolean' | 'select' }>
  ): MissingFieldPrompt[] {
    const missing: MissingFieldPrompt[] = [];

    for (const req of requiredKeys) {
      const val = verifiedData[req.key];
      if (val === undefined || val === null || (typeof val === 'string' && val.trim() === '')) {
        missing.push({
          fieldKey: req.key,
          label: req.label,
          required: true,
          fieldType: req.fieldType || 'text',
          description: `${req.label} is required for this employer application.`
        });
      }
    }

    return missing;
  }
}
