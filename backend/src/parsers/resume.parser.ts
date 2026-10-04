import { CandidateProfile, ExperienceItem } from '../types/index.js';
import { AIServiceFactory } from '../ai/index.js';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

export class ResumeParserService {
  public static async extractTextFromFile(buffer: Buffer, mimetype: string): Promise<string> {
    if (mimetype === 'application/pdf' || mimetype.includes('pdf')) {
      const data = await pdfParse(buffer);
      return data.text;
    } else if (
      mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mimetype.includes('word') ||
      mimetype.includes('docx')
    ) {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    } else {
      // Plain text or fallback
      return buffer.toString('utf-8');
    }
  }

  public static async parseResumeText(rawText: string): Promise<Partial<CandidateProfile>> {
    const ai = AIServiceFactory.getProvider();

    if (ai.isAvailable()) {
      try {
        const schema = `{
          "name": "Full Name",
          "email": "email address",
          "phone": "phone number",
          "location": "City, Country",
          "targetRoles": ["Role 1", "Role 2"],
          "yearsOfExperience": 5.5,
          "summary": "Professional summary...",
          "primarySkills": ["Skill 1", "Skill 2"],
          "secondarySkills": ["Skill 3", "Skill 4"],
          "technologies": ["Tech 1", "Tech 2"],
          "companies": ["Company 1", "Company 2"],
          "education": [{"id": "edu-1", "degree": "Degree", "institution": "University", "year": "2020"}],
          "certifications": ["Cert 1"],
          "projects": [{"id": "proj-1", "name": "Project Name", "description": "Details", "technologies": ["Tech"]}]
        }`;

        const parsed = await ai.generateJSON<Partial<CandidateProfile>>(
          `Analyze this resume text and extract structured profile data. Never fabricate data that does not exist in the text.\n\nResume Text:\n${rawText.slice(0, 8000)}`,
          schema
        );
        return parsed;
      } catch (err) {
        console.warn('AI Parsing failed, falling back to rule-based parser:', err);
      }
    }

    // High quality deterministic rule-based parsing fallback
    return this.ruleBasedParse(rawText);
  }

  public static ruleBasedParse(rawText: string): Partial<CandidateProfile> {
    const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
    const textLower = rawText.toLowerCase();

    // Name (usually first line or near top)
    const name = lines[0] || 'Candidate';

    // Email
    const emailMatch = rawText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    const email = emailMatch ? emailMatch[0] : '';

    // Phone
    const phoneMatch = rawText.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
    const phone = phoneMatch ? phoneMatch[0] : '';

    // Common skills catalog to scan
    const techCatalog = [
      'Java', 'Python', 'JavaScript', 'TypeScript', 'C++', 'C#', 'Go', 'Rust',
      'Selenium', 'Playwright', 'Cypress', 'Appium', 'Postman', 'RestAssured', 'JUnit', 'TestNG', 'Cucumber',
      'React', 'Next.js', 'Vue', 'Angular', 'Node.js', 'Express', 'Spring Boot', 'Django', 'FastAPI',
      'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Elasticsearch', 'SQLite',
      'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'Jenkins', 'Git', 'GitHub Actions', 'CI/CD', 'Kafka',
      'Power BI', 'Tableau', 'Excel', 'Pandas', 'NumPy', 'Airflow', 'Snowflake', 'Scrum', 'Agile'
    ];

    const detectedTech = techCatalog.filter(tech => {
      const regex = new RegExp(`\\b${tech.replace('+', '\\+').replace('.', '\\.')}\\b`, 'i');
      return regex.test(rawText);
    });

    // Estimate experience
    let years = 3.0;
    const expMatch = rawText.match(/(\d+(?:\.\d+)?)\+?\s*(?:years|yrs)/i);
    if (expMatch) {
      years = parseFloat(expMatch[1]);
    }

    // Target roles detection
    const targetRoles: string[] = [];
    if (textLower.includes('qa') || textLower.includes('automation') || textLower.includes('sdet') || textLower.includes('test')) {
      targetRoles.push('QA Automation Engineer', 'SDET');
    }
    if (textLower.includes('backend') || textLower.includes('spring boot') || textLower.includes('java developer')) {
      targetRoles.push('Java Backend Developer', 'Software Engineer');
    }
    if (textLower.includes('full stack') || (textLower.includes('react') && textLower.includes('node'))) {
      targetRoles.push('Full Stack Developer');
    }
    if (textLower.includes('data analyst') || textLower.includes('power bi') || textLower.includes('analytics')) {
      targetRoles.push('Data Analyst', 'BI Developer');
    }
    if (targetRoles.length === 0) targetRoles.push('Software Engineer');

    return {
      name,
      email,
      phone,
      location: 'Bangalore, India',
      targetRoles,
      yearsOfExperience: years,
      primarySkills: detectedTech.slice(0, 6),
      secondarySkills: detectedTech.slice(6, 12),
      technologies: detectedTech,
      companies: [],
      summary: lines.slice(1, 4).join(' '),
      education: [],
      certifications: [],
      projects: []
    };
  }
}
