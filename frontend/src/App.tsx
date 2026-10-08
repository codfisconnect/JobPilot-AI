import React, { useState } from 'react';
import { AppShell } from "./layouts/AppShell";
import { DashboardPage } from "./pages/DashboardPage";
import { ProfilePage } from "./pages/ProfilePage";
import { JobsPage } from "./pages/JobsPage";
import { JobAnalysisPage } from "./pages/JobAnalysisPage";
import { ResumesPage } from "./pages/ResumesPage";
import { ResumeStudioPage } from "./pages/ResumeStudioPage";
import { ApplicationsPage } from "./pages/ApplicationsPage";
import { SavedJobsPage } from "./pages/SavedJobsPage";
import { InterviewPrepPage } from "./pages/InterviewPrepPage";
import { CareerPage } from "./pages/CareerPage";
import { SettingsPage } from "./pages/SettingsPage";
import { PricingPage } from "./pages/PricingPage";
import { EmployerPage } from "./pages/EmployerPage";
import { CareerAgentPage } from "./pages/CareerAgentPage";
import { AuthPage } from "./pages/AuthPage";
import { AdminRoot } from "./pages/admin/AdminRoot";
import { AdminLoginPage } from "./pages/admin/AdminLoginPage";

export const App: React.FC = () => {
  const getTabFromPath = (path: string): string => {
    const cleanPath = path.toLowerCase().replace(/\/$/, '');
    if (cleanPath === '/admin/login') {
      return 'admin-login';
    }
    if (cleanPath.startsWith('/admin')) {
      return 'admin';
    }
    if (cleanPath === '/login' || cleanPath === '/register' || cleanPath === '/auth') {
      return 'auth';
    }
    if (cleanPath === '/jobs') {
      return 'jobs';
    }
    if (cleanPath === '/resumes') {
      return 'resumes';
    }
    if (cleanPath === '/applications') {
      return 'applications';
    }
    if (cleanPath === '/profile') {
      return 'profile';
    }
    if (cleanPath === '/settings') {
      return 'settings';
    }
    if (cleanPath === '/saved-jobs') {
      return 'saved-jobs';
    }
    if (cleanPath === '/interview') {
      return 'interview';
    }
    if (cleanPath === '/career' || cleanPath === '/learning') {
      return 'career';
    }
    return 'dashboard';
  };

  const [currentTab, setCurrentTab] = useState<string>(() => {
    return getTabFromPath(window.location.pathname);
  });
  const [contextId, setContextId] = useState<string | undefined>(undefined);

  // Sync route on popstate (browser back/forward)
  React.useEffect(() => {
    const handlePopState = () => {
      setCurrentTab(getTabFromPath(window.location.pathname));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Update browser document title based on active section
  React.useEffect(() => {
    const tabTitles: Record<string, string> = {
      dashboard: 'Pilot Mama | Dashboard',
      profile: 'Pilot Mama | My Profile',
      jobs: 'Pilot Mama | Jobs',
      resumes: 'Pilot Mama | Resumes',
      analysis: 'Pilot Mama | Job Fit Analysis',
      applications: 'Pilot Mama | Applications Pipeline',
      'saved-jobs': 'Pilot Mama | Saved Jobs',
      interview: 'Pilot Mama | Interview Prep Intelligence',
      career: 'Pilot Mama | Career Intelligence & Roadmap',
      learning: 'Pilot Mama | Learning Academy',
      pricing: 'Pilot Mama | Plans, Credits & Premium',
      settings: 'Pilot Mama | Settings & Integrations',
      admin: 'Pilot Mama | Platform Admin Dashboard'
    };
    document.title = tabTitles[currentTab] || 'Pilot Mama — AI Job Application Copilot';
  }, [currentTab]);

  const handleNavigate = (tab: string, id?: string) => {
    setCurrentTab(tab);
    setContextId(id);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Update browser URL bar cleanly without page reload
    const tabPaths: Record<string, string> = {
      dashboard: '/',
      admin: '/admin',
      auth: '/login',
      jobs: '/jobs',
      resumes: '/resumes',
      applications: '/applications',
      profile: '/profile',
      settings: '/settings',
      'saved-jobs': '/saved-jobs',
      interview: '/interview',
      career: '/career',
      learning: '/learning',
      pricing: '/pricing',
      employer: '/employer',
      agent: '/agent'
    };
    const targetPath = tabPaths[tab];
    if (targetPath && window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }
  };

  // Dedicated Administrative Portal Layout (isolated from candidate navigation)
  if (currentTab === 'admin-login') {
    return (
      <AdminLoginPage
        onSuccess={() => {
          handleNavigate('admin');
        }}
        onExit={() => {
          handleNavigate('dashboard');
        }}
      />
    );
  }

  if (currentTab === 'admin') {
    // Extract section from /admin/:section if present
    const path = window.location.pathname.toLowerCase().replace(/\/$/, '');
    let initialSection = 'dashboard';
    if (path.startsWith('/admin/')) {
      const sub = path.replace('/admin/', '');
      if (['candidates', 'jobs', 'applications', 'employers', 'payments', 'system', 'health'].includes(sub)) {
        initialSection = sub === 'system' ? 'health' : sub;
      }
    }

    return (
      <AdminRoot
        initialSection={initialSection}
        onExitAdmin={() => handleNavigate('dashboard')}
      />
    );
  }

  return (
    <AppShell currentTab={currentTab} onSelectTab={tab => handleNavigate(tab)}>
      {currentTab === 'dashboard' && (
        <DashboardPage onNavigate={handleNavigate} />
      )}

      {currentTab === 'profile' && (
        <ProfilePage />
      )}

      {currentTab === 'resumes' && (
        <ResumesPage onNavigate={handleNavigate} />
      )}

      {currentTab === 'jobs' && (
        <JobsPage
          onSelectJobForAnalysis={jobId => handleNavigate('analysis', jobId)}
          preselectedJobId={contextId}
        />
      )}

      {currentTab === 'analysis' && contextId && (
        <JobAnalysisPage
          jobId={contextId}
          onBack={() => handleNavigate('jobs')}
          onNavigate={handleNavigate}
        />
      )}

      {currentTab === 'studio' && (
        <ResumeStudioPage
          preselectedResumeId={contextId}
          onNavigate={handleNavigate}
        />
      )}

      {currentTab === 'applications' && (
        <ApplicationsPage
          preselectedAppId={contextId}
          onNavigate={handleNavigate}
        />
      )}

      {currentTab === 'saved-jobs' && (
        <SavedJobsPage onNavigate={handleNavigate} />
      )}

      {currentTab === 'interview' && (
        <InterviewPrepPage
          preselectedJobId={contextId}
          onNavigate={handleNavigate}
        />
      )}

      {currentTab === 'career' && (
        <CareerPage
          onNavigate={handleNavigate}
        />
      )}

      {currentTab === 'learning' && (
        <CareerPage
          onNavigate={handleNavigate}
        />
      )}

      {currentTab === 'employer' && (
        <EmployerPage
          onNavigate={handleNavigate}
        />
      )}

      {currentTab === 'agent' && (
        <CareerAgentPage
          onNavigate={handleNavigate}
        />
      )}

      {currentTab === 'pricing' && (
        <PricingPage
          onNavigate={handleNavigate}
        />
      )}

      {currentTab === 'settings' && (
        <SettingsPage />
      )}

      {currentTab === 'auth' && (
        <AuthPage onSuccess={() => handleNavigate('dashboard')} />
      )}
    </AppShell>
  );
};

export default App;
