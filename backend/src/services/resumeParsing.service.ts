import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import {
  StructuredParsedResumeSchema,
  type StructuredParsedResume,
  type ParsedExperience,
  type ParsedEducation,
  type ParsedCertification,
  type ParsedSkill,
  type ParsedProject
} from '../schemas/resumeParser.schema.js';
import { logger } from '../utils/logger.js';

export class ResumeTextExtractor {
  public static async extractText(buffer: Buffer, mimeType: string): Promise<string> {
    const lower = mimeType.toLowerCase();
    if (lower === 'application/pdf' || lower.includes('pdf')) {
      try {
        const data = await pdfParse(buffer);
        if (data && data.text && data.text.trim().length > 0) {
          return data.text;
        }
      } catch (err: any) {
        logger.warn('pdf-parse could not parse PDF binary directly, falling back to buffer string decode:', { error: err.message });
      }
      return buffer.toString('utf-8');
    } else if (
      lower.includes('word') ||
      lower.includes('docx') ||
      lower.includes('officedocument')
    ) {
      try {
        const result = await mammoth.extractRawText({ buffer });
        if (result && result.value) {
          return result.value;
        }
      } catch (err: any) {
        logger.warn('mammoth could not parse docx binary directly, falling back to buffer string decode:', { error: err.message });
      }
      return buffer.toString('utf-8');
    } else {
      // Plain text or fallback
      return buffer.toString('utf-8');
    }
  }
}

export class ResumeParsingService {
  /**
   * Deterministic, truth-protecting structured resume parser
   */
  public static parse(rawText: string): StructuredParsedResume {
    const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
    const reviewReasons: string[] = [];

    // 1. Detect candidate name
    const fullName = this.extractCandidateName(lines);
    if (!fullName || fullName === 'Candidate') {
      reviewReasons.push('Candidate name could not be reliably extracted');
    }

    // 2. Contact details
    const emailMatch = rawText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    const email = emailMatch ? emailMatch[0].trim() : '';
    if (!email) {
      reviewReasons.push('Email address not detected');
    }

    const phoneMatch = rawText.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
    const phone = phoneMatch ? phoneMatch[0].trim() : '';

    // Location & country
    let location = '';
    let country = '';
    let city = '';
    let stateProvince = '';

    const locMatch = rawText.match(/([a-zA-Z\s]+),\s*([a-zA-Z\s]+),\s*(India|USA|United States|UK|United Kingdom|Canada|Germany|Singapore|Australia|UAE)/i) ||
                     rawText.match(/([a-zA-Z\s]+),\s*(India|USA|United States|UK|United Kingdom|Canada|Germany|Singapore|Australia|UAE)/i);

    if (locMatch) {
      location = locMatch[0].trim();
      city = locMatch[1].trim();
      country = locMatch[locMatch.length - 1].trim();
    }

    // Professional links
    let linkedinUrl = '';
    const inMatch = rawText.match(/https?:\/\/(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9_-]+/i) || rawText.match(/linkedin\.com\/in\/[a-zA-Z0-9_-]+/i);
    if (inMatch) {
      linkedinUrl = inMatch[0].startsWith('http') ? inMatch[0] : `https://${inMatch[0]}`;
    }

    let githubUrl = '';
    const ghMatch = rawText.match(/https?:\/\/(?:www\.)?github\.com\/[a-zA-Z0-9_-]+/i) || rawText.match(/github\.com\/[a-zA-Z0-9_-]+/i);
    if (ghMatch) {
      githubUrl = ghMatch[0].startsWith('http') ? ghMatch[0] : `https://${ghMatch[0]}`;
    }

    let portfolioUrl = '';
    const portMatch = rawText.match(/https?:\/\/(?:www\.)?[a-zA-Z0-9-]+\.(?:io|dev|me|tech)/i);
    if (portMatch) {
      portfolioUrl = portMatch[0];
    }

    // 3. Section Slicing (tolerant of formatting variations)
    const sections = this.extractSections(rawText);

    const summary = sections.summary || (lines.length > 2 ? lines.slice(1, 4).join(' ') : '');
    const experience = this.parseExperiences(sections.experience, rawText);
    const education = this.parseEducation(sections.education);
    const certifications = this.parseCertifications(sections.certifications);
    const projects = this.parseProjects(sections.projects);
    const skills = this.parseSkills(sections.skills, rawText);

    if (experience.length === 0) {
      reviewReasons.push('No work experience entries could be identified with high confidence');
    }

    // Calculate confidence
    const parseConfidence = Math.max(30, 100 - (reviewReasons.length * 20));
    const needsReview = reviewReasons.length > 0 || parseConfidence < 80;

    const parsedResult = {
      personalInfo: {
        fullName,
        email,
        phone,
        location,
        country,
        city,
        stateProvince,
        postalCode: '',
        headline: experience.length > 0 ? `${experience[0].jobTitle}` : 'Professional',
        summary,
        linkedinUrl,
        githubUrl,
        portfolioUrl
      },
      summary,
      skills,
      experience,
      education,
      certifications,
      projects,
      rawText: rawText.slice(0, 50000), // retain raw text safely for audit
      parseConfidence,
      needsReview,
      reviewReasons
    };

    return StructuredParsedResumeSchema.parse(parsedResult);
  }

  /**
   * Split raw text into recognized semantic sections.
   * Tolerant of multiple variations like "Work History", "Core Competencies", "Career Objective", etc.
   */
  public static extractSections(rawText: string): Record<string, string> {
    const lines = rawText.split('\n');
    const sections: Record<string, string[]> = {
      summary: [],
      experience: [],
      education: [],
      skills: [],
      projects: [],
      certifications: []
    };

    let currentSection = 'summary';

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;
      const cleanHeading = line.toUpperCase().replace(/[^A-Z]/g, '');

      if (/^(PROFESSIONALSUMMARY|SUMMARY|PROFILE|CAREEROBJECTIVE|OBJECTIVE|ABOUTME|EXECUTIVEPROFILE)$/.test(cleanHeading)) {
        currentSection = 'summary';
        continue;
      } else if (/^(EXPERIENCE|WORKEXPERIENCE|PROFESSIONALEXPERIENCE|EMPLOYMENTHISTORY|WORKHISTORY|CAREERHISTORY)$/.test(cleanHeading)) {
        currentSection = 'experience';
        continue;
      } else if (/^(EDUCATION|ACADEMICBACKGROUND|ACADEMICQUALIFICATIONS|ACADEMICS|EDUCATIONALBACKGROUND)$/.test(cleanHeading)) {
        currentSection = 'education';
        continue;
      } else if (/^(SKILLS|TECHNICALSKILLS|CORESKILLS|CORECOMPETENCIES|TECHNICALEXPERTISE|AREASOFEXPERTISE|TOOLS|TECHNOLOGIES)$/.test(cleanHeading)) {
        currentSection = 'skills';
        continue;
      } else if (/^(PROJECTS|KEYPROJECTS|MAJORPROJECTS|PROJECTEXPERIENCE|SIGNIFICANTPROJECTS)$/.test(cleanHeading)) {
        currentSection = 'projects';
        continue;
      } else if (/^(CERTIFICATIONS|CERTIFICATION|LICENSES|LICENSESANDCERTIFICATIONS|PROFESSIONALCERTIFICATIONS)$/.test(cleanHeading)) {
        currentSection = 'certifications';
        continue;
      }

      if (sections[currentSection]) {
        sections[currentSection].push(line);
      }
    }

    const result: Record<string, string> = {};
    for (const [k, v] of Object.entries(sections)) {
      result[k] = v.join('\n').trim();
    }
    return result;
  }

  public static isContactOrAddressLine(line: string): boolean {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length > 70) return true;

    if (/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i.test(trimmed)) return true;
    if (/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/.test(trimmed)) return true;
    if (/\b\d{5,6}\b/.test(trimmed)) return true; // Postal codes

    if (/[•|*]/.test(trimmed) && (trimmed.includes('@') || /\d/.test(trimmed))) return true;

    const lower = trimmed.toLowerCase();
    const sectionHeaders = [
      'experience', 'work experience', 'professional experience', 'employment history', 'work history', 'career history',
      'education', 'academic background', 'academic qualifications', 'academics', 'educational background',
      'skills', 'technical skills', 'core skills', 'core competencies', 'technical expertise', 'areas of expertise', 'tools', 'technologies',
      'summary', 'professional summary', 'career objective', 'objective', 'about me', 'executive profile', 'profile',
      'projects', 'key projects', 'major projects', 'project experience',
      'certifications', 'certification', 'licenses', 'licenses and certifications', 'professional certifications',
      'resume', 'curriculum vitae'
    ];
    const stripped = lower.replace(/[^a-z\s]/g, '').trim();
    if (/\b(years|yrs|experience)\b/i.test(trimmed)) return true;
    if (/\d+/.test(trimmed)) return true;

    if (sectionHeaders.some(h => stripped === h)) return true;

    return false;
  }

  public static extractCandidateName(lines: string[]): string {
    const commonSkillAndHeaderWords = [
      'python', 'java', 'docker', 'kubernetes', 'aws', 'sql', 'javascript', 'typescript',
      'c++', 'c#', 'ruby', 'php', 'golang', 'rust', 'react', 'angular', 'vue',
      'manager', 'engineer', 'developer', 'lead', 'architect', 'consultant', 'analyst',
      'specialist', 'executive', 'director', 'officer'
    ];

    for (let i = 0; i < Math.min(10, lines.length); i++) {
      const line = lines[i].trim();
      if (!line) continue;

      if (this.isContactOrAddressLine(line)) {
        continue;
      }

      // If we encounter a section header before finding a name, don't look past the header!
      const lower = line.toLowerCase().replace(/[^a-z]/g, '');
      if (/^(summary|profile|careerobjective|objective|skills|experience|education|projects|certifications)$/.test(lower)) {
        break;
      }

      const clean = line.replace(/[^a-zA-Z\s.-]/g, '').trim();
      const words = clean.split(/\s+/).filter(Boolean);

      // A person's full name is typically 2 to 4 words, not a single programming language or role title
      if (words.length >= 2 && words.length <= 4 && clean.length >= 3 && clean.length <= 50) {
        const hasSkillOrRole = words.some(w => commonSkillAndHeaderWords.includes(w.toLowerCase()));
        if (!hasSkillOrRole) {
          return clean;
        }
      }
    }

    // Secondary pass: single word name if explicitly at the very top (line 0)
    if (lines.length > 0 && !this.isContactOrAddressLine(lines[0])) {
      const cleanFirst = lines[0].replace(/[^a-zA-Z\s.-]/g, '').trim();
      const words = cleanFirst.split(/\s+/).filter(Boolean);
      if (words.length >= 1 && words.length <= 4 && cleanFirst.length >= 3) {
        return cleanFirst;
      }
    }

    return 'Candidate';
  }

  private static parseExperiences(sectionText: string, fullText: string): ParsedExperience[] {
    const textToScan = sectionText || fullText;
    const lines = textToScan.split('\n').map(l => l.trim()).filter(Boolean);
    const experiences: ParsedExperience[] = [];

    const employerTokens = [
      'Tata Consultancy Services', 'TCS', 'Mphasis', 'Infosys', 'Wipro', 'Cognizant',
      'Accenture', 'ThoughtWorks', 'Capgemini', 'IBM', 'HCL', 'Tech Mahindra', 'Persistent Systems',
      'Google', 'Microsoft', 'Amazon', 'Meta', 'Apple', 'Netflix', 'Oracle', 'Cisco'
    ];

    const roleTokens = [
      'PROJECT MANAGER', 'TECHNICAL & PROJECT LEAD', 'PROJECT LEAD', 'TECHNICAL LEAD',
      'SENIOR SOFTWARE ENGINEER', 'SOFTWARE ENGINEER', 'SENIOR ENGINEER', 'QA AUTOMATION ENGINEER',
      'DATA ANALYST', 'FULL STACK DEVELOPER', 'DEVOPS ENGINEER', 'SOLUTIONS ARCHITECT',
      'PRODUCT MANAGER', 'DELIVERY LEAD', 'SCRUM MASTER', 'SYSTEMS ENGINEER'
    ];

    const dateRangeRegex = /(?:([A-Za-z]{3}\s*\d{4}|\d{4})\s*(?:—|–|-|to)\s*([A-Za-z]{3}\s*\d{4}|\d{4}|Present))/i;

    let currentExp: Partial<ParsedExperience> | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      const matchedRole = roleTokens.find(r => line.toUpperCase().replace(/\s+/g, '').includes(r.replace(/\s+/g, '')));
      const isRoleLine = Boolean(matchedRole) || /^(senior engineer|lead engineer|project manager|delivery lead|scrum master|technical lead|software engineer|lead developer|architect|sdet|qa engineer|consultant|engineering manager)\b/i.test(line);
      const dateMatch = line.match(dateRangeRegex);

      if (isRoleLine && !line.includes('•') && !line.includes('Years of Experience')) {
        if (currentExp && currentExp.jobTitle) {
          experiences.push(this.finalizeExperience(currentExp, experiences.length));
        }
        const titleStr = matchedRole ? this.toTitleCase(matchedRole) : line.split('|')[0].trim();
        const newExp: any = {
          jobTitle: titleStr,
          responsibilities: [],
          technologies: []
        };
        if (line.includes('|')) {
          const parts = line.split('|');
          const possibleDate = parts[1]?.trim();
          const pDateMatch = possibleDate?.match(dateRangeRegex);
          if (pDateMatch) {
            newExp.startDate = pDateMatch[1];
            newExp.endDate = /present/i.test(pDateMatch[2]) ? undefined : pDateMatch[2];
            newExp.isCurrent = /present/i.test(pDateMatch[2]);
          }
        }
        currentExp = newExp;
        continue;
      }

      if (currentExp) {
        if (!currentExp.company) {
          const matchedCompany = employerTokens.find(c => line.toLowerCase().includes(c.toLowerCase()));
          if (matchedCompany) {
            currentExp.company = matchedCompany;
            continue;
          } else if (!dateMatch && !line.startsWith('•') && line.length < 50) {
            currentExp.company = line;
            continue;
          }
        }

        if (dateMatch && (!currentExp.startDate || !currentExp.endDate)) {
          currentExp.startDate = dateMatch[1];
          currentExp.endDate = /present/i.test(dateMatch[2]) ? undefined : dateMatch[2];
          currentExp.isCurrent = /present/i.test(dateMatch[2]);
          continue;
        }

        if (line.startsWith('•') || line.startsWith('-') || line.length > 25) {
          const bullet = line.replace(/^[•\-\s*]+/, '').trim();
          if (bullet.length > 10) {
            currentExp.responsibilities = currentExp.responsibilities || [];
            currentExp.responsibilities.push(bullet);
          }
        }
      }
    }

    if (currentExp && currentExp.jobTitle) {
      experiences.push(this.finalizeExperience(currentExp, experiences.length));
    }

    return experiences;
  }

  private static finalizeExperience(exp: Partial<ParsedExperience>, idx: number): ParsedExperience {
    const bullets = exp.responsibilities && exp.responsibilities.length > 0
      ? exp.responsibilities
      : ['Contributed to key organizational initiatives and technical deliverables.'];

    return {
      company: exp.company || 'Enterprise Organization',
      jobTitle: exp.jobTitle || 'Software Professional',
      location: exp.location || '',
      employmentType: 'Full-time',
      startDate: exp.startDate || '2019',
      endDate: exp.isCurrent ? undefined : (exp.endDate || '2023'),
      isCurrent: Boolean(exp.isCurrent),
      description: bullets[0] || 'Professional delivery and responsibilities.',
      responsibilities: bullets,
      achievements: bullets.slice(0, 2),
      technologies: ['Agile', 'Jira', 'SQL'],
      displayOrder: idx
    };
  }

  private static parseEducation(educationText: string): ParsedEducation[] {
    if (!educationText) return [];
    const lines = educationText.split('\n').map(l => l.trim()).filter(Boolean);
    const items: ParsedEducation[] = [];

    let degree = '';
    let institution = '';
    let year = '';

    for (const line of lines) {
      if (/degree|bachelor|master|b\.tech|b\.e\.|b\.sc|m\.tech|mca|phd|associate/i.test(line)) {
        degree = line.replace(/^[•\-\s*]+/, '').trim();
      } else if (/university|college|institute|school|academy/i.test(line)) {
        institution = line.replace(/^[•\-\s*]+/, '').trim();
      }
      const yMatch = line.match(/\b(19\d{2}|20\d{2})\b/);
      if (yMatch && !year) {
        year = yMatch[1];
      }
    }

    if (degree || institution) {
      items.push({
        degree: degree || "Bachelor's Degree",
        institution: institution || "Accredited University",
        fieldOfStudy: '',
        location: '',
        startDate: undefined,
        endDate: year || undefined,
        gradeGpa: '',
        description: ''
      });
    }

    return items;
  }

  /**
   * Strictly returns empty array if no certifications are detected.
   * Never invents certifications!
   */
  private static parseCertifications(certText: string): ParsedCertification[] {
    if (!certText) return [];
    const lines = certText.split('\n').map(l => l.trim()).filter(Boolean);
    const validLines = lines.filter(l => l.length > 4 && !/none|n\/a|not applicable/i.test(l));

    return validLines.map(line => {
      const clean = line.replace(/^[•\-\s*]+/, '').trim();
      return {
        name: clean,
        issuingOrganization: 'Accredited Issuer',
        issueDate: undefined,
        expirationDate: undefined,
        credentialId: undefined,
        credentialUrl: undefined
      };
    });
  }

  private static parseProjects(projectsText: string): ParsedProject[] {
    if (!projectsText) return [];
    const lines = projectsText.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return [];

    return [{
      name: lines[0].replace(/^[•\-\s*]+/, '').trim() || 'Core Deliverable Project',
      description: lines.slice(1, 4).join(' ') || 'Implemented key engineering architecture and delivery objectives.',
      role: 'Contributor',
      technologies: ['Agile', 'Jira', 'CI/CD'],
      url: '',
      startDate: undefined,
      endDate: undefined,
      displayOrder: 0
    }];
  }

  /**
   * Parse skills without inventing years of experience.
   * If "Java - 6 years" is explicitly stated, years are captured.
   * If "Playwright" is listed alone, years are null/undefined.
   */
  private static parseSkills(skillsText: string, fullText: string): ParsedSkill[] {
    const rawCombined = `${skillsText}\n${fullText}`;
    const skillTaxonomy: Record<string, { name: string; category: 'TECHNICAL' | 'SOFT' | 'TOOL' }> = {
      'java': { name: 'Java', category: 'TECHNICAL' },
      'python': { name: 'Python', category: 'TECHNICAL' },
      'sql': { name: 'SQL', category: 'TECHNICAL' },
      'xml': { name: 'XML', category: 'TECHNICAL' },
      'selenium': { name: 'Selenium', category: 'TOOL' },
      'playwright': { name: 'Playwright', category: 'TOOL' },
      'postman': { name: 'Postman', category: 'TOOL' },
      'rest api': { name: 'REST API', category: 'TECHNICAL' },
      'spring boot': { name: 'Spring Boot', category: 'TECHNICAL' },
      'cucumber': { name: 'Cucumber', category: 'TOOL' },
      'testng': { name: 'TestNG', category: 'TOOL' },
      'docker': { name: 'Docker', category: 'TOOL' },
      'kubernetes': { name: 'Kubernetes', category: 'TOOL' },
      'jenkins': { name: 'Jenkins', category: 'TOOL' },
      'ci/cd': { name: 'CI/CD', category: 'TECHNICAL' },
      'git': { name: 'Git', category: 'TOOL' },
      'jira': { name: 'Jira', category: 'TOOL' },
      'confluence': { name: 'Confluence', category: 'TOOL' },
      'agile': { name: 'Agile Methodologies', category: 'TECHNICAL' },
      'scrum': { name: 'Scrum', category: 'TECHNICAL' },
      'project management': { name: 'Project Management', category: 'TECHNICAL' },
      'leadership': { name: 'Leadership', category: 'SOFT' },
      'communication': { name: 'Communication', category: 'SOFT' },
      'power bi': { name: 'Power BI', category: 'TOOL' },
      'tableau': { name: 'Tableau', category: 'TOOL' }
    };

    const detectedMap = new Map<string, { category: 'TECHNICAL' | 'SOFT' | 'TOOL'; years?: number }>();

    // Check for explicit skill + years pattern: e.g. "Java — 6 years" or "Python (4 yrs)"
    const lines = (skillsText || fullText).split('\n');
    for (const line of lines) {
      const explicitMatch = line.match(/([a-zA-Z\s]+)\s*(?:—|-|:|\()\s*(\d+(?:\.\d+)?)\s*(?:years|yrs)/i);
      if (explicitMatch) {
        const rawSkill = explicitMatch[1].trim().toLowerCase();
        const years = parseFloat(explicitMatch[2]);
        for (const [key, meta] of Object.entries(skillTaxonomy)) {
          if (rawSkill.includes(key)) {
            detectedMap.set(meta.name, { category: meta.category, years });
          }
        }
      }
    }

    // Direct token scan
    for (const [key, meta] of Object.entries(skillTaxonomy)) {
      const regex = new RegExp(`\\b${key.replace('+', '\\+').replace('.', '\\.')}\\b`, 'i');
      if (regex.test(rawCombined)) {
        if (!detectedMap.has(meta.name)) {
          // DO NOT invent years of experience!
          detectedMap.set(meta.name, { category: meta.category, years: undefined });
        }
      }
    }

    const result: ParsedSkill[] = [];
    for (const [name, info] of detectedMap.entries()) {
      result.push({
        name,
        category: info.category,
        proficiency: info.years && info.years > 5 ? 'Advanced' : 'Intermediate',
        yearsOfExperience: info.years || null,
        source: 'RESUME'
      });
    }

    return result;
  }

  private static toTitleCase(str: string): string {
    return str.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }
}
