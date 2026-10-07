import type { User, AuthResponse, ApiError } from '../types/auth';
import type { CanonicalJob } from '../types/job.types';
import type {
  AdminCandidateItem,
  AdminResumeItem,
  AdminJobItem,
  AdminApplicationItem,
  AdminEmployerItem,
  AdminPaymentItem,
  AdminSubscriptionItem,
  AdminCreditsData
} from '../types/admin';

export interface ApiResponsePagination {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: ApiResponsePagination;
}

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

  private async requestPaginated<T>(endpoint: string, options: RequestInit = {}): Promise<PaginatedResponse<T>> {
    const headers = new Headers(options.headers || {});
    headers.set('Content-Type', 'application/json');

    if (this.accessToken) {
      headers.set('Authorization', `Bearer ${this.accessToken}`);
    }

    const res = await fetch(`${API_V1_BASE}${endpoint}`, {
      ...options,
      headers,
      credentials: 'include'
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok || json.success === false) {
      const error: ApiError = json.error || {
        code: `HTTP_${res.status}`,
        message: json.message || 'An unexpected error occurred'
      };
      throw error;
    }

    return {
      data: (json.data || []) as T[],
      pagination: json.pagination
    };
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
  async getCanonicalJobs(params: Record<string, any> = {}): Promise<PaginatedResponse<CanonicalJob>> {
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

  // Sprint 6 Interview Intelligence APIs
  async createInterviewSession(jobId: string, resumeVersionId?: string): Promise<any> {
    return this.request<any>(`/jobs/${jobId}/interview/sessions`, {
      method: 'POST',
      body: JSON.stringify({ resumeVersionId })
    });
  }

  async getInterviewSessions(): Promise<any[]> {
    return this.request<any[]>('/interview/sessions');
  }

  async getInterviewSessionById(sessionId: string): Promise<any> {
    return this.request<any>(`/interview/sessions/${sessionId}`);
  }

  async generateInterviewQuestions(sessionId: string, count: number = 5): Promise<any[]> {
    return this.request<any[]>(`/interview/sessions/${sessionId}/questions`, {
      method: 'POST',
      body: JSON.stringify({ count })
    });
  }

  async submitInterviewAnswer(questionId: string, answerText: string): Promise<any> {
    return this.request<any>(`/interview/questions/${questionId}/answer`, {
      method: 'POST',
      body: JSON.stringify({ answerText })
    });
  }

  async evaluateInterviewAnswer(questionId: string, answerId?: string): Promise<any> {
    return this.request<any>(`/interview/questions/${questionId}/evaluate`, {
      method: 'POST',
      body: JSON.stringify({ answerId })
    });
  }

  // Sprint 6 Career Intelligence APIs
  async getCareerProfile(targetJobId?: string): Promise<any> {
    const qs = targetJobId ? `?targetJobId=${encodeURIComponent(targetJobId)}` : '';
    return this.request<any>(`/career/profile${qs}`);
  }

  async getCareerSkills(targetJobId?: string): Promise<any> {
    const qs = targetJobId ? `?targetJobId=${encodeURIComponent(targetJobId)}` : '';
    return this.request<any>(`/career/skills${qs}`);
  }

  async getCareerLearningPlan(): Promise<any> {
    return this.request<any>('/career/learning-plan');
  }

  async createCareerLearningPlan(data: { jobId?: string; targetJobId?: string; title?: string; targetRole?: string; description?: string }): Promise<any> {
    return this.request<any>('/career/learning-plan', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateLearningPlanItem(itemId: string, data: { status?: string; loggedHours?: number; hoursSpent?: number; notes?: string; targetDate?: string }): Promise<any> {
    return this.request<any>(`/career/learning-plan/items/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  }

  // Sprint 7 Billing & Payment APIs
  async getPlans(): Promise<any[]> {
    return this.request<any[]>('/billing/plans');
  }

  async getMyBilling(): Promise<any> {
    return this.request<any>('/billing/me');
  }

  async getCredits(): Promise<{ balance: number; lifetimeGranted: number; lifetimeConsumed: number; updatedAt: string }> {
    return this.request<any>('/billing/credits');
  }

  async getLedger(limit: number = 20, offset: number = 0): Promise<{ items: any[]; total: number }> {
    return this.request<any>(`/billing/credits/ledger?limit=${limit}&offset=${offset}`);
  }

  async createCheckout(planCode: string): Promise<any> {
    return this.request<any>('/billing/checkout', {
      method: 'POST',
      body: JSON.stringify({ planCode })
    });
  }

  async verifyPayment(data: { providerOrderId: string; providerPaymentId: string; providerSignature: string }): Promise<any> {
    return this.request<any>('/billing/payments/verify', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async getPaymentHistory(): Promise<any[]> {
    return this.request<any[]>('/billing/payments');
  }

  async cancelSubscription(): Promise<any> {
    return this.request<any>('/billing/subscription/cancel', {
      method: 'POST'
    });
  }

  // Sprint 8: Employer Platform APIs
  async getEmployerOrg(): Promise<{ success: boolean; data: { organization: any; currentMember: any } }> {
    return this.request('/employer/me');
  }

  async createEmployerOrg(data: any): Promise<{ success: boolean; data: any }> {
    return this.request('/employer/organizations', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async getEmployerDashboard(): Promise<{ success: boolean; data: any }> {
    return this.request('/employer/dashboard');
  }

  async getEmployerJobs(): Promise<{ success: boolean; data: any[] }> {
    return this.request('/employer/jobs');
  }

  async createEmployerJob(data: any): Promise<{ success: boolean; data: any }> {
    return this.request('/employer/jobs', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateEmployerJobStatus(jobId: string, action: 'publish' | 'pause' | 'close'): Promise<{ success: boolean; data: any }> {
    return this.request(`/employer/jobs/${jobId}/${action}`, {
      method: 'POST'
    });
  }

  async getJobApplicants(jobId: string): Promise<{ success: boolean; data: any[] }> {
    return this.request(`/employer/jobs/${jobId}/applications`);
  }

  async getApplicantDetail(applicationId: string): Promise<{ success: boolean; data: any }> {
    return this.request(`/employer/applications/${applicationId}`);
  }

  async updateApplicantStage(applicationId: string, data: { stage: string; rating?: number; notes?: string }): Promise<{ success: boolean; data: any }> {
    return this.request(`/employer/applications/${applicationId}/stage`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  }

  async addApplicantNote(applicationId: string, data: { notes: string; rating?: number }): Promise<{ success: boolean; data: any }> {
    return this.request(`/employer/applications/${applicationId}/notes`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  // Sprint 9: AI Career Agent APIs
  async createAgentSession(title?: string): Promise<{ success: boolean; data: any }> {
    return this.request('/agent/sessions', {
      method: 'POST',
      body: JSON.stringify({ title })
    });
  }

  async getAgentSessions(): Promise<{ success: boolean; data: any[] }> {
    return this.request('/agent/sessions');
  }

  async getAgentSession(sessionId: string): Promise<{ success: boolean; data: any }> {
    return this.request(`/agent/sessions/${sessionId}`);
  }

  async sendAgentMessage(sessionId: string, message: string): Promise<{ success: boolean; data: { message: any; action?: any } }> {
    return this.request(`/agent/sessions/${sessionId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ message })
    });
  }

  async approveAgentAction(actionId: string): Promise<{ success: boolean; data: any }> {
    return this.request(`/agent/actions/${actionId}/approve`, {
      method: 'POST'
    });
  }

  async rejectAgentAction(actionId: string, reason?: string): Promise<{ success: boolean; data: any }> {
    return this.request(`/agent/actions/${actionId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    });
  }

  // Admin V1 Platform APIs
  async getAdminDashboard(): Promise<any> {
    return this.request<any>('/admin/dashboard');
  }

  async getAdminCandidates(params: { page?: number; pageSize?: number; search?: string } = {}): Promise<PaginatedResponse<AdminCandidateItem>> {
    const qs = new URLSearchParams();
    if (params.page) qs.append('page', String(params.page));
    if (params.pageSize) qs.append('pageSize', String(params.pageSize));
    if (params.search) qs.append('search', params.search);
    const query = qs.toString();
    return this.requestPaginated<AdminCandidateItem>(`/admin/candidates${query ? `?${query}` : ''}`);
  }

  async getAdminCandidateById(id: string): Promise<any> {
    return this.request<any>(`/admin/candidates/${id}`);
  }

  async getAdminResumes(params: { page?: number; pageSize?: number; search?: string; status?: string } = {}): Promise<PaginatedResponse<AdminResumeItem>> {
    const qs = new URLSearchParams();
    if (params.page) qs.append('page', String(params.page));
    if (params.pageSize) qs.append('pageSize', String(params.pageSize));
    if (params.search) qs.append('search', params.search);
    if (params.status) qs.append('status', params.status);
    const query = qs.toString();
    return this.requestPaginated<AdminResumeItem>(`/admin/resumes${query ? `?${query}` : ''}`);
  }

  async getAdminJobs(params: { page?: number; pageSize?: number; search?: string; status?: string; source?: string; company?: string } = {}): Promise<PaginatedResponse<AdminJobItem>> {
    const qs = new URLSearchParams();
    if (params.page) qs.append('page', String(params.page));
    if (params.pageSize) qs.append('pageSize', String(params.pageSize));
    if (params.search) qs.append('search', params.search);
    if (params.status) qs.append('status', params.status);
    if (params.source) qs.append('source', params.source);
    if (params.company) qs.append('company', params.company);
    const query = qs.toString();
    return this.requestPaginated<AdminJobItem>(`/admin/jobs${query ? `?${query}` : ''}`);
  }

  async getAdminApplications(params: { page?: number; pageSize?: number; search?: string; status?: string } = {}): Promise<PaginatedResponse<AdminApplicationItem>> {
    const qs = new URLSearchParams();
    if (params.page) qs.append('page', String(params.page));
    if (params.pageSize) qs.append('pageSize', String(params.pageSize));
    if (params.search) qs.append('search', params.search);
    if (params.status) qs.append('status', params.status);
    const query = qs.toString();
    return this.requestPaginated<AdminApplicationItem>(`/admin/applications${query ? `?${query}` : ''}`);
  }

  async getAdminEmployers(params: { page?: number; pageSize?: number; search?: string } = {}): Promise<PaginatedResponse<AdminEmployerItem>> {
    const qs = new URLSearchParams();
    if (params.page) qs.append('page', String(params.page));
    if (params.pageSize) qs.append('pageSize', String(params.pageSize));
    if (params.search) qs.append('search', params.search);
    const query = qs.toString();
    return this.requestPaginated<AdminEmployerItem>(`/admin/employers${query ? `?${query}` : ''}`);
  }

  async getAdminPayments(params: { page?: number; pageSize?: number; search?: string; status?: string } = {}): Promise<PaginatedResponse<AdminPaymentItem>> {
    const qs = new URLSearchParams();
    if (params.page) qs.append('page', String(params.page));
    if (params.pageSize) qs.append('pageSize', String(params.pageSize));
    if (params.search) qs.append('search', params.search);
    if (params.status) qs.append('status', params.status);
    const query = qs.toString();
    return this.requestPaginated<AdminPaymentItem>(`/admin/payments${query ? `?${query}` : ''}`);
  }

  async getAdminSubscriptions(params: { page?: number; pageSize?: number; search?: string; status?: string } = {}): Promise<PaginatedResponse<AdminSubscriptionItem>> {
    const qs = new URLSearchParams();
    if (params.page) qs.append('page', String(params.page));
    if (params.pageSize) qs.append('pageSize', String(params.pageSize));
    if (params.search) qs.append('search', params.search);
    if (params.status) qs.append('status', params.status);
    const query = qs.toString();
    return this.requestPaginated<AdminSubscriptionItem>(`/admin/subscriptions${query ? `?${query}` : ''}`);
  }

  async getAdminCredits(params: { page?: number; pageSize?: number; search?: string } = {}): Promise<{ data: AdminCreditsData; pagination: ApiResponsePagination }> {
    const qs = new URLSearchParams();
    if (params.page) qs.append('page', String(params.page));
    if (params.pageSize) qs.append('pageSize', String(params.pageSize));
    if (params.search) qs.append('search', params.search);
    const query = qs.toString();
    const res = await this.requestPaginated<never>(`/admin/credits${query ? `?${query}` : ''}`);
    return {
      data: res.data as unknown as AdminCreditsData,
      pagination: res.pagination
    };
  }

  async getAdminHealth(): Promise<any> {
    return this.request<any>('/admin/health');
  }
}

export const apiClient = new ApiClient();

