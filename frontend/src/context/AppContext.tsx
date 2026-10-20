import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { CandidateProfile } from "../types/index";
import { apiClient } from "../api/client";
import { api } from "../api/index";
import { useAuth } from './AuthContext';

interface AppContextType {
  activeCandidate: CandidateProfile | null;
  candidates: CandidateProfile[];
  setActiveCandidate: (candidate: CandidateProfile) => void;
  updateActiveCandidate: (updated: Partial<CandidateProfile>) => void;
  refreshCandidates: () => Promise<void>;
  isLoading: boolean;
  toastMessage: string | null;
  showToast: (msg: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const [candidates, setCandidates] = useState<CandidateProfile[]>([]);
  const [activeCandidate, setActiveCandidate] = useState<CandidateProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const updateActiveCandidate = useCallback((updated: Partial<CandidateProfile>) => {
    setActiveCandidate(prev => {
      if (!prev) return null;
      const nextCandidate = { ...prev, ...updated };
      setCandidates(prevList =>
        prevList.map(c => (c.id === nextCandidate.id ? nextCandidate : c))
      );
      return nextCandidate;
    });
  }, []);

  const setActiveAndPersistCandidate = (candidate: CandidateProfile) => {
    setActiveCandidate(candidate);
    try {
      localStorage.setItem('jobpilot_active_candidate_id', candidate.id);
    } catch (e) {
      console.warn('Failed to save active candidate to localStorage', e);
    }
  };

  const refreshCandidates = useCallback(async () => {
    // If auth is still resolving, hold off until auth state is determined
    if (isAuthLoading) {
      return;
    }

    // ADMIN users: do not initialize candidate context or trigger candidate APIs
    if (isAuthenticated && user?.role === 'ADMIN') {
      setCandidates([]);
      setActiveCandidate(null);
      setIsLoading(false);
      return;
    }

    // Unauthenticated users: do not make protected candidate API requests, maintain clean empty state
    if (!isAuthenticated) {
      setCandidates([]);
      setActiveCandidate(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);

      // 1. Try V1 authenticated candidate profile first
      try {
        const v1Profile = await apiClient.getCandidateProfile();
        if (v1Profile) {
          // Calculate realistic yearsOfExperience from experience records if available
          let computedYears = 0;
          if (Array.isArray(v1Profile.experiences) && v1Profile.experiences.length > 0) {
            for (const exp of v1Profile.experiences) {
              const start = exp.startDate ? new Date(exp.startDate) : null;
              const end = exp.endDate ? new Date(exp.endDate) : new Date();
              if (start && !isNaN(start.getTime()) && !isNaN(end.getTime())) {
                const diffYears = Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
                computedYears += diffYears;
              }
            }
          }
          const finalYears = computedYears > 0 ? Math.round(computedYears * 10) / 10 : 5;

          const adapted: CandidateProfile = {
            id: v1Profile.id,
            name: v1Profile.fullName || 'Candidate',
            headline: v1Profile.headline || '',
            email: v1Profile.email || '',
            phone: v1Profile.phone || '',
            location: v1Profile.location || '',
            targetRoles: v1Profile.preferences?.targetRoles || ['Software Engineer'],
            yearsOfExperience: finalYears,
            preferredLocations: v1Profile.preferences?.preferredLocations || ['Remote'],
            expectedSalary: '$140,000',
            noticePeriod: v1Profile.preferences?.noticePeriod || 'Immediate',
            workPreference: v1Profile.preferences?.remotePreference || 'Remote',
            primarySkills: (v1Profile.skills || []).map((s: any) => s.skill?.name || s.name || s),
            secondarySkills: [],
            technologies: [],
            companies: (v1Profile.experiences || []).map((exp: any) => exp.company).filter(Boolean),
            education: (v1Profile.educations || []).map((e: any) => {
              let yearStr = '';
              if (e.endDate) {
                yearStr = new Date(e.endDate).getFullYear().toString();
              } else if (e.startDate) {
                yearStr = new Date(e.startDate).getFullYear().toString();
              } else if (e.endYear) {
                yearStr = String(e.endYear);
              }
              return {
                id: e.id,
                degree: e.degree,
                field: e.fieldOfStudy || '',
                institution: e.institution,
                year: yearStr
              };
            }),
            certifications: (v1Profile.certifications || []).map((c: any) => c.name || c),
            projects: (v1Profile.projects || []).map((p: any) => ({
              id: p.id,
              name: p.name || p.title || 'Technical Project',
              description: p.description || '',
              technologies: p.technologies || []
            })),
            summary: v1Profile.summary || '',
            experiences: (v1Profile.experiences || []).map((exp: any) => ({
              id: exp.id,
              company: exp.company,
              title: exp.jobTitle || exp.title || exp.role || 'Software Professional',
              role: exp.jobTitle || exp.title || exp.role || 'Software Professional',
              location: exp.location || '',
              startDate: exp.startDate ? String(exp.startDate).substring(0, 7) : '',
              endDate: exp.isCurrent ? 'Present' : (exp.endDate ? String(exp.endDate).substring(0, 7) : 'Present'),
              isCurrent: Boolean(exp.isCurrent),
              duration: exp.description && exp.description.startsWith('Duration:') ? exp.description.replace('Duration:', '').trim() : '',
              description: exp.description || '',
              responsibilities: exp.responsibilities || [],
              highlights: (exp.responsibilities && exp.responsibilities.length > 0) ? exp.responsibilities : (exp.description ? [exp.description] : []),
              technologies: exp.technologies || []
            })),
            isDemo: false,
            createdAt: v1Profile.createdAt || new Date().toISOString(),
            updatedAt: v1Profile.updatedAt || new Date().toISOString()
          };

          setCandidates([adapted]);
          setActiveCandidate(adapted);
          localStorage.setItem('jobpilot_active_candidate_id', adapted.id);
          return;
        }
      } catch {
        // Fallback for transitional development / prototype
      }

      // 2. Transitional fallback strictly limited to local development mode (never executes in production)
      if (import.meta.env.DEV && !import.meta.env.PROD) {
        try {
          const list = await api.getCandidates();
          if (Array.isArray(list) && list.length > 0) {
            setCandidates(list);
            const savedCandidateId = localStorage.getItem('jobpilot_active_candidate_id');
            const found = savedCandidateId ? list.find(c => c.id === savedCandidateId) : null;
            const candidateToSet = found || list[0];
            setActiveCandidate(candidateToSet);
            localStorage.setItem('jobpilot_active_candidate_id', candidateToSet.id);
            return;
          }
        } catch {
          // Dev fallback failed
        }
      }

      // In production or when unauthenticated, maintain clean state
      setCandidates([]);
      setActiveCandidate(null);
    } catch (err) {
      console.warn('Notice loading candidate context:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthLoading, isAuthenticated, user?.role]);

  useEffect(() => {
    refreshCandidates();
  }, [refreshCandidates]);

  return (
    <AppContext.Provider
      value={{
        activeCandidate,
        candidates,
        setActiveCandidate: setActiveAndPersistCandidate,
        updateActiveCandidate,
        refreshCandidates,
        isLoading,
        toastMessage,
        showToast
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};
