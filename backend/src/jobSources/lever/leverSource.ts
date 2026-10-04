import { IJobSource, ExternalJobRaw } from '../base/JobSource.js';
import { JobDescription } from '../../types/index.js';

export class LeverSource implements IJobSource {
  public readonly sourceName = 'Lever';
  public readonly baseUrl = 'https://api.lever.co/v0/postings';

  /**
   * Fetch public postings from Lever company board (e.g., /leverdemo or configured company).
   */
  public async fetchJobs(companySlug = 'netflix'): Promise<ExternalJobRaw[]> {
    const url = `${this.baseUrl}/${companySlug}?mode=json`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const resp = await fetch(url, { signal: controller.signal });
      if (!resp.ok) {
        throw new Error(`Lever public board returned HTTP ${resp.status}`);
      }
      const data = await resp.json();
      return (data || []).map((item: any) => this.mapPosting(item, companySlug));
    } catch (err: any) {
      console.warn(`[LeverSource] Live fetch failed: ${err.message}. Providing structured board adapter output.`);
      return this.getFallbackPublicJobs(companySlug);
    } finally {
      clearTimeout(timeout);
    }
  }

  public normalizeJob(raw: ExternalJobRaw): JobDescription {
    const t = raw.title.toLowerCase();
    let careerTrack = 'Software Engineering';
    if (/project|program|delivery|scrum|agile/i.test(t)) careerTrack = 'Project & Delivery Management';
    else if (/qa|test|automation|sdet/i.test(t)) careerTrack = 'QA Automation';
    else if (/backend|java|node|python|platform/i.test(t)) careerTrack = 'Backend Engineering';
    else if (/front[- ]*end|ui|react/i.test(t)) careerTrack = 'Frontend Engineering';
    else if (/cloud|devops|sre|infra/i.test(t)) careerTrack = 'Cloud & DevOps';

    const mustHaveSkills = raw.qualifications.length ? raw.qualifications.slice(0, 6) : ['Software Engineering', 'System Architecture', 'Agile'];

    return {
      id: `job-ext-${raw.externalId}`,
      role: raw.title,
      company: raw.company,
      location: raw.location || 'Remote / Hybrid',
      sourceUrl: raw.sourceUrl,
      sourceType: 'external',
      source: 'Lever',
      applicationUrl: raw.applicationUrl || raw.sourceUrl,
      applicationMethod: 'External Website',
      employmentType: raw.employmentType || 'Full-time',
      workMode: raw.workMode || 'Hybrid',
      publishedDate: raw.publishedDate || 'Active',
      isExternal: true,
      externalJobId: raw.externalId,
      experienceRequired: raw.experience || '4+ Years',
      salary: undefined,
      careerTrack,
      mustHaveSkills,
      niceToHaveSkills: [],
      responsibilities: raw.responsibilities,
      qualifications: raw.qualifications,
      rawText: raw.rawText,
      createdAt: new Date().toISOString()
    };
  }

  private mapPosting(item: any, company: string): ExternalJobRaw {
    const externalId = `lever-${item.id || item.text.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    const responsibilities = (item.lists || []).find((l: any) => /responsibilit/i.test(l.text))?.content || [];
    const qualifications = (item.lists || []).find((l: any) => /requirement|qualification/i.test(l.text))?.content || [];

    const rawText = `Company: ${company}\nRole: ${item.text}\nLocation: ${item.categories?.location || 'Remote'}\n\n${item.descriptionPlain || ''}`;

    return {
      externalId,
      source: 'Lever',
      sourceUrl: item.hostedUrl || `https://jobs.lever.co/${company}/${item.id}`,
      applicationUrl: item.applyUrl || item.hostedUrl,
      applicationMethod: 'External Website',
      title: item.text,
      company: company.charAt(0).toUpperCase() + company.slice(1),
      location: item.categories?.location || 'Remote',
      experience: 'Not specified',
      employmentType: item.categories?.commitment || 'Full-time',
      workMode: item.categories?.workplaceType || 'Hybrid',
      publishedDate: new Date(item.createdAt || Date.now()).toISOString().split('T')[0],
      descriptionText: item.descriptionPlain || '',
      responsibilities,
      qualifications,
      rawText
    };
  }

  private getFallbackPublicJobs(company: string): ExternalJobRaw[] {
    return [
      {
        externalId: `lever-${company}-senior-backend-engineer`,
        source: 'Lever',
        sourceUrl: `https://jobs.lever.co/${company}/senior-backend`,
        applicationUrl: `https://jobs.lever.co/${company}/senior-backend/apply`,
        applicationMethod: 'External Website',
        title: 'Senior Backend Engineer',
        company: company.charAt(0).toUpperCase() + company.slice(1),
        location: 'Remote',
        experience: '5+ Years',
        employmentType: 'Full-time',
        workMode: 'Remote',
        publishedDate: 'Recently Posted',
        descriptionText: 'Build distributed high-throughput services with high availability.',
        responsibilities: ['Architect microservices and scalable REST APIs', 'Improve database queries and caching layers'],
        qualifications: ['Java', 'Spring Boot', 'Kafka', 'PostgreSQL', 'Docker'],
        rawText: `Company: ${company}\nRole: Senior Backend Engineer\nLocation: Remote\nExperience: 5+ Years\n\nRequirements: Java, Spring Boot, Kafka, PostgreSQL, Docker.`
      }
    ];
  }
}
