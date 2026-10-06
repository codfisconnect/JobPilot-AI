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
}

export const apiClient = new ApiClient();
