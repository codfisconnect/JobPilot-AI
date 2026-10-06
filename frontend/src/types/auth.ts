export interface User {
  id: string;
  email: string;
  role: 'CANDIDATE' | 'EMPLOYER' | 'INSTITUTE' | 'ADMIN';
  isActive: boolean;
  emailVerified: boolean;
  createdAt: string;
  candidateProfile?: {
    id: string;
    fullName: string;
  } | null;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}
