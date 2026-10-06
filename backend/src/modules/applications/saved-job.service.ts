import { ApplicationRepository } from './application.repository.js';
import { CandidateProfileRepository } from '../../repositories/candidateProfile.repository.js';
import { JobRepositoryV1 } from '../../repositories/job.repository.js';
import { NotFoundError, ConflictError } from '../../utils/errors.js';

export class SavedJobService {
  private static async getCandidateProfileId(userId: string): Promise<string> {
    const profile = await CandidateProfileRepository.findByUserId(userId);
    if (!profile) {
      throw new NotFoundError('Candidate profile not found for authenticated user');
    }
    return profile.id;
  }

  public static async listSavedJobs(userId: string) {
    const candidateProfileId = await this.getCandidateProfileId(userId);
    return ApplicationRepository.getSavedJobs(candidateProfileId);
  }

  public static async saveJob(userId: string, jobId: string, notes?: string) {
    const candidateProfileId = await this.getCandidateProfileId(userId);

    const job = await JobRepositoryV1.findById(jobId);
    if (!job) {
      throw new NotFoundError(`Job not found with ID '${jobId}'`);
    }

    const existing = await ApplicationRepository.findSavedJob(candidateProfileId, jobId);
    if (existing) {
      throw new ConflictError('Job is already saved by this candidate');
    }

    return ApplicationRepository.createSavedJob(candidateProfileId, jobId, notes);
  }

  public static async removeSavedJob(userId: string, jobId: string) {
    const candidateProfileId = await this.getCandidateProfileId(userId);

    const existing = await ApplicationRepository.findSavedJob(candidateProfileId, jobId);
    if (!existing) {
      throw new NotFoundError('Saved job record not found');
    }

    await ApplicationRepository.deleteSavedJob(candidateProfileId, jobId);
    return { success: true, message: 'Saved job removed successfully' };
  }
}
