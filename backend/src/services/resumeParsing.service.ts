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

    const summary = sections.summary || (lines.length > 2 ? lines.slice(1, 4).filter(l => !this.isContactOrAddressLine(l)).join(' ') : '');
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
   * Preserves section purity and does not leak contact lines into summary.
   */
  public static extractSections(rawText: string): Record<string, string> {
    const lines = rawText.split('\n');
    const sections: Record<string, string[]> = {
      objective: [],
      summary: [],
      experience: [],
      education: [],
      skills: [],
      projects: [],
      certifications: [],
      languages: []
    };

    let currentSection: string | null = null;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;
      const cleanHeading = line.toUpperCase().replace(/[^A-Z]/g, '');

      // Check if line is a section heading
      if (/^(PROFESSIONALSUMMARY|SUMMARY|PROFILESUMMARY|CAREERSUMMARY|EXECUTIVEPROFILE|ABOUTME)$/.test(cleanHeading)) {
        currentSection = 'summary';
        continue;
      } else if (/^(CAREEROBJECTIVE|OBJECTIVE|PROFESSIONALOBJECTIVE)$/.test(cleanHeading)) {
        currentSection = 'objective';
        continue;
      } else if (/^(EXPERIENCE|WORKEXPERIENCE|PROFESSIONALEXPERIENCE|EMPLOYMENTHISTORY|WORKHISTORY|CAREERHISTORY|PROFESSIONALBACKGROUND)$/.test(cleanHeading)) {
        currentSection = 'experience';
        continue;
      } else if (/^(EDUCATION|ACADEMICBACKGROUND|ACADEMICQUALIFICATIONS|ACADEMICS|EDUCATIONALBACKGROUND|EDUCATIONALQUALIFICATIONS)$/.test(cleanHeading)) {
        currentSection = 'education';
        continue;
      } else if (/^(SKILLS|KEYSKILLS|TECHNICALSKILLS|CORESKILLS|CORECOMPETENCIES|TECHNICALEXPERTISE|AREASOFEXPERTISE|TOOLS|TECHNOLOGIES|METHODOLOGIES)$/.test(cleanHeading)) {
        currentSection = 'skills';
        continue;
      } else if (/^(PROJECTS|KEYPROJECTS|MAJORPROJECTS|PROJECTEXPERIENCE|SELECTEDPROJECTS|SIGNIFICANTPROJECTS)$/.test(cleanHeading)) {
        currentSection = 'projects';
        continue;
      } else if (/^(CERTIFICATIONS|CERTIFICATION|LICENSES|LICENSESANDCERTIFICATIONS|PROFESSIONALCERTIFICATIONS)$/.test(cleanHeading)) {
        currentSection = 'certifications';
        continue;
      } else if (/^(LANGUAGES|LANGUAGESKNOWN)$/.test(cleanHeading)) {
        currentSection = 'languages';
        continue;
      }

      // If we haven't hit a section yet, ignore contact/header noise from polluting summary
      if (!currentSection) {
        if (!this.isContactOrAddressLine(line)) {
          // pre-heading text, only include if substantial
          if (line.length > 40 && !line.includes('@')) {
            sections.summary.push(line);
          }
        }
        continue;
      }

      // Filter contact or header noise from being dumped inside summary
      if (currentSection === 'summary' && this.isContactOrAddressLine(line)) {
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

    // If career objective exists and summary is empty, preserve objective in summary
    if (!result.summary && result.objective) {
      result.summary = result.objective;
    }

    return result;
  }

  public static isContactOrAddressLine(line: string): boolean {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length > 90) return false;

    if (/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i.test(trimmed)) return true;
    if (/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/.test(trimmed)) return true;
    if (/\b(?:phone|mobile|tel|contact|email|linkedin|github)\b/i.test(trimmed) && trimmed.length < 50) return true;
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
    if (sectionHeaders.some(h => stripped === h)) return true;

    return false;
  }

  public static extractCandidateName(lines: string[]): string {
    const commonSkillAndHeaderWords = [
      'python', 'java', 'docker', 'kubernetes', 'aws', 'sql', 'javascript', 'typescript',
      'c++', 'c#', 'ruby', 'php', 'golang', 'rust', 'react', 'angular', 'vue',
      'manager', 'engineer', 'developer', 'lead', 'architect', 'consultant', 'analyst',
      'specialist', 'executive', 'director', 'officer', 'tester', 'qa', 'sdet'
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

  /**
   * Generalized, robust experience extraction that does NOT rely on hardcoded companies or roles.
   * Handles multi-line titles, employers, durations ("6 years"), date ranges, and bullet segmentation.
   */
  private static parseExperiences(sectionText: string, fullText: string): ParsedExperience[] {
    const textToScan = sectionText || fullText;
    const lines = textToScan.split('\n').map(l => l.trim()).filter(Boolean);
    const experiences: ParsedExperience[] = [];

    // Date range pattern: e.g. "Jan 2020 - Present", "06/2018 to 12/2021", "2018 - 2022"
    const dateRangeRegex = /(?:([A-Za-z]{3}\s*\d{4}|\d{1,2}\/\d{4}|\d{4})\s*(?:—|–|-|to)\s*([A-Za-z]{3}\s*\d{4}|\d{1,2}\/\d{4}|\d{4}|Present|Current|Till\s*Date))/i;
    // Duration pattern: e.g. "6 years", "2 yrs 4 mos", "3+ years"
    const durationRegex = /\b(\d+(?:\.\d+)?\+?\s*(?:years?|yrs?)(?:\s*(?:and|&)?\s*\d+\s*(?:months?|mos?))?)\b/i;

    // Role indicator keywords
    const roleKeywordRegex = /\b(engineer|developer|analyst|architect|consultant|manager|lead|director|specialist|tester|qa|sdet|administrator|designer|officer|scientist|associate|intern|programmer|coordinator|executive)\b/i;

    // Company indicators: e.g. Pvt Ltd, Ltd, Inc, LLC, Technologies, Solutions, Corp, Systems, Software, Labs, etc.
    const companyIndicatorRegex = /\b(pvt\.?\s*ltd\.?|ltd\.?|inc\.?|llc|corp\.?|corporation|technologies|technology|solutions|systems|services|software|consulting|labs|group|enterprises|bank|aviation)\b/i;

    let currentExp: Partial<ParsedExperience> | null = null;

    const commitCurrentExp = () => {
      if (currentExp && (currentExp.jobTitle || currentExp.company)) {
        experiences.push(this.finalizeExperience(currentExp, experiences.length));
      }
      currentExp = null;
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check for bullet lines first
      const isBullet = line.startsWith('•') || line.startsWith('-') || line.startsWith('*') || /^\d+\.\s/.test(line);

      // Check for date and duration matches
      const dateMatch = line.match(dateRangeRegex);
      const durationMatch = line.match(durationRegex);

      // Is this line a job title?
      // A job title line contains role keywords, is usually not a bullet, and doesn't look like an employer only
      const hasRoleKeyword = roleKeywordRegex.test(line);
      const hasCompanyKeyword = companyIndicatorRegex.test(line);

      // Check if line is "Key Responsibilities:" or "Responsibilities:" header
      if (/^(key\s*)?responsibilities\s*:?$/i.test(line)) {
        continue;
      }

      if (!isBullet) {
        // Case 1: Line has pipe/separator combining Title and Employer or Date (e.g. "Senior Test Engineer | Machine Vogue" or "Title | Jan 2020 - Present")
        if (line.includes('|') || line.includes(' - ') || line.includes(' – ') || line.includes(' — ')) {
          const sep = line.includes('|') ? '|' : (line.includes(' — ') ? ' — ' : (line.includes(' – ') ? ' – ' : ' - '));
          const parts = line.split(sep).map(p => p.trim());

          // If parts contain role keywords
          if (parts.some(p => roleKeywordRegex.test(p))) {
            commitCurrentExp();

            const rolePart = parts.find(p => roleKeywordRegex.test(p)) || parts[0];
            const otherParts = parts.filter(p => p !== rolePart);

            const newExp: Partial<ParsedExperience> = {
              jobTitle: rolePart,
              responsibilities: [],
              technologies: []
            };

            for (const part of otherParts) {
              const dMatch = part.match(dateRangeRegex);
              const durMatch = part.match(durationRegex);
              if (dMatch) {
                newExp.startDate = dMatch[1];
                newExp.endDate = /present|current|till\s*date/i.test(dMatch[2]) ? undefined : dMatch[2];
                newExp.isCurrent = /present|current|till\s*date/i.test(dMatch[2]);
              } else if (durMatch) {
                newExp.duration = durMatch[1];
              } else if (!newExp.company && part.length < 60) {
                newExp.company = part;
              }
            }

            currentExp = newExp;
            continue;
          }
        }

        // Case 2: Line is a distinct Role Title (e.g. "Senior Test Engineer / Business Analyst")
        if (hasRoleKeyword && line.length < 80 && !dateMatch) {
          // If we already have a role title but no company, maybe this line is something else or a second role
          if (currentExp && !currentExp.company && !currentExp.jobTitle) {
            currentExp.jobTitle = line;
            continue;
          }

          commitCurrentExp();
          currentExp = {
            jobTitle: line,
            responsibilities: [],
            technologies: []
          };
          continue;
        }

        // Case 3: Line contains Company keyword (e.g. "Machine Vogue Technology Pvt Ltd.")
        if (hasCompanyKeyword && line.length < 80) {
          if (currentExp && !currentExp.company) {
            currentExp.company = line;
            continue;
          } else if (!currentExp) {
            // Company first pattern: Start exp with company, wait for role title
            currentExp = {
              company: line,
              responsibilities: [],
              technologies: []
            };
            continue;
          }
        }

        // Case 4: Line contains Date or Duration alone (e.g. "6 years" or "Jan 2020 - Present")
        if (currentExp && (dateMatch || durationMatch)) {
          if (dateMatch && !currentExp.startDate) {
            currentExp.startDate = dateMatch[1];
            currentExp.endDate = /present|current|till\s*date/i.test(dateMatch[2]) ? undefined : dateMatch[2];
            currentExp.isCurrent = /present|current|till\s*date/i.test(dateMatch[2]);
          }
          if (durationMatch && !currentExp.duration) {
            currentExp.duration = durationMatch[1];
          }
          continue;
        }

        // Case 5: If currentExp exists and lacks company, and line is a short non-bullet string (< 50 chars), it's likely the company
        if (currentExp && !currentExp.company && line.length < 50 && !dateMatch && !durationMatch) {
          currentExp.company = line;
          continue;
        }
      }

      // Collect responsibilities / bullets under the current experience
      if (currentExp) {
        const cleanBullet = line.replace(/^[•\-\*\d\.\s]+/, '').trim();
        if (cleanBullet.length > 8) {
          currentExp.responsibilities = currentExp.responsibilities || [];
          currentExp.responsibilities.push(cleanBullet);
        }
      }
    }

    commitCurrentExp();

    return experiences;
  }

  private static finalizeExperience(exp: Partial<ParsedExperience>, idx: number): ParsedExperience {
    const bullets = exp.responsibilities && exp.responsibilities.length > 0
      ? exp.responsibilities
      : ['Contributed to core deliverables and organizational initiatives.'];

    return {
      company: exp.company || 'Enterprise Organization',
      jobTitle: exp.jobTitle || 'Professional Role',
      location: exp.location || '',
      employmentType: 'Full-time',
      startDate: exp.startDate || '',
      endDate: exp.isCurrent ? undefined : (exp.endDate || ''),
      duration: exp.duration || '',
      isCurrent: Boolean(exp.isCurrent),
      description: bullets[0] || 'Professional delivery and responsibilities.',
      responsibilities: bullets,
      achievements: bullets.slice(0, 2),
      technologies: exp.technologies && exp.technologies.length > 0 ? exp.technologies : ['Agile', 'Jira'],
      displayOrder: idx
    };
  }

  private static parseEducation(educationText: string): ParsedEducation[] {
    if (!educationText) return [];
    const lines = educationText.split('\n').map(l => l.trim()).filter(Boolean);
    const items: ParsedEducation[] = [];

    let currentEdu: Partial<ParsedEducation> | null = null;

    for (const line of lines) {
      const clean = line.replace(/^[•\-\*\s]+/, '').trim();
      const isDegree = /bachelor|master|b\.tech|b\.e\.|b\.sc|m\.tech|mca|mba|phd|associate|degree|diploma/i.test(clean);
      const isInstitution = /university|college|institute|school|academy/i.test(clean);
      const yearMatch = clean.match(/\b(19\d{2}|20\d{2})\b/);

      if (isDegree) {
        if (currentEdu && (currentEdu.degree || currentEdu.institution)) {
          items.push({
            degree: currentEdu.degree || "Bachelor's Degree",
            institution: currentEdu.institution || "Accredited University",
            fieldOfStudy: currentEdu.fieldOfStudy || '',
            location: currentEdu.location || '',
            startDate: undefined,
            endDate: currentEdu.endDate || undefined,
            gradeGpa: '',
            description: ''
          });
        }
        currentEdu = {
          degree: clean,
          institution: '',
          endDate: yearMatch ? yearMatch[1] : undefined
        };
      } else if (isInstitution) {
        if (!currentEdu) {
          currentEdu = { degree: "Bachelor's Degree", institution: clean };
        } else {
          currentEdu.institution = clean;
        }
        if (yearMatch && !currentEdu.endDate) {
          currentEdu.endDate = yearMatch[1];
        }
      } else if (currentEdu && yearMatch && !currentEdu.endDate) {
        currentEdu.endDate = yearMatch[1];
      }
    }

    if (currentEdu && (currentEdu.degree || currentEdu.institution)) {
      items.push({
        degree: currentEdu.degree || "Bachelor's Degree",
        institution: currentEdu.institution || "Accredited University",
        fieldOfStudy: currentEdu.fieldOfStudy || '',
        location: currentEdu.location || '',
        startDate: undefined,
        endDate: currentEdu.endDate || undefined,
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

  /**
   * Generalized Project extraction. Parses multiple distinct projects with names, descriptions, and roles.
   */
  private static parseProjects(projectsText: string): ParsedProject[] {
    if (!projectsText) return [];
    const lines = projectsText.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return [];

    const projects: ParsedProject[] = [];
    let currentProj: Partial<ParsedProject> | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const isBullet = line.startsWith('•') || line.startsWith('-') || line.startsWith('*');
      const clean = line.replace(/^[•\-\*\s]+/, '').trim();

      // If non-bullet and short to medium length, treat as project title / header
      if (!isBullet && clean.length > 3 && clean.length < 60) {
        if (currentProj && currentProj.name) {
          projects.push({
            name: currentProj.name,
            description: currentProj.description || 'Contributed to project delivery and specifications.',
            role: currentProj.role || 'Contributor',
            technologies: currentProj.technologies || ['Agile', 'Jira'],
            url: '',
            startDate: undefined,
            endDate: undefined,
            displayOrder: projects.length
          });
        }
        currentProj = {
          name: clean,
          description: '',
          technologies: []
        };
      } else if (currentProj) {
        if (!currentProj.description) {
          currentProj.description = clean;
        } else {
          currentProj.description += ` ${clean}`;
        }
      }
    }

    if (currentProj && currentProj.name) {
      projects.push({
        name: currentProj.name,
        description: currentProj.description || 'Contributed to project delivery and specifications.',
        role: currentProj.role || 'Contributor',
        technologies: currentProj.technologies || ['Agile', 'Jira'],
        url: '',
        startDate: undefined,
        endDate: undefined,
        displayOrder: projects.length
      });
    }

    return projects;
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
      'maven': { name: 'Maven', category: 'TOOL' },
      'eclipse': { name: 'Eclipse', category: 'TOOL' },
      'jira': { name: 'Jira', category: 'TOOL' },
      'confluence': { name: 'Confluence', category: 'TOOL' },
      'agile': { name: 'Agile Methodologies', category: 'TECHNICAL' },
      'scrum': { name: 'Scrum', category: 'TECHNICAL' },
      'kanban': { name: 'Kanban', category: 'TECHNICAL' },
      'bpmn': { name: 'BPMN', category: 'TECHNICAL' },
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
