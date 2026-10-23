import React, { useState, lazy, Suspense } from 'react';
import { AppShell } from "./layouts/AppShell";
import { DashboardPage } from "./pages/DashboardPage";
import { useAuth } from "./context/AuthContext";

// Lazy-loaded routes for code-splitting non-critical paths
const ProfilePage = lazy(() => import("./pages/ProfilePage").then(m => ({ default: m.ProfilePage })));
const JobsPage = lazy(() => import("./pages/JobsPage").then(m => ({ default: m.JobsPage })));
const JobAnalysisPage = lazy(() => import("./pages/JobAnalysisPage").then(m => ({ default: m.JobAnalysisPage })));
const ResumesPage = lazy(() => import("./pages/ResumesPage").then(m => ({ default: m.ResumesPage })));
const ResumeStudioPage = lazy(() => import("./pages/ResumeStudioPage").then(m => ({ default: m.ResumeStudioPage })));
const ApplicationsPage = lazy(() => import("./pages/ApplicationsPage").then(m => ({ default: m.ApplicationsPage })));
const SavedJobsPage = lazy(() => import("./pages/SavedJobsPage").then(m => ({ default: m.SavedJobsPage })));
const InterviewPrepPage = lazy(() => import("./pages/InterviewPrepPage").then(m => ({ default: m.InterviewPrepPage })));
const CareerPage = lazy(() => import("./pages/CareerPage").then(m => ({ default: m.CareerPage })));
const SettingsPage = lazy(() => import("./pages/SettingsPage").then(m => ({ default: m.SettingsPage })));
const PricingPage = lazy(() => import("./pages/PricingPage").then(m => ({ default: m.PricingPage })));
const EmployerPage = lazy(() => import("./pages/EmployerPage").then(m => ({ default: m.EmployerPage })));
const CareerAgentPage = lazy(() => import("./pages/CareerAgentPage").then(m => ({ default: m.CareerAgentPage })));
const AuthPage = lazy(() => import("./pages/AuthPage").then(m => ({ default: m.AuthPage })));
const AdminRoot = lazy(() => import("./pages/admin/AdminRoot").then(m => ({ default: m.AdminRoot })));
const AdminLoginPage = lazy(() => import("./pages/admin/AdminLoginPage").then(m => ({ default: m.AdminLoginPage })));
import { AuthLayout } from "./layouts/AuthLayout";
import { EmployerLayout } from "./layouts/EmployerLayout";

import { PilotMamaLoadingScreen } from "./components/common/PilotMamaLoadingScreen";


const RouteLoadingFallback: React.FC = () => (
  <PilotMamaLoadingScreen fullScreen={false} statusText="Loading section…" />
);

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
    if (cleanPath.startsWith('/employer')) {
      return 'employer';
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
      employer: 'Pilot Mama | Employer Workspace',
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

  const { isLoading: isAuthLoading } = useAuth();

  // Initial Full-Viewport Bootstrap Loading Screen
  if (isAuthLoading) {
    return <PilotMamaLoadingScreen fullScreen={true} statusText="Initializing your career workspace…" />;
  }

  // Dedicated Public Authentication Layout (isolated from candidate AppShell)
  if (currentTab === 'auth') {
    const isRegisterRoute = window.location.pathname.toLowerCase().includes('/register');
    return (
      <AuthLayout onNavigateHome={() => handleNavigate('dashboard')}>
        <Suspense fallback={<RouteLoadingFallback />}>
          <AuthPage
            initialMode={isRegisterRoute ? 'register' : 'login'}
            onSuccess={() => handleNavigate('dashboard')}
            onNavigateMode={(mode) => {
              const targetPath = mode === 'register' ? '/register' : '/login';
              if (window.location.pathname !== targetPath) {
                window.history.pushState({}, '', targetPath);
              }
            }}
          />
        </Suspense>
      </AuthLayout>
    );
  }

  // Dedicated Administrative Portal Layout (isolated from candidate navigation)
  if (currentTab === 'admin-login') {

    return (
      <Suspense fallback={<RouteLoadingFallback />}>
        <AdminLoginPage
          onSuccess={() => {
            handleNavigate('admin');
          }}
          onExit={() => {
            handleNavigate('dashboard');
          }}
        />
      </Suspense>
    );
  }

  if (currentTab === 'admin') {
    // Extract section from /admin/:section if present
    const path = window.location.pathname.toLowerCase().replace(/\/$/, '');
    let initialSection = 'dashboard';
    if (path === '/admin/job-sources/bulk' || path === '/admin/job_sources/bulk') {
      initialSection = 'job-sources-bulk';
    } else if (path.startsWith('/admin/')) {
      const sub = path.replace('/admin/', '');
      if (['job-sources', 'job_sources', 'candidates', 'jobs', 'applications', 'employers', 'payments', 'system', 'health'].includes(sub)) {
        initialSection = sub === 'system' ? 'health' : (sub === 'job_sources' ? 'job-sources' : sub);
      }
    }

    return (
      <Suspense fallback={<RouteLoadingFallback />}>
        <AdminRoot
          initialSection={initialSection}
          onExitAdmin={() => handleNavigate('dashboard')}
        />
      </Suspense>
    );
  }

  // Dedicated Isolated Employer Workspace Layout (isolated from candidate AppShell)
  if (currentTab === 'employer') {
    const path = window.location.pathname.toLowerCase().replace(/\/$/, '');
    let initialSection = 'jobs';
    if (path.includes('/careers') || path.includes('/career-source') || path.includes('/careers-source')) {
      initialSection = 'careers';
    } else if (path.includes('/candidates') || path.includes('/applicants')) {
      initialSection = 'candidates';
    } else if (path.includes('/team') || path.includes('/members')) {
      initialSection = 'team';
    }

    return (
      <Suspense fallback={<RouteLoadingFallback />}>
        <EmployerLayout
          activeSection={initialSection}
          onSelectSection={(sec) => {
            const targetPath = sec === 'jobs' ? '/employer' : `/employer/${sec}`;
            if (window.location.pathname !== targetPath) {
              window.history.pushState({}, '', targetPath);
            }
            setCurrentTab('employer');
          }}
          onExitEmployer={() => handleNavigate('dashboard')}
        >
          <EmployerPage
            activeSection={initialSection}
            onSelectSection={(sec) => {
              const targetPath = sec === 'jobs' ? '/employer' : `/employer/${sec}`;
              if (window.location.pathname !== targetPath) {
                window.history.pushState({}, '', targetPath);
              }
            }}
            onNavigate={handleNavigate}
          />
        </EmployerLayout>
      </Suspense>
    );
  }

  return (
    <AppShell currentTab={currentTab} onSelectTab={tab => handleNavigate(tab)}>
      {currentTab === 'dashboard' && (
        <DashboardPage onNavigate={handleNavigate} />
      )}

      <Suspense fallback={<RouteLoadingFallback />}>
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
      </Suspense>
    </AppShell>

  );
};

export default App;
