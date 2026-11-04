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

export interface RegisterResponse {
  requiresVerification: boolean;
  email: string;
  message: string;
  cooldownSeconds?: number;
  user?: User;
  accessToken?: string;
}

export interface OtpResponse {
  message: string;
  cooldownSeconds?: number;
}

export interface ApiError {
  code: string;
  message: string;
  status?: number;
  details?: unknown;
}
