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
    phone?: string;
    location?: string;
    designation?: string;
    experience?: number;
  } | null;
  employerProfile?: {
    id: string;
    companyName: string;
    website?: string;
    industry?: string;
    companySize?: string;
  } | null;
}

export interface CandidateRegistrationData {
  role?: 'CANDIDATE';
  fullName: string;
  email: string;
  phone: string;
  password: string;
  location: string;
  experience: number | string;
  designation: string;
}

export interface EmployerRegistrationData {
  role?: 'EMPLOYER';
  fullName: string; // Contact person's name
  email: string; // Work email
  phone: string; // Mobile number
  password: string;
  companyName: string;
  companyWebsite: string;
  industry: string;
  companySize: string;
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
