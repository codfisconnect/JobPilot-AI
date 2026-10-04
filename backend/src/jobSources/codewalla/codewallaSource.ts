import { IJobSource, ExternalJobRaw } from '../base/JobSource.js';
import { CodewallaParser } from './codewallaParser.js';
import { JobDescription } from '../../types/index.js';

export class CodewallaSource implements IJobSource {
  public readonly sourceName = 'Codewalla';
  public readonly baseUrl = 'https://www.codewalla.com/jobs';

  /**
   * Fetch live jobs directly from Codewalla's public jobs webpage.
   */
  public async fetchJobs(): Promise<ExternalJobRaw[]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    try {
      const response = await fetch(this.baseUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`Codewalla page returned HTTP status ${response.status}`);
      }

      const html = await response.text();
      return CodewallaParser.parseJobsHtml(html, this.baseUrl);
    } catch (err: any) {
      console.error('[CodewallaSource] Failed to fetch external jobs:', err.message);
      throw new Error(`Codewalla job discovery failed: ${err.message}`);
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Normalize raw external job data into canonical JobDescription format without fabricating fields.
   */
  public normalizeJob(raw: ExternalJobRaw): JobDescription {
    // Detect career track from job title
    const t = raw.title.toLowerCase();
    let careerTrack = 'Software Engineering';
    if (/project\s*manager|program\s*manager|scrum|delivery/i.test(t)) {
      careerTrack = 'Project & Delivery Management';
    } else if (/qa|test|automation|sdet/i.test(t)) {
      careerTrack = 'QA Automation';
    } else if (/backend|magento|java|node|python/i.test(t)) {
      careerTrack = 'Backend Engineering';
    } else if (/front[- ]*end|react|vue|angular|ui/i.test(t)) {
      careerTrack = 'Frontend Engineering';
    } else if (/cloud|infrastructure|devops|sre|architect/i.test(t)) {
      careerTrack = 'Cloud & DevOps';
    } else if (/mobile|android|ios|flutter/i.test(t)) {
      careerTrack = 'Mobile Engineering';
    }

    // Extract skills from text and qualifications using controlled taxonomy
    const extractedSkills = this.extractSkillsFromText(raw.rawText);

    // Fallback must-have skills from title/role if none detected
    const mustHaveSkills = extractedSkills.length > 0 ? extractedSkills.slice(0, 8) : this.getDefaultSkillsForRole(raw.title);
    const niceToHaveSkills = extractedSkills.slice(8);

    return {
      id: `job-ext-${raw.externalId}`,
      role: raw.title,
      company: raw.company || 'Codewalla',
      location: raw.location || 'Chennai / Pune',
      sourceUrl: raw.sourceUrl,
      sourceType: 'external',
      source: 'Codewalla',
      applicationMode: 'demo', // Codewalla is strictly simulated DEMO ONLY in JobPilot
      applicationUrl: raw.applicationUrl || raw.sourceUrl, // Preserved for transparency, but Apply flow strictly intercepts Codewalla as demo
      applicationMethod: 'JobPilot Demo Simulation',
      employmentType: raw.employmentType || 'Full-time',
      workMode: raw.workMode || 'Onsite / Hybrid',
      publishedDate: raw.publishedDate || 'Active Opening',
      isExternal: true,
      externalJobId: raw.externalId,
      experienceRequired: raw.experience || '4+ Years',
      salary: undefined, // Do NOT invent salary if absent
      careerTrack,
      mustHaveSkills,
      niceToHaveSkills,
      responsibilities: raw.responsibilities.length ? raw.responsibilities : [raw.descriptionText],
      qualifications: raw.qualifications.length ? raw.qualifications : ['Demonstrated hands-on expertise in the role domain.'],
      rawText: raw.rawText,
      createdAt: new Date().toISOString()
    };
  }

  private extractSkillsFromText(text: string): string[] {
    const knownSkills = [
      'Magento', 'Adobe Commerce', 'PHP', 'React', 'Next.js', 'TypeScript', 'JavaScript',
      'HTML5', 'CSS3', 'Tailwind CSS', 'SCSS', 'Kotlin', 'Java', 'Flutter', 'Android SDK',
      'MVVM', 'GraphQL', 'REST API', 'MySQL', 'Redis', 'Varnish', 'AWS', 'Azure', 'GCP',
      'Terraform', 'Ansible', 'Docker', 'Kubernetes', 'Linux', 'Agile', 'Scrum', 'Jira',
      'SDLC', 'Release Management', 'Stakeholder Management', 'Risk Management', 'Sprint Planning'
    ];

    const found: string[] = [];
    const textLower = text.toLowerCase();

    for (const skill of knownSkills) {
      const reg = new RegExp(`\\b${skill.replace('.', '\\.').replace('+', '\\+')}\\b`, 'i');
      if (reg.test(textLower)) {
        found.push(skill);
      }
    }

    return Array.from(new Set(found));
  }

  private getDefaultSkillsForRole(roleTitle: string): string[] {
    const r = roleTitle.toLowerCase();
    if (r.includes('project manager')) {
      return ['Agile', 'Scrum', 'Jira', 'Stakeholder Management', 'Release Management', 'Risk Management'];
    }
    if (r.includes('front-end')) {
      return ['React', 'Next.js', 'TypeScript', 'JavaScript', 'HTML5', 'CSS3'];
    }
    if (r.includes('magento') || r.includes('backend')) {
      return ['Magento', 'PHP', 'MySQL', 'REST API', 'GraphQL', 'Redis'];
    }
    if (r.includes('android') || r.includes('mobile')) {
      return ['Android SDK', 'Kotlin', 'Java', 'REST API', 'MVVM'];
    }
    if (r.includes('cloud') || r.includes('infrastructure')) {
      return ['AWS', 'Terraform', 'Linux', 'Ansible', 'Networking'];
    }
    return ['Software Engineering', 'Problem Solving', 'Agile'];
  }
}
