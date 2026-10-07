import { EmployerRepository } from './employer.repository.js';
import {
  NotFoundError,
  ForbiddenError,
  ValidationError
} from '../../utils/errors.js';
import {
  EmployerRole,
  EmployerJobStatus,
  EmployerApplicationStage
} from '@prisma/client';
import type {
  CreateOrganizationInput,
  CreateEmployerJobInput,
  UpdateEmployerJobInput
} from './employer.schemas.js';

export class EmployerService {
  constructor(private repo: EmployerRepository = new EmployerRepository()) {}

  /**
   * Resolve authenticated user's organization context
   */
  async requireEmployerContext(userId: string) {
    const member = await this.repo.findMemberByUserId(userId);
    if (!member) {
      throw new ForbiddenError('User is not associated with an employer organization');
    }
    return member;
  }

  /**
   * Onboard or create employer organization
   */
  async createOrganization(userId: string, input: CreateOrganizationInput) {
    const existingMember = await this.repo.findMemberByUserId(userId);
    if (existingMember) {
      throw new ValidationError('User is already a member of an employer organization');
    }

    const slug = input.name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') + '-' + Math.floor(1000 + Math.random() * 9000);

    return this.repo.createOrganization(userId, {
      ...input,
      slug
    });
  }

  /**
   * Get organization profile and member info
   */
  async getMyOrganization(userId: string) {
    const member = await this.requireEmployerContext(userId);
    const org = await this.repo.findOrganizationById(member.organizationId);
    if (!org) {
      throw new NotFoundError('Employer organization not found');
    }
    return {
      organization: org,
      currentMember: member
    };
  }

  /**
   * Employer dashboard overview metrics
   */
  async getDashboardMetrics(userId: string) {
    const member = await this.requireEmployerContext(userId);
    return this.repo.getDashboardMetrics(member.organizationId);
  }

  /**
   * List jobs for organization
   */
  async listJobs(userId: string) {
    const member = await this.requireEmployerContext(userId);
    return this.repo.listOrganizationJobs(member.organizationId);
  }

  /**
   * Create employer job
   */
  async createJob(userId: string, input: CreateEmployerJobInput) {
    const member = await this.requireEmployerContext(userId);
    const org = await this.repo.findOrganizationById(member.organizationId);
    if (!org || !org.companyId) {
      throw new ValidationError('Organization must have an attached company profile to create jobs');
    }

    return this.repo.createEmployerJob(member.organizationId, org.companyId, input);
  }

  /**
   * Get job details
   */
  async getJob(userId: string, jobId: string) {
    const member = await this.requireEmployerContext(userId);
    const job = await this.repo.findOrganizationJob(member.organizationId, jobId);
    if (!job) {
      throw new NotFoundError('Job not found in your organization');
    }
    return job;
  }

  /**
   * Update employer job
   */
  async updateJob(userId: string, jobId: string, input: UpdateEmployerJobInput) {
    const member = await this.requireEmployerContext(userId);
    const job = await this.repo.findOrganizationJob(member.organizationId, jobId);
    if (!job) {
      throw new NotFoundError('Job not found in your organization');
    }

    return this.repo.updateEmployerJob(member.organizationId, jobId, input);
  }

  /**
   * Change job status (PUBLISHED, PAUSED, CLOSED)
   */
  async updateJobStatus(userId: string, jobId: string, status: EmployerJobStatus) {
    const member = await this.requireEmployerContext(userId);
    const job = await this.repo.findOrganizationJob(member.organizationId, jobId);
    if (!job) {
      throw new NotFoundError('Job not found in your organization');
    }

    return this.repo.updateJobLifecycleStatus(member.organizationId, jobId, status);
  }

  /**
   * List applicants for a specific organization job
   */
  async listJobApplications(userId: string, jobId: string) {
    const member = await this.requireEmployerContext(userId);
    const job = await this.repo.findOrganizationJob(member.organizationId, jobId);
    if (!job) {
      throw new NotFoundError('Job not found in your organization');
    }

    return this.repo.listJobApplications(member.organizationId, jobId);
  }

  /**
   * Get application detail for applicant
   */
  async getApplicationDetail(userId: string, applicationId: string) {
    const member = await this.requireEmployerContext(userId);
    const application = await this.repo.findApplicationDetail(member.organizationId, applicationId);
    if (!application) {
      throw new NotFoundError('Application not found or unauthorized');
    }
    return application;
  }

  /**
   * Advance candidate application stage
   */
  async updateApplicationStage(
    userId: string,
    applicationId: string,
    data: { stage: EmployerApplicationStage; rating?: number; notes?: string }
  ) {
    const member = await this.requireEmployerContext(userId);
    const application = await this.repo.findApplicationDetail(member.organizationId, applicationId);
    if (!application) {
      throw new NotFoundError('Application not found or unauthorized');
    }

    return this.repo.recordApplicationReview(applicationId, userId, data);
  }

  /**
   * Add internal recruiter notes/rating
   */
  async addApplicationNote(
    userId: string,
    applicationId: string,
    data: { notes: string; rating?: number }
  ) {
    const member = await this.requireEmployerContext(userId);
    const application = await this.repo.findApplicationDetail(member.organizationId, applicationId);
    if (!application) {
      throw new NotFoundError('Application not found or unauthorized');
    }

    return this.repo.recordApplicationReview(applicationId, userId, {
      notes: data.notes,
      rating: data.rating
    });
  }
}
