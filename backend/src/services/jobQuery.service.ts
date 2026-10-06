import { JobRepositoryV1, JobFilterParams } from '../repositories/job.repository.js';
import { CompanyRepository } from '../repositories/company.repository.js';
import { AppError } from '../utils/errors.js';

export class JobQueryService {
  /**
   * Search and filter canonical jobs
   */
  public static async searchJobs(params: JobFilterParams) {
    return JobRepositoryV1.searchJobs(params);
  }

  /**
   * Get job by ID with sanitized details and company info
   */
  public static async getJobById(id: string) {
    const job = await JobRepositoryV1.findById(id);
    if (!job) {
      throw new AppError('Job not found', 404, 'NOT_FOUND');
    }

    // Format safe response structure
    return {
      id: job.id,
      title: job.title,
      company: {
        id: job.company.id,
        name: job.company.name,
        officialDomain: job.company.officialDomain,
        careersUrl: job.company.careersUrl,
        industry: job.company.industry,
        country: job.company.country,
        description: job.company.description,
        logoUrl: job.company.logoUrl
      },
      description: job.description,
      responsibilities: job.responsibilities,
      requirements: job.requirements,
      preferredQualifications: job.preferredQualifications,
      location: job.location,
      country: job.country,
      city: job.city,
      stateProvince: job.stateProvince,
      remoteType: job.remoteType,
      employmentType: job.employmentType,
      salaryMin: job.salaryMin ? Number(job.salaryMin) : null,
      salaryMax: job.salaryMax ? Number(job.salaryMax) : null,
      salaryCurrency: job.salaryCurrency,
      experienceMin: job.experienceMin,
      experienceMax: job.experienceMax,
      education: job.education,
      postedAt: job.postedAt,
      firstSeenAt: job.firstSeenAt,
      lastSeenAt: job.lastSeenAt,
      status: job.status,
      sourceType: job.sourceType,
      sourceName: job.sourceName,
      sourceUrl: job.sourceUrl,
      applicationUrl: job.applicationUrl || job.sourceUrl,
      skills: job.skills.map(s => ({
        id: s.skill.id,
        name: s.skill.name,
        category: s.skill.category,
        type: s.skillType
      }))
    };
  }

  /**
   * Get list of canonical companies
   */
  public static async getCompanies(limit = 100) {
    return CompanyRepository.getAllCompanies(limit);
  }

  /**
   * Get company details with associated sources and jobs count
   */
  public static async getCompanyById(id: string) {
    const company = await CompanyRepository.getCompanyWithSources(id);
    if (!company) {
      throw new AppError('Company not found', 404, 'NOT_FOUND');
    }
    return company;
  }
}
