import React, { createContext, useContext, useState, useEffect } from 'react';
import { CandidateProfile } from "../types/index";
import { apiClient } from "../api/client";
import { api } from "../api/index";

interface AppContextType {
  activeCandidate: CandidateProfile | null;
  candidates: CandidateProfile[];
  setActiveCandidate: (candidate: CandidateProfile) => void;
  refreshCandidates: () => Promise<void>;
  isLoading: boolean;
  toastMessage: string | null;
  showToast: (msg: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
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

  const setActiveAndPersistCandidate = (candidate: CandidateProfile) => {
    setActiveCandidate(candidate);
    try {
      localStorage.setItem('jobpilot_active_candidate_id', candidate.id);
    } catch (e) {
      console.warn('Failed to save active candidate to localStorage', e);
    }
  };

  const refreshCandidates = async () => {
    try {
      setIsLoading(true);

      // 1. Try V1 authenticated candidate profile first
      try {
        const v1Profile = await apiClient.getCandidateProfile();
        if (v1Profile) {
          const adapted: CandidateProfile = {
            id: v1Profile.id,
            name: v1Profile.fullName || 'Candidate',
            email: v1Profile.email || '',
            phone: v1Profile.phone || '',
            location: v1Profile.location || '',
            targetRoles: v1Profile.preferences?.targetRoles || ['Software Engineer'],
            yearsOfExperience: 5,
            preferredLocations: v1Profile.preferences?.preferredLocations || ['Remote'],
            expectedSalary: '$140,000',
            noticePeriod: v1Profile.preferences?.noticePeriod || 'Immediate',
            workPreference: v1Profile.preferences?.remotePreference || 'Remote',
            primarySkills: (v1Profile.skills || []).map((s: any) => s.skill?.name || s.name || s),
            secondarySkills: [],
            technologies: [],
            companies: [],
            education: (v1Profile.educations || []).map((e: any) => ({
              degree: e.degree,
              field: e.fieldOfStudy || '',
              institution: e.institution,
              year: e.endYear ? String(e.endYear) : ''
            })),
            certifications: (v1Profile.certifications || []).map((c: any) => ({
              name: c.name,
              issuer: c.issuer,
              year: c.issueDate ? String(c.issueDate).substring(0, 4) : ''
            })),
            projects: (v1Profile.projects || []).map((p: any) => ({
              name: p.title,
              description: p.description || '',
              technologies: p.technologies || []
            })),
            summary: v1Profile.summary || '',
            experiences: (v1Profile.experiences || []).map((exp: any) => ({
              role: exp.title,
              company: exp.company,
              location: exp.location || '',
              startDate: exp.startDate ? String(exp.startDate).substring(0, 7) : '',
              endDate: exp.isCurrent ? 'Present' : (exp.endDate ? String(exp.endDate).substring(0, 7) : ''),
              highlights: exp.description ? [exp.description] : []
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

      // 2. Transitional fallback to legacy candidate list if token is present
      try {
        const list = await api.getCandidates();
        if (Array.isArray(list) && list.length > 0) {
          setCandidates(list);
          const savedCandidateId = localStorage.getItem('jobpilot_active_candidate_id');
          const found = savedCandidateId ? list.find(c => c.id === savedCandidateId) : null;
          const candidateToSet = found || list[0];
          setActiveCandidate(candidateToSet);
          localStorage.setItem('jobpilot_active_candidate_id', candidateToSet.id);
        }
      } catch {
        // If unauthenticated or no candidate profile exists yet, clear active state gracefully
        setCandidates([]);
        setActiveCandidate(null);
      }
    } catch (err) {
      console.warn('Notice loading candidate context:', err);
    } finally {
      setIsLoading(false);
    }
  };


  useEffect(() => {
    refreshCandidates();
  }, []);

  return (
    <AppContext.Provider
      value={{
        activeCandidate,
        candidates,
        setActiveCandidate: setActiveAndPersistCandidate,
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
