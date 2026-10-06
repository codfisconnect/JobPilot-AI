import type { User, AuthResponse, ApiError } from '../types/auth';

const API_V1_BASE = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? 'https://jobpilot-ai-backend-a8h6.onrender.com/api/v1' : '/api/v1');

class ApiClient {
  private accessToken: string | null = null;

  setToken(token: string | null) {
    this.accessToken = token;
  }

  getToken(): string | null {
    return this.accessToken;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers = new Headers(options.headers || {});
    headers.set('Content-Type', 'application/json');

    if (this.accessToken) {
      headers.set('Authorization', `Bearer ${this.accessToken}`);
    }

    const res = await fetch(`${API_V1_BASE}${endpoint}`, {
      ...options,
      headers,
      credentials: 'include' // Important for HttpOnly refresh cookie exchange
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok || json.success === false) {
      const error: ApiError = json.error || {
        code: `HTTP_${res.status}`,
        message: json.message || 'An unexpected error occurred'
      };
      throw error;
    }

    return json.data as T;
  }

  // Authentication API methods
  async register(data: { email: string; password: string; fullName?: string; role?: string }): Promise<AuthResponse> {
    const res = await this.request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    this.setToken(res.accessToken);
    return res;
  }

  async login(data: { email: string; password: string }): Promise<AuthResponse> {
    const res = await this.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    this.setToken(res.accessToken);
    return res;
  }

  private refreshPromise: Promise<AuthResponse> | null = null;

  async refresh(): Promise<AuthResponse> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.request<AuthResponse>('/auth/refresh', {
      method: 'POST'
    })
      .then(res => {
        this.setToken(res.accessToken);
        return res;
      })
      .finally(() => {
        this.refreshPromise = null;
      });

    return this.refreshPromise;
  }

  async logout(): Promise<void> {
    try {
      await this.request<{ message: string }>('/auth/logout', {
        method: 'POST'
      });
    } finally {
      this.setToken(null);
    }
  }

  async getMe(): Promise<User> {
    const res = await this.request<{ user: User }>('/auth/me');
    return res.user;
  }

  async getHealth(): Promise<any> {
    return this.request<any>('/health');
  }

  // Candidate Profile V1 APIs
  async getCandidateProfile(): Promise<any> {
    return this.request<any>('/candidates/me');
  }

  async updateCandidateProfile(data: any): Promise<any> {
    return this.request<any>('/candidates/me', {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  }

  async getCandidatePreferences(): Promise<any> {
    return this.request<any>('/candidates/me/preferences');
  }

  async updateCandidatePreferences(data: any): Promise<any> {
    return this.request<any>('/candidates/me/preferences', {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  }

  // Experience V1
  async addExperience(data: any): Promise<any> {
    return this.request<any>('/candidates/me/experiences', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateExperience(id: string, data: any): Promise<any> {
    return this.request<any>(`/candidates/me/experiences/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  }

  async deleteExperience(id: string): Promise<any> {
    return this.request<any>(`/candidates/me/experiences/${id}`, {
      method: 'DELETE'
    });
  }

  // Education V1
  async addEducation(data: any): Promise<any> {
    return this.request<any>('/candidates/me/educations', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateEducation(id: string, data: any): Promise<any> {
    return this.request<any>(`/candidates/me/educations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  }

  async deleteEducation(id: string): Promise<any> {
    return this.request<any>(`/candidates/me/educations/${id}`, {
      method: 'DELETE'
    });
  }

  // Skills V1
  async addSkill(data: any): Promise<any> {
    return this.request<any>('/candidates/me/skills', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async deleteSkill(id: string): Promise<any> {
    return this.request<any>(`/candidates/me/skills/${id}`, {
      method: 'DELETE'
    });
  }

  // Certifications V1
  async addCertification(data: any): Promise<any> {
    return this.request<any>('/candidates/me/certifications', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async deleteCertification(id: string): Promise<any> {
    return this.request<any>(`/candidates/me/certifications/${id}`, {
      method: 'DELETE'
    });
  }

  // Projects V1
  async addProject(data: any): Promise<any> {
    return this.request<any>('/candidates/me/projects', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async deleteProject(id: string): Promise<any> {
    return this.request<any>(`/candidates/me/projects/${id}`, {
      method: 'DELETE'
    });
  }

  // Resumes V1
  async listResumes(): Promise<any[]> {
    return this.request<any[]>('/resumes');
  }

  async deleteResume(id: string): Promise<any> {
    return this.request<any>(`/resumes/${id}`, {
      method: 'DELETE'
    });
  }

  async uploadResume(file: File, title?: string): Promise<any> {
    const formData = new FormData();
    formData.append('resume', file);
    if (title) formData.append('title', title);

    const headers = new Headers();
    if (this.accessToken) {
      headers.set('Authorization', `Bearer ${this.accessToken}`);
    }

    const res = await fetch(`${API_V1_BASE}/resumes`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: formData
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.success === false) {
      throw json.error || { code: `HTTP_${res.status}`, message: json.message || 'Upload failed' };
    }
    return json.data;
  }

  async parseResume(id: string): Promise<any> {
    return this.request<any>(`/resumes/${id}/parse`, {
      method: 'POST'
    });
  }

  async confirmParsedResume(id: string, confirmedData: any): Promise<any> {
    return this.request<any>(`/resumes/${id}/confirm`, {
      method: 'POST',
      body: JSON.stringify(confirmedData)
    });
  }

  async listResumeVersions(resumeId: string): Promise<any[]> {
    return this.request<any[]>(`/resumes/${resumeId}/versions`);
  }

  async createResumeVersion(resumeId: string, title?: string): Promise<any> {
    return this.request<any>(`/resumes/${resumeId}/versions`, {
      method: 'POST',
      body: JSON.stringify({ title })
    });
  }

  async getResumeVersion(versionId: string): Promise<any> {
    return this.request<any>(`/resume-versions/${versionId}`);
  }

  // Sprint 3 Canonical Job Engine Methods
  async getCanonicalJobs(params: Record<string, any> = {}): Promise<{ data: any[]; pagination: any }> {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        query.append(k, String(v));
      }
    });
    const qs = query.toString();
    const headers = new Headers();
    if (this.accessToken) {
      headers.set('Authorization', `Bearer ${this.accessToken}`);
    }
    const res = await fetch(`${API_V1_BASE}/jobs${qs ? `?${qs}` : ''}`, {
      headers,
      credentials: 'include'
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.success === false) {
      throw json.error || new Error(json.message || 'Failed to fetch jobs');
    }
    return { data: json.data || [], pagination: json.pagination };
  }

  async getCanonicalJobById(id: string): Promise<any> {
    return this.request<any>(`/jobs/${id}`);
  }

  async syncJobs(sourceType?: string): Promise<any> {
    return this.request<any>('/jobs/sync', {
      method: 'POST',
      body: JSON.stringify({ sourceType })
    });
  }

  // Sprint 4 Job Matching, Skill Gap & AI Tailoring APIs
  async getJobMatch(jobId: string): Promise<any> {
    return this.request<any>(`/jobs/${jobId}/match`);
  }

  async recalculateJobMatch(jobId: string): Promise<any> {
    return this.request<any>(`/jobs/${jobId}/match/recalculate`, {
      method: 'POST'
    });
  }

  async getJobSkillGap(jobId: string): Promise<any> {
    return this.request<any>(`/jobs/${jobId}/skill-gap`);
  }

  async tailorResume(jobId: string, mode: 'FULL' | 'FOCUSED' | 'TARGETED' = 'TARGETED'): Promise<any> {
    return this.request<any>(`/jobs/${jobId}/tailor-resume`, {
      method: 'POST',
      body: JSON.stringify({ mode })
    });
  }

  async getTailoredResumes(jobId: string): Promise<any[]> {
    return this.request<any[]>(`/jobs/${jobId}/tailored-resumes`);
  }

  // Sprint 5 Application Intelligence & Saved Jobs APIs
  async listApplications(params: { status?: string; search?: string; page?: number; pageSize?: number } = {}): Promise<{ data: any[]; pagination: any }> {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        query.append(k, String(v));
      }
    });
    const qs = query.toString();
    const headers = new Headers();
    if (this.accessToken) {
      headers.set('Authorization', `Bearer ${this.accessToken}`);
    }
    const res = await fetch(`${API_V1_BASE}/applications${qs ? `?${qs}` : ''}`, {
      headers,
      credentials: 'include'
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.success === false) {
      throw json.error || new Error(json.message || 'Failed to fetch applications');
    }
    return { data: json.data || [], pagination: json.pagination };
  }

  async getApplicationById(id: string): Promise<any> {
    return this.request<any>(`/applications/${id}`);
  }

  async createApplication(data: { jobId: string; resumeVersionId?: string; status?: string; externalUrl?: string; notesSummary?: string }): Promise<any> {
    return this.request<any>('/applications', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateApplication(id: string, data: any): Promise<any> {
    return this.request<any>(`/applications/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  }

  async deleteApplication(id: string): Promise<any> {
    return this.request<any>(`/applications/${id}`, {
      method: 'DELETE'
    });
  }

  async updateApplicationStatus(id: string, status: string, reason?: string): Promise<any> {
    return this.request<any>(`/applications/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ status, reason })
    });
  }

  async getApplicationStatusHistory(id: string): Promise<any[]> {
    return this.request<any[]>(`/applications/${id}/history`);
  }

  async getApplicationNotes(id: string): Promise<any[]> {
    return this.request<any[]>(`/applications/${id}/notes`);
  }

  async addApplicationNote(id: string, content: string): Promise<any> {
    return this.request<any>(`/applications/${id}/notes`, {
      method: 'POST',
      body: JSON.stringify({ content })
    });
  }

  async deleteApplicationNote(id: string, noteId: string): Promise<any> {
    return this.request<any>(`/applications/${id}/notes/${noteId}`, {
      method: 'DELETE'
    });
  }

  async getApplicationReminders(id: string): Promise<any[]> {
    return this.request<any[]>(`/applications/${id}/reminders`);
  }

  async addApplicationReminder(id: string, title: string, dueDate: string): Promise<any> {
    return this.request<any>(`/applications/${id}/reminders`, {
      method: 'POST',
      body: JSON.stringify({ title, dueDate })
    });
  }

  async deleteApplicationReminder(id: string, reminderId: string): Promise<any> {
    return this.request<any>(`/applications/${id}/reminders/${reminderId}`, {
      method: 'DELETE'
    });
  }

  async getApplicationStats(): Promise<any> {
    return this.request<any>('/applications/stats');
  }

  async listSavedJobs(): Promise<any[]> {
    return this.request<any[]>('/saved-jobs');
  }

  async saveJob(jobId: string, notes?: string): Promise<any> {
    return this.request<any>(`/saved-jobs/${jobId}`, {
      method: 'POST',
      body: JSON.stringify({ notes })
    });
  }

  async removeSavedJob(jobId: string): Promise<any> {
    return this.request<any>(`/saved-jobs/${jobId}`, {
      method: 'DELETE'
    });
  }
}

export const apiClient = new ApiClient();


