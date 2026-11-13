import {
  CandidateProfile,
  JobDescription,
  JobMatchAnalysis,
  TailoredResume,
  ApplicationRecord,
  InterviewPreparation,
  ResumeValidationResult
} from "../types/index";

const API_BASE =
  import.meta.env.VITE_API_BASE ||
  (import.meta.env.PROD
    ? 'https://api.pilotmamaglobal.in/api'
    : '/api');

function getAuthHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('pilotmama_access_token') : null;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export const api = {
  // Candidate
  getCandidates: async (): Promise<CandidateProfile[]> => {
    const res = await fetch(`${API_BASE}/candidates`, { headers: getAuthHeaders() });
    const json = await res.json();
    return json.data || [];
  },
  getCandidate: async (id: string): Promise<CandidateProfile> => {
    const res = await fetch(`${API_BASE}/candidates/${id}`, { headers: getAuthHeaders() });
    const json = await res.json();
    return json.data;
  },
  updateCandidate: async (id: string, data: CandidateProfile): Promise<CandidateProfile> => {
    const res = await fetch(`${API_BASE}/candidates/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data)
    });
    const json = await res.json();
    return json.data;
  },
  uploadResume: async (file: File): Promise<CandidateProfile> => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('pilotmama_access_token') : null;
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const formData = new FormData();
    formData.append('resume', file);
    const res = await fetch(`${API_BASE}/candidates/upload`, {
      method: 'POST',
      headers,
      body: formData
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to upload resume');
    return json.data;
  },

  // Jobs
  getJobs: async (): Promise<JobDescription[]> => {
    const res = await fetch(`${API_BASE}/jobs`);
    const json = await res.json();
    return json.data || [];
  },
  getJob: async (id: string): Promise<JobDescription> => {
    const res = await fetch(`${API_BASE}/jobs/${id}`);
    const json = await res.json();
    return json.data;
  },
  createJob: async (jobData: Partial<JobDescription>): Promise<JobDescription> => {
    const res = await fetch(`${API_BASE}/jobs`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(jobData)
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to create job');
    return json.data;
  },
  parseJob: async (rawText: string, sourceType = 'pasted', sourceUrl = ''): Promise<JobDescription> => {
    const res = await fetch(`${API_BASE}/jobs/parse`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ rawText, sourceType, sourceUrl })
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to parse job description');
    return json.data;
  },
  extractJobUrl: async (url: string): Promise<{ success: boolean; data?: JobDescription; fallbackRequired?: boolean; error?: string }> => {
    const res = await fetch(`${API_BASE}/jobs/extract-url`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ url })
    });
    return await res.json();
  },
  getJobSources: async (): Promise<any[]> => {
    const res = await fetch(`${API_BASE}/jobs/sources`);
    const json = await res.json();
    return json.data || [];
  },
  syncJobSource: async (sourceKey = 'codewalla'): Promise<{ success: boolean; data?: any; error?: string }> => {
    const res = await fetch(`${API_BASE}/jobs/sync-source`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ sourceKey })
    });
    return await res.json();
  },

  // Match Engine
  analyzeMatch: async (candidateId: string, jobId: string): Promise<JobMatchAnalysis> => {
    const res = await fetch(`${API_BASE}/match/analyze`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ candidateId, jobId })
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to analyze job match');
    return json.data;
  },
  getMatch: async (candidateId: string, jobId: string): Promise<JobMatchAnalysis | null> => {
    const res = await fetch(`${API_BASE}/match/${candidateId}/${jobId}`, { headers: getAuthHeaders() });
    const json = await res.json();
    return json.success ? json.data : null;
  },

  // Resumes
  tailorResume: async (candidateId: string, jobId: string, mode?: string): Promise<TailoredResume> => {
    const res = await fetch(`${API_BASE}/resumes/tailor`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ candidateId, jobId, mode })
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to tailor resume');
    return json.data;
  },
  validateResume: async (resumeId: string, candidateId: string): Promise<ResumeValidationResult> => {
    const res = await fetch(`${API_BASE}/resumes/validate`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ resumeId, candidateId })
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to validate resume');
    return json.data;
  },
  exportResume: async (resumeId: string, format = 'txt'): Promise<{ content: string; filename: string }> => {
    const res = await fetch(`${API_BASE}/resumes/export`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ resumeId, format })
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to export resume document');
    return json.data;
  },
  saveResumeVersion: async (version: any): Promise<any> => {
    const res = await fetch(`${API_BASE}/resumes/versions`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(version)
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to save resume version');
    return json.data;
  },
  getResumeVersions: async (candidateId: string): Promise<any[]> => {
    const res = await fetch(`${API_BASE}/resumes/versions/${candidateId}`, { headers: getAuthHeaders() });
    const json = await res.json();
    return json.success ? json.data : [];
  },
  getResumes: async (): Promise<TailoredResume[]> => {
    const res = await fetch(`${API_BASE}/resumes`, { headers: getAuthHeaders() });
    const json = await res.json();
    return json.data || [];
  },
  getResume: async (id: string): Promise<TailoredResume> => {
    const res = await fetch(`${API_BASE}/resumes/${id}`, { headers: getAuthHeaders() });
    const json = await res.json();
    return json.data;
  },

  // Applications
  getApplications: async (candidateId?: string): Promise<ApplicationRecord[]> => {
    const url = candidateId ? `${API_BASE}/applications?candidateId=${candidateId}` : `${API_BASE}/applications`;
    const res = await fetch(url, { headers: getAuthHeaders() });
    const json = await res.json();
    return json.data || [];
  },
  getApplicationDetails: async (id: string): Promise<{
    application: ApplicationRecord;
    job: JobDescription;
    tailoredResume?: TailoredResume;
    candidate: CandidateProfile;
    matchAnalysis?: JobMatchAnalysis;
  }> => {
    const res = await fetch(`${API_BASE}/applications/${id}`, { headers: getAuthHeaders() });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Application not found');
    return json.data;
  },
  saveApplication: async (app: Partial<ApplicationRecord>): Promise<ApplicationRecord> => {
    const res = await fetch(`${API_BASE}/applications`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(app)
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to save application');
    return json.data;
  },
  applyInternal: async (payload: {
    jobId: string;
    candidateId: string;
    resumeId?: string;
    resumeUrl?: string;
    screeningAnswers?: Record<string, string>;
  }): Promise<ApplicationRecord> => {
    const res = await fetch(`${API_BASE}/applications/apply-internal`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to submit internal application');
    return json.data;
  },
  trackExternal: async (payload: {
    jobId: string;
    candidateId: string;
    externalUrl: string;
    confirmedApplied?: boolean;
    sentToEmail?: boolean;
    notes?: string;
  }): Promise<ApplicationRecord> => {
    const res = await fetch(`${API_BASE}/applications/track-external`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to track external application');
    return json.data;
  },
  updateEmployerApplicationStatus: async (id: string, payload: {
    status: string;
    employerNotes?: string;
    interviewDetails?: any;
  }): Promise<ApplicationRecord> => {
    const res = await fetch(`${API_BASE}/applications/${id}/employer-status`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to update application status');
    return json.data;
  },
  getEmployerApplicants: async (companyOrEmployerId?: string): Promise<ApplicationRecord[]> => {
    const url = companyOrEmployerId ? `${API_BASE}/employer/applicants?company=${encodeURIComponent(companyOrEmployerId)}` : `${API_BASE}/employer/applicants`;
    const res = await fetch(url, { headers: getAuthHeaders() });
    const json = await res.json();
    return json.data || [];
  },

  // Company Reviews & Follows
  getCompanies: async (): Promise<any[]> => {
    const res = await fetch(`${API_BASE}/companies`);
    const json = await res.json();
    return json.data || [];
  },
  getCompanyReviews: async (companyName?: string): Promise<any[]> => {
    const url = companyName ? `${API_BASE}/companies/${encodeURIComponent(companyName)}/reviews` : `${API_BASE}/reviews`;
    const res = await fetch(url);
    const json = await res.json();
    return json.data || [];
  },
  submitCompanyReview: async (reviewData: any): Promise<any> => {
    const res = await fetch(`${API_BASE}/reviews`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(reviewData)
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to submit review');
    return json.data;
  },
  followCompany: async (candidateId: string, companyName: string): Promise<void> => {
    const res = await fetch(`${API_BASE}/companies/follow`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ candidateId, companyName })
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to follow company');
  },
  unfollowCompany: async (candidateId: string, companyName: string): Promise<void> => {
    const res = await fetch(`${API_BASE}/companies/unfollow`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ candidateId, companyName })
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to unfollow company');
  },
  getFollowedCompanies: async (candidateId: string): Promise<any[]> => {
    const res = await fetch(`${API_BASE}/companies/followed/${encodeURIComponent(candidateId)}`, { headers: getAuthHeaders() });
    const json = await res.json();
    return json.data || [];
  },

  // Job Alerts
  getJobAlerts: async (candidateId: string): Promise<any[]> => {
    const res = await fetch(`${API_BASE}/alerts?candidateId=${encodeURIComponent(candidateId)}`, { headers: getAuthHeaders() });
    const json = await res.json();
    return json.data || [];
  },
  createJobAlert: async (alertData: any): Promise<any> => {
    const res = await fetch(`${API_BASE}/alerts`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(alertData)
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to create job alert');
    return json.data;
  },
  deleteJobAlert: async (alertId: string): Promise<void> => {
    const res = await fetch(`${API_BASE}/alerts/${encodeURIComponent(alertId)}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to delete alert');
  },

  // Smart Resume Strategy
  getResumeStrategy: async (candidateId: string, jobId: string): Promise<any> => {
    const res = await fetch(`${API_BASE}/strategy/evaluate`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ candidateId, jobId })
    });
    const json = await res.json();
    return json.data;
  },

  // Interview Prep
  generateInterviewPrep: async (candidateId: string, jobId: string, resumeVersionId?: string): Promise<InterviewPreparation> => {
    const res = await fetch(`${API_BASE}/interview/generate`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ candidateId, jobId, resumeVersionId })
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to generate interview prep');
    return json.data;
  },
  getInterviewPrep: async (candidateId: string, jobId: string): Promise<InterviewPreparation | null> => {
    const res = await fetch(`${API_BASE}/interview/${candidateId}/${jobId}`, { headers: getAuthHeaders() });
    const json = await res.json();
    return json.success ? json.data : null;
  },

  // Learning & Skill Gap Engine
  getSkillGaps: async (candidateId: string): Promise<any[]> => {
    const res = await fetch(`${API_BASE}/learning/skill-gaps?candidateId=${candidateId}`, { headers: getAuthHeaders() });
    const json = await res.json();
    return json.data || [];
  },
  getLearningResources: async (skill: string, language?: string): Promise<any[]> => {
    const url = language ? `${API_BASE}/learning/resources?skill=${encodeURIComponent(skill)}&language=${encodeURIComponent(language)}` : `${API_BASE}/learning/resources?skill=${encodeURIComponent(skill)}`;
    const res = await fetch(url);
    const json = await res.json();
    return json.data || [];
  },
  getLocalInstitutes: async (city: string, skill?: string): Promise<any[]> => {
    const url = skill ? `${API_BASE}/learning/institutes?city=${encodeURIComponent(city)}&skill=${encodeURIComponent(skill)}` : `${API_BASE}/learning/institutes?city=${encodeURIComponent(city)}`;
    const res = await fetch(url);
    const json = await res.json();
    return json.data || [];
  },
  getSourceHealth: async (): Promise<any[]> => {
    const res = await fetch(`${API_BASE}/jobs/source-health`);
    const json = await res.json();
    return json.data || [];
  }
};
