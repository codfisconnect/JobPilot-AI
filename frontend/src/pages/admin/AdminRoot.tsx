import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { AdminLayout } from '../../layouts/AdminLayout';
import { AdminDashboardOverview } from './AdminDashboardOverview';
import { AdminCandidates } from './AdminCandidates';
import { AdminJobs } from './AdminJobs';
import { AdminApplications } from './AdminApplications';
import { AdminEmployers } from './AdminEmployers';
import { AdminPayments } from './AdminPayments';
import { AdminHealth } from './AdminHealth';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

interface AdminRootProps {
  onExitAdmin: () => void;
  initialSection?: string;
}

export const AdminRoot: React.FC<AdminRootProps> = ({ onExitAdmin, initialSection = 'dashboard' }) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [activeSection, setActiveSection] = useState(initialSection);

  // Sync if initialSection changes from URL navigation
  React.useEffect(() => {
    if (initialSection) {
      setActiveSection(initialSection);
    }
  }, [initialSection]);

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
        <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
          <button
            onClick={() => {
              window.history.pushState({}, '', '/admin/login');
              window.dispatchEvent(new PopStateEvent('popstate'));
            }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '8px', background: 'var(--accent-primary, #6366f1)', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer' }}
          >
            Admin Sign In
          </button>
          <button
            onClick={onExitAdmin}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '8px', background: 'rgba(255,255,255,0.08)', color: 'var(--text-primary)', border: 'none', fontWeight: 600, cursor: 'pointer' }}
          >
            <ArrowLeft size={16} /> Return to Main Application
          </button>
        </div>
      </div>
    );
  }

  return (
    <AdminLayout
      activeSection={activeSection}
      onSelectSection={section => {
        setActiveSection(section);
        const path = section === 'dashboard' ? '/admin' : `/admin/${section === 'health' ? 'system' : section}`;
        if (window.location.pathname !== path) {
          window.history.pushState({}, '', path);
        }
      }}
      onExitAdmin={onExitAdmin}
    >
      {activeSection === 'dashboard' && <AdminDashboardOverview />}
      {activeSection === 'candidates' && <AdminCandidates />}
      {activeSection === 'jobs' && <AdminJobs />}
      {activeSection === 'applications' && <AdminApplications />}
      {activeSection === 'employers' && <AdminEmployers />}
      {activeSection === 'payments' && <AdminPayments />}
      {(activeSection === 'health' || activeSection === 'system') && <AdminHealth />}
    </AdminLayout>
  );
};
