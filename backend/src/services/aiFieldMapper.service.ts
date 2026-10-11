import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { DiscoveredFieldMapping } from './fieldMapper.service.js';

export class AiFieldMapperService {
  /**
   * Infer mapping using Google Gemini AI only as fallback when deterministic confidence is low
   * or ambiguous. Never fabricates values; strictly returns key names from sample keys.
   */
  public static async inferMappingWithAi(sampleJob: any): Promise<Partial<DiscoveredFieldMapping>> {
    if (!env.GEMINI_API_KEY) {
      logger.info('[AiFieldMapperService] No GEMINI_API_KEY configured, skipping AI mapping layer.');
      return {};
    }

    try {
      const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

      const prompt = `
You are an expert ATS and Job Board schema mapping assistant.
Analyze this sample job record JSON and map its keys to our standard schema.

IMPORTANT CONSTRAINTS:
1. ONLY return keys that literally exist in the sample JSON. If a field does not exist, return null.
2. DO NOT invent or fabricate any field values.
3. Return ONLY valid JSON with no markdown formatting.

Standard fields to map:
- externalJobIdField: unique job identifier, code, or slug (e.g., "job_code", "id")
- titleField: job title
- departmentField: department/team
- locationField: location/city/country
- workModeField: remote/hybrid/onsite indicator
- employmentTypeField: full-time, contract, etc.
- experienceField: experience requirement
- salaryField: salary or compensation
- qualificationField: degree/education requirements
- summaryField: short summary or teaser
- descriptionField: main job description or details
- responsibilitiesField: duties/responsibilities
- requirementsField: qualifications/requirements
- skillsField: core or technical skills
- preferredSkillsField: nice-to-have or preferred skills
- applicationUrlField: URL to apply
- postedAtField: published or created date
- deadlineField: application deadline
- activeField: boolean or status indicator for active job

Sample JSON:
${JSON.stringify(sampleJob, null, 2)}
`;

      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);

      logger.info('[AiFieldMapperService] Successfully received AI-assisted field mapping');
      return parsed;
    } catch (err: any) {
      logger.warn(`[AiFieldMapperService] AI field mapping fallback failed: ${err.message}`);
      return {};
    }
  }
}
