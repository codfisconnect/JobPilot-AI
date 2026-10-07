import { adminRepository } from './admin.repository.js';
import { checkDatabaseConnection } from '../../database/prisma.js';
import { env } from '../../config/env.js';
import { NotFoundError } from '../../utils/errors.js';

export class AdminService {
  async getDashboardMetrics() {
    return adminRepository.getDashboardMetrics();
  }

  async getCandidates(params: { page: number; pageSize: number; search?: string }) {
    return adminRepository.getCandidates(params);
  }

  async getCandidateById(id: string) {
    const candidate = await adminRepository.getCandidateById(id);
    if (!candidate) {
      throw new NotFoundError(`Candidate with ID '${id}' not found`);
    }
    return candidate;
  }

  async getResumes(params: { page: number; pageSize: number; search?: string; status?: string }) {
    return adminRepository.getResumes(params);
  }

  async getJobs(params: { page: number; pageSize: number; search?: string; status?: string; source?: string; company?: string }) {
    return adminRepository.getJobs(params);
  }

  async getApplications(params: { page: number; pageSize: number; search?: string; status?: string }) {
    return adminRepository.getApplications(params);
  }

  async getEmployers(params: { page: number; pageSize: number; search?: string }) {
    return adminRepository.getEmployers(params);
  }

  async getPayments(params: { page: number; pageSize: number; search?: string; status?: string }) {
    return adminRepository.getPayments(params);
  }

  async getSubscriptions(params: { page: number; pageSize: number; search?: string; status?: string }) {
    return adminRepository.getSubscriptions(params);
  }

  async getCredits(params: { page: number; pageSize: number; search?: string }) {
    return adminRepository.getCredits(params);
  }

  async getSystemHealth() {
    const dbHealth = await checkDatabaseConnection();
    return {
      status: dbHealth.connected ? 'healthy' : 'degraded',
      environment: env.NODE_ENV,
      database: {
        engine: 'PostgreSQL',
        connected: dbHealth.connected,
        latencyMs: dbHealth.latencyMs,
        error: dbHealth.error
      },
      uptimeSeconds: Math.floor(process.uptime()),
      nodeVersion: process.version,
      memoryUsageMb: Math.round(process.memoryUsage().rss / (1024 * 1024)),
      timestamp: new Date().toISOString()
    };
  }
}

export const adminService = new AdminService();
