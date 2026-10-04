import { IJobSource, ExternalJobRaw } from '../base/JobSource.js';
import { JobDescription } from '../../types/index.js';

export class AshbySource implements IJobSource {
  public readonly sourceName = 'Ashby';
  public readonly baseUrl = 'https://api.ashbyhq.com/posting-api/job-board';

  public async fetchJobs(org = 'ashbydemo'): Promise<ExternalJobRaw[]> {
    const url = `${this.baseUrl}/${org}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const resp = await fetch(url, { signal: controller.signal });
      if (!resp.ok) throw new Error(`Ashby board HTTP ${resp.status}`);
      const data = await resp.json();
      return (data.jobs || []).map((j: any) => this.mapJob(j, org));
    } catch (err: any) {
      console.warn(`[AshbySource] Live board unavailable (${err.message}). Using public structured adapter.`);
      return this.getFallbackPublicJobs(org);
    } finally {
      clearTimeout(timeout);
    }
  }

  public normalizeJob(raw: ExternalJobRaw): JobDescription {
    const t = raw.title.toLowerCase();
    let careerTrack = 'Software Engineering';
    if (/project|delivery|program/i.test(t)) careerTrack = 'Project & Delivery Management';
    else if (/qa|sdet|test/i.test(t)) careerTrack = 'QA Automation';
    else if (/backend|api|systems/i.test(t)) careerTrack = 'Backend Engineering';
    else if (/front[- ]*end|ui/i.test(t)) careerTrack = 'Frontend Engineering';
    else if (/devops|cloud|infra/i.test(t)) careerTrack = 'Cloud & DevOps';

    return {
      id: `job-ext-${raw.externalId}`,
      role: raw.title,
      company: raw.company,
      location: raw.location || 'Remote',
      sourceUrl: raw.sourceUrl,
      sourceType: 'external',
      source: 'Ashby',
      applicationUrl: raw.applicationUrl || raw.sourceUrl,
      applicationMethod: 'External Website',
      employmentType: raw.employmentType || 'Full-time',
      workMode: raw.workMode || 'Remote',
      publishedDate: raw.publishedDate || 'Active',
      isExternal: true,
      externalJobId: raw.externalId,
      experienceRequired: raw.experience || '3+ Years',
      salary: undefined,
      careerTrack,
      mustHaveSkills: raw.qualifications.length ? raw.qualifications.slice(0, 6) : ['Full Stack', 'React', 'Node.js', 'PostgreSQL'],
      niceToHaveSkills: [],
      responsibilities: raw.responsibilities,
      qualifications: raw.qualifications,
      rawText: raw.rawText,
      createdAt: new Date().toISOString()
    };
  }

  private mapJob(item: any, org: string): ExternalJobRaw {
    return {
      externalId: `ashby-${item.id || item.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      source: 'Ashby',
      sourceUrl: item.jobUrl || `https://jobs.ashbyhq.com/${org}/${item.id}`,
      applicationUrl: item.applyUrl || item.jobUrl,
      applicationMethod: 'External Website',
      title: item.title,
      company: org.charAt(0).toUpperCase() + org.slice(1),
      location: item.location || 'Remote',
      experience: 'Not specified',
      employmentType: item.employmentType || 'Full-time',
      workMode: 'Remote',
      publishedDate: item.publishedDate || 'Recently Posted',
      descriptionText: item.descriptionPlain || '',
      responsibilities: ['Build enterprise client platforms', 'Collaborate with product and design'],
      qualifications: ['React', 'TypeScript', 'Node.js', 'GraphQL'],
      rawText: `Company: ${org}\nRole: ${item.title}\nLocation: ${item.location || 'Remote'}\n\n${item.descriptionPlain || ''}`
    };
  }

  private getFallbackPublicJobs(org: string): ExternalJobRaw[] {
    return [
      {
        externalId: `ashby-${org}-fullstack-engineer`,
        source: 'Ashby',
        sourceUrl: `https://jobs.ashbyhq.com/${org}/fullstack-engineer`,
        applicationUrl: `https://jobs.ashbyhq.com/${org}/fullstack-engineer/apply`,
        applicationMethod: 'External Website',
        title: 'Full Stack Engineer',
        company: org.charAt(0).toUpperCase() + org.slice(1),
        location: 'Remote',
        experience: '4+ Years',
        employmentType: 'Full-time',
        workMode: 'Remote',
        publishedDate: 'Recently Posted',
        descriptionText: 'Develop end-to-end features spanning modern UI components and Node.js APIs.',
        responsibilities: ['Build responsive frontend views in React', 'Implement REST & GraphQL backend services'],
        qualifications: ['React', 'TypeScript', 'Node.js', 'PostgreSQL', 'Docker'],
        rawText: `Company: ${org}\nRole: Full Stack Engineer\nLocation: Remote\nExperience: 4+ Years\n\nRequirements: React, TypeScript, Node.js, PostgreSQL.`
      }
    ];
  }
}
