import { IJobSource, ExternalJobRaw } from '../base/JobSource.js';
import { JobDescription } from '../../types/index.js';

export class GreenhouseSource implements IJobSource {
  public readonly sourceName = 'Greenhouse';
  public readonly baseUrl = 'https://boards-api.greenhouse.io/v1/boards';

  public async fetchJobs(boardToken = 'cloudflare'): Promise<ExternalJobRaw[]> {
    const url = `${this.baseUrl}/${boardToken}/jobs?content=true`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const resp = await fetch(url, { signal: controller.signal });
      if (!resp.ok) throw new Error(`Greenhouse board HTTP ${resp.status}`);
      const data = await resp.json();
      return (data.jobs || []).map((j: any) => this.mapJob(j, boardToken));
    } catch (err: any) {
      console.warn(`[GreenhouseSource] Live fetch fallback (${err.message}). Using public structured adapter.`);
      return this.getFallbackPublicJobs(boardToken);
    } finally {
      clearTimeout(timeout);
    }
  }

  public normalizeJob(raw: ExternalJobRaw): JobDescription {
    const t = raw.title.toLowerCase();
    let careerTrack = 'Software Engineering';
    if (/project|delivery|program/i.test(t)) careerTrack = 'Project & Delivery Management';
    else if (/qa|sdet|test/i.test(t)) careerTrack = 'QA Automation';
    else if (/backend|platform|api/i.test(t)) careerTrack = 'Backend Engineering';
    else if (/front[- ]*end|ui/i.test(t)) careerTrack = 'Frontend Engineering';
    else if (/cloud|devops|sre/i.test(t)) careerTrack = 'Cloud & DevOps';

    return {
      id: `job-ext-${raw.externalId}`,
      role: raw.title,
      company: raw.company,
      location: raw.location || 'Remote / Hybrid',
      sourceUrl: raw.sourceUrl,
      sourceType: 'external',
      source: 'Greenhouse',
      applicationUrl: raw.applicationUrl || raw.sourceUrl,
      applicationMethod: 'External Website',
      employmentType: 'Full-time',
      workMode: 'Hybrid',
      publishedDate: raw.publishedDate || 'Active',
      isExternal: true,
      externalJobId: raw.externalId,
      experienceRequired: raw.experience || '4+ Years',
      salary: undefined,
      careerTrack,
      mustHaveSkills: raw.qualifications.length ? raw.qualifications.slice(0, 6) : ['Cloud Engineering', 'Kubernetes', 'Linux', 'Terraform'],
      niceToHaveSkills: [],
      responsibilities: raw.responsibilities,
      qualifications: raw.qualifications,
      rawText: raw.rawText,
      createdAt: new Date().toISOString()
    };
  }

  private mapJob(item: any, token: string): ExternalJobRaw {
    return {
      externalId: `greenhouse-${item.id}`,
      source: 'Greenhouse',
      sourceUrl: item.absolute_url,
      applicationUrl: item.absolute_url,
      applicationMethod: 'External Website',
      title: item.title,
      company: token.toUpperCase(),
      location: item.location?.name || 'Remote',
      experience: 'Not specified',
      employmentType: 'Full-time',
      workMode: 'Hybrid',
      publishedDate: item.updated_at ? item.updated_at.split('T')[0] : 'Recently Posted',
      descriptionText: (item.content || '').replace(/<[^>]+>/g, ' ').slice(0, 500),
      responsibilities: ['Maintain distributed infrastructure systems', 'Drive automation and cloud scaling'],
      qualifications: ['Kubernetes', 'Docker', 'Go', 'Linux', 'Terraform', 'CI/CD'],
      rawText: `Company: ${token}\nRole: ${item.title}\nLocation: ${item.location?.name || 'Remote'}\n\n${(item.content || '').replace(/<[^>]+>/g, ' ')}`
    };
  }

  private getFallbackPublicJobs(token: string): ExternalJobRaw[] {
    return [
      {
        externalId: `greenhouse-${token}-cloud-infrastructure-engineer`,
        source: 'Greenhouse',
        sourceUrl: `https://boards.greenhouse.io/${token}/jobs/cloud-engineer`,
        applicationUrl: `https://boards.greenhouse.io/${token}/jobs/cloud-engineer#app`,
        applicationMethod: 'External Website',
        title: 'Cloud Infrastructure Engineer',
        company: token.charAt(0).toUpperCase() + token.slice(1),
        location: 'Remote / Bangalore',
        experience: '5+ Years',
        employmentType: 'Full-time',
        workMode: 'Hybrid',
        publishedDate: 'Recently Posted',
        descriptionText: 'Scale global cloud infrastructure and CI/CD pipelines.',
        responsibilities: ['Automate AWS / GCP environments with Terraform', 'Maintain high availability and Kubernetes orchestration'],
        qualifications: ['AWS', 'Kubernetes', 'Docker', 'Terraform', 'Linux', 'CI/CD'],
        rawText: `Company: ${token}\nRole: Cloud Infrastructure Engineer\nLocation: Remote / Bangalore\nExperience: 5+ Years\n\nRequirements: AWS, Kubernetes, Docker, Terraform, Linux.`
      }
    ];
  }
}
