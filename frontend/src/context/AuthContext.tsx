import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { User, ApiError, RegisterResponse, OtpResponse } from '../types/auth';
import { apiClient } from '../api/client';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: { email: string; password?: string; code?: string }) => Promise<any>;
  register: (data: { email: string; password: string; fullName?: string }) => Promise<RegisterResponse>;
  verifyOtp: (data: { email: string; code: string; purpose?: string; newPassword?: string }) => Promise<User>;
  requestOtp: (data: { email: string; purpose?: string }) => Promise<OtpResponse>;
  resendOtp: (data: { email: string; purpose?: string }) => Promise<OtpResponse>;
  resetPassword: (data: { email: string; code: string; newPassword: string }) => Promise<{ message: string }>;
  loginWithGoogle: (credentialOrCode: string | { credential?: string; code?: string; redirectUri?: string }) => Promise<User>;
  loginWithLinkedIn: (tokenOrCode: string | { token?: string; code?: string; redirectUri?: string }) => Promise<User>;
  logout: () => Promise<void>;
  updateUserProfile: (updatedFields: { fullName?: string }) => void;
  error: string | null;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Session bootstrap: attempt silent token refresh via HttpOnly cookie
  useEffect(() => {
    let mounted = true;

    async function bootstrapSession() {
      try {
        const authRes = await apiClient.refresh();
        if (mounted && authRes?.user) {
          setUser(authRes.user);
        }
      } catch {
        // Unauthenticated session - perfectly normal on first visit
        if (mounted) {
          setUser(null);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    bootstrapSession();

    return () => {
      mounted = false;
    };
  }, []);

  const updateUserProfile = useCallback((updatedFields: { fullName?: string }) => {
    setUser(prevUser => {
      if (!prevUser) return null;
      return {
        ...prevUser,
        candidateProfile: prevUser.candidateProfile
          ? {
              ...prevUser.candidateProfile,
              fullName: updatedFields.fullName !== undefined ? updatedFields.fullName : prevUser.candidateProfile.fullName
            }
          : updatedFields.fullName
            ? { id: 'temp-profile', fullName: updatedFields.fullName }
            : null
      };
    });
  }, []);

  const login = useCallback(async (credentials: { email: string; password?: string; code?: string }) => {
    try {
      setError(null);
      const res = await apiClient.login(credentials);
      if (res.user) {
        setUser(res.user);
      }
      return res;
    } catch (err: any) {
      const apiErr = err as ApiError;
      const msg = apiErr.message || 'Invalid email or password';
      setError(msg);
      throw err;
    }
  }, []);

  const register = useCallback(async (data: { email: string; password: string; fullName?: string }) => {
    try {
      setError(null);
      const res = await apiClient.register(data);
      if (res.user) {
        setUser(res.user);
      }
      return res;
    } catch (err: any) {
      const apiErr = err as ApiError;
      const msg = apiErr.message || 'Registration failed';
      setError(msg);
      throw err;
    }
  }, []);

  const verifyOtp = useCallback(async (data: { email: string; code: string; purpose?: string; newPassword?: string }) => {
    try {
      setError(null);
      const res = await apiClient.verifyOtp(data);
      if (res.user) {
        setUser(res.user);
      }
      return res.user;
    } catch (err: any) {
      const apiErr = err as ApiError;
      const msg = apiErr.message || 'Verification failed';
      setError(msg);
      throw err;
    }
  }, []);

  const requestOtp = useCallback(async (data: { email: string; purpose?: string }) => {
    try {
      setError(null);
      return await apiClient.requestOtp(data);
    } catch (err: any) {
      const apiErr = err as ApiError;
      const msg = apiErr.message || 'Failed to send verification code';
      setError(msg);
      throw err;
    }
  }, []);

  const resendOtp = useCallback(async (data: { email: string; purpose?: string }) => {
    try {
      setError(null);
      return await apiClient.resendOtp(data);
    } catch (err: any) {
      const apiErr = err as ApiError;
      const msg = apiErr.message || 'Failed to resend verification code';
      setError(msg);
      throw err;
    }
  }, []);

  const resetPassword = useCallback(async (data: { email: string; code: string; newPassword: string }) => {
    try {
      setIsLoading(true);
      setError(null);
      return await apiClient.resetPassword(data);
    } catch (err: any) {
      const apiErr = err as ApiError;
      const msg = apiErr.message || 'Password reset failed';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loginWithGoogle = useCallback(async (payload: string | { credential?: string; code?: string; redirectUri?: string }) => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await apiClient.loginWithGoogle(payload);
      setUser(res.user);
      return res.user;
    } catch (err: any) {
      const apiErr = err as ApiError;
      const msg = apiErr.message || 'Google sign-in is temporarily unavailable. Please use email sign-in.';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loginWithLinkedIn = useCallback(async (payload: string | { token?: string; code?: string; redirectUri?: string }) => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await apiClient.loginWithLinkedIn(payload);
      setUser(res.user);
      return res.user;
    } catch (err: any) {
      const apiErr = err as ApiError;
      const msg = apiErr.message || 'LinkedIn sign-in is temporarily unavailable. Please use email sign-in.';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      setIsLoading(true);
      await apiClient.logout();
    } catch {
      // Ignore network errors during logout
    } finally {
      setUser(null);
      setIsLoading(false);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: Boolean(user),
        isLoading,
        login,
        register,
        verifyOtp,
        requestOtp,
        resendOtp,
        resetPassword,
        loginWithGoogle,
        loginWithLinkedIn,
        logout,
        updateUserProfile,
        error,
        clearError
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
