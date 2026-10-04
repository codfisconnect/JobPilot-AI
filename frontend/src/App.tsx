import React, { useState } from 'react';
import { AppShell } from "./layouts/AppShell";
import { DashboardPage } from "./pages/DashboardPage";
import { ProfilePage } from "./pages/ProfilePage";
import { JobsPage } from "./pages/JobsPage";
import { JobAnalysisPage } from "./pages/JobAnalysisPage";
import { ResumeStudioPage } from "./pages/ResumeStudioPage";
import { ApplicationsPage } from "./pages/ApplicationsPage";
import { InterviewPage } from "./pages/InterviewPage";
import { SettingsPage } from "./pages/SettingsPage";

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [contextId, setContextId] = useState<string | undefined>(undefined);

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

      {currentTab === 'resumes' && (
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

      {currentTab === 'interview' && (
        <InterviewPage
          preselectedJobId={contextId}
          onNavigate={handleNavigate}
        />
      )}

      {currentTab === 'settings' && (
        <SettingsPage />
      )}
    </AppShell>
  );
};

export default App;
