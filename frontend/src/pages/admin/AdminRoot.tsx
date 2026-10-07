import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { AdminLayout } from '../../layouts/AdminLayout';
import { AdminDashboardOverview } from './AdminDashboardOverview';
import { AdminCandidates } from './AdminCandidates';
import { AdminResumes } from './AdminResumes';
import { AdminJobs } from './AdminJobs';
import { AdminApplications } from './AdminApplications';
import { AdminEmployers } from './AdminEmployers';
import { AdminPayments } from './AdminPayments';
import { AdminSubscriptions } from './AdminSubscriptions';
import { AdminCredits } from './AdminCredits';
import { AdminHealth } from './AdminHealth';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

interface AdminRootProps {
  onExitAdmin: () => void;
}

export const AdminRoot: React.FC<AdminRootProps> = ({ onExitAdmin }) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [activeSection, setActiveSection] = useState('dashboard');

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg-canvas)' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Verifying administrative credentials...</p>
      </div>
    );
  }

  // Strict Client-Side Role Guard + Backend Enforced JWT
  if (!isAuthenticated || user?.role !== 'ADMIN') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '24px', background: 'var(--bg-canvas)', textAlign: 'center', gap: '16px' }}>
        <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f87171' }}>
          <ShieldAlert size={36} />
        </div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>403 - Restricted Admin Area</h1>
        <p style={{ color: 'var(--text-secondary)', maxWidth: '480px' }}>
          Access to the Pilot Mama Platform Admin Dashboard is restricted to verified administrators. Your current account role ({user?.role || 'Unauthenticated'}) is not authorized.
        </p>
        <button
          onClick={onExitAdmin}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '8px', background: 'var(--accent-primary, #6366f1)', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer', marginTop: '8px' }}
        >
          <ArrowLeft size={16} /> Return to Main Application
        </button>
      </div>
    );
  }

  return (
    <AdminLayout
      activeSection={activeSection}
      onSelectSection={setActiveSection}
      onExitAdmin={onExitAdmin}
    >
      {activeSection === 'dashboard' && <AdminDashboardOverview />}
      {activeSection === 'candidates' && <AdminCandidates />}
      {activeSection === 'resumes' && <AdminResumes />}
      {activeSection === 'jobs' && <AdminJobs />}
      {activeSection === 'applications' && <AdminApplications />}
      {activeSection === 'employers' && <AdminEmployers />}
      {activeSection === 'payments' && <AdminPayments />}
      {activeSection === 'subscriptions' && <AdminSubscriptions />}
      {activeSection === 'credits' && <AdminCredits />}
      {activeSection === 'health' && <AdminHealth />}
    </AdminLayout>
  );
};
