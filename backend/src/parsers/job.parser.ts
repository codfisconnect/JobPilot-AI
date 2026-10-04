import { JobDescription } from '../types/index.js';
import { AIServiceFactory } from '../ai/index.js';

export class JobParserService {
  public static async parseJobText(
    rawText: string,
    sourceType: 'pasted' | 'url' | 'extension' | 'sample' = 'pasted',
    sourceUrl?: string
  ): Promise<JobDescription> {
    const ai = AIServiceFactory.getProvider();

    if (ai.isAvailable()) {
      try {
        const schema = `{
          "role": "Job Title",
          "company": "Company Name",
          "location": "Job Location",
          "experienceRequired": "e.g. 4-6 years",
          "salary": "e.g. $120k or Competitive",
          "careerTrack": "QA Automation | Java Backend | Full Stack | Data Analytics | DevOps",
          "mustHaveSkills": ["Skill 1", "Skill 2"],
          "niceToHaveSkills": ["Skill 3"],
          "responsibilities": ["Responsibility 1", "Responsibility 2"],
          "qualifications": ["Qualification 1", "Qualification 2"]
        }`;

        const parsed = await ai.generateJSON<Partial<JobDescription>>(
          `Analyze this job description text and extract structured job requirements. Return valid JSON without markdown:\n\n${rawText.slice(0, 8000)}`,
          schema
        );

        return {
          id: `job-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          role: parsed.role || 'Software Engineer',
          company: parsed.company || 'Tech Company',
          location: parsed.location || 'Remote / Hybrid',
          sourceUrl: sourceUrl || '',
          sourceType,
          experienceRequired: parsed.experienceRequired || '3+ years',
          salary: parsed.salary || 'Competitive',
          careerTrack: parsed.careerTrack || 'Software Engineering',
          mustHaveSkills: parsed.mustHaveSkills || [],
          niceToHaveSkills: parsed.niceToHaveSkills || [],
          responsibilities: parsed.responsibilities || [],
          qualifications: parsed.qualifications || [],
          rawText,
          createdAt: new Date().toISOString()
        };
      } catch (err) {
        console.warn('AI Job Parsing failed, falling back to rule-based parser:', err);
      }
    }

    return this.ruleBasedParse(rawText, sourceType, sourceUrl);
  }

  public static ruleBasedParse(
    rawText: string,
    sourceType: 'pasted' | 'url' | 'extension' | 'sample',
    sourceUrl?: string
  ): JobDescription {
    const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
    const textLower = rawText.toLowerCase();

    // Role & Company heuristic
    let role = 'Software Engineer';
    let company = 'Target Employer';
    let location = 'Hybrid / Bangalore';

    if (textLower.includes('qa automation') || textLower.includes('automation engineer')) {
      role = 'Senior QA Automation Engineer';
    } else if (textLower.includes('sdet')) {
      role = 'SDET (Software Development Engineer in Test)';
    } else if (textLower.includes('backend') || textLower.includes('spring boot')) {
      role = 'Senior Java Backend Engineer';
    } else if (textLower.includes('full stack')) {
      role = 'Full Stack Engineer';
    } else if (textLower.includes('data analyst')) {
      role = 'Senior Data Analyst';
    } else if (lines.length > 0) {
      role = lines[0].substring(0, 60);
    }

    // Company extraction
    for (const line of lines.slice(0, 5)) {
      if (line.toLowerCase().includes('company:') || line.toLowerCase().includes('at ')) {
        const parts = line.split(/:|at /i);
        if (parts[1]) company = parts[1].trim();
      }
    }

    // Career track
    let careerTrack = 'General Software Engineering';
    if (/qa|automation|test|sdet/i.test(role)) careerTrack = 'QA Automation';
    else if (/backend|java|spring/i.test(role)) careerTrack = 'Java Backend';
    else if (/full stack|react|frontend/i.test(role)) careerTrack = 'Full Stack';
    else if (/data|analytics|power bi|bi/i.test(role)) careerTrack = 'Data Analytics';

    // Skill extraction
    const catalog = [
      'Java', 'Selenium', 'Playwright', 'TestNG', 'JUnit', 'API Testing', 'RestAssured', 'Postman',
      'Jenkins', 'CI/CD', 'Git', 'SQL', 'Docker', 'Kubernetes', 'Cucumber', 'BDD', 'Spring Boot',
      'Microservices', 'Kafka', 'PostgreSQL', 'React', 'Node.js', 'TypeScript', 'Power BI', 'Tableau', 'Python'
    ];

    const mustHaveSkills: string[] = [];
    const niceToHaveSkills: string[] = [];

    catalog.forEach(skill => {
      const regex = new RegExp(`\\b${skill.replace('+', '\\+').replace('.', '\\.')}\\b`, 'i');
      if (regex.test(rawText)) {
        if (mustHaveSkills.length < 5) mustHaveSkills.push(skill);
        else niceToHaveSkills.push(skill);
      }
    });

    if (mustHaveSkills.length === 0) {
      mustHaveSkills.push('Problem Solving', 'Communication', 'Software Development');
    }

    return {
      id: `job-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      role,
      company,
      location,
      sourceUrl: sourceUrl || '',
      sourceType,
      experienceRequired: '4-6 years',
      salary: 'Competitive Market Rate',
      careerTrack,
      mustHaveSkills,
      niceToHaveSkills,
      responsibilities: [
        'Design and implement high-quality solutions aligned with business standards.',
        'Collaborate across cross-functional engineering teams for agile delivery.',
        'Maintain test coverage, code quality, and continuous integration workflows.'
      ],
      qualifications: [
        'Bachelor’s or Master’s degree in Computer Science, Engineering or equivalent.',
        'Demonstrated hands-on experience in core toolsets and architecture patterns.'
      ],
      rawText,
      createdAt: new Date().toISOString()
    };
  }
}
