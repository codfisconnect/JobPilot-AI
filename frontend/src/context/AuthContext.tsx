import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { User, ApiError } from '../types/auth';
import { apiClient } from '../api/client';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: { email: string; password: string }) => Promise<User>;
  register: (data: { email: string; password: string; fullName?: string }) => Promise<User>;
  logout: () => Promise<void>;
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

  const login = useCallback(async (credentials: { email: string; password: string }) => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await apiClient.login(credentials);
      setUser(res.user);
      return res.user;
    } catch (err: any) {
      const apiErr = err as ApiError;
      const msg = apiErr.message || 'Invalid email or password';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const register = useCallback(async (data: { email: string; password: string; fullName?: string }) => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await apiClient.register(data);
      setUser(res.user);
      return res.user;
    } catch (err: any) {
      const apiErr = err as ApiError;
      const msg = apiErr.message || 'Registration failed';
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
        logout,
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
