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
import { AuthPage } from "./pages/AuthPage";

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [contextId, setContextId] = useState<string | undefined>(undefined);

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
      settings: 'Pilot Mama | Settings & Integrations'
    };
    document.title = tabTitles[currentTab] || 'Pilot Mama — AI Job Application Copilot';
  }, [currentTab]);

  const handleNavigate = (tab: string, id?: string) => {
    setCurrentTab(tab);
    setContextId(id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

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
