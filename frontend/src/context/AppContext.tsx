import React, { createContext, useContext, useState, useEffect } from 'react';
import { CandidateProfile } from "../types/index";
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
      const list = await api.getCandidates();
      setCandidates(list);

      const savedCandidateId = localStorage.getItem('jobpilot_active_candidate_id');
      if (savedCandidateId) {
        const found = list.find(c => c.id === savedCandidateId);
        if (found) {
          setActiveCandidate(found);
          return;
        }
      }

      if (list.length > 0) {
        if (!activeCandidate) {
          setActiveCandidate(list[0]);
          localStorage.setItem('jobpilot_active_candidate_id', list[0].id);
        } else {
          const updated = list.find(c => c.id === activeCandidate.id);
          if (updated) {
            setActiveCandidate(updated);
          } else {
            setActiveCandidate(list[0]);
            localStorage.setItem('jobpilot_active_candidate_id', list[0].id);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load candidates:', err);
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
