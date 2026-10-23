import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ThemeToggle } from '../components/theme/ThemeToggle';
import {
  Building2,
  Briefcase,
  Users,
  Globe,
  UserCheck,
  LogOut,
  ArrowLeft,
  Menu,
  X,
  ShieldCheck
} from 'lucide-react';
import './AdminLayout.css';

interface EmployerLayoutProps {
  children: React.ReactNode;
  activeSection: string;
  onSelectSection: (section: string) => void;
  onExitEmployer: () => void;
  orgName?: string;
  memberRole?: string;
}

export const EmployerLayout: React.FC<EmployerLayoutProps> = ({
  children,
  activeSection,
  onSelectSection,
  onExitEmployer,
  orgName,
  memberRole
}) => {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    { id: 'jobs', label: 'Job Openings & Pipeline', icon: Briefcase },
    { id: 'careers', label: 'Connect Careers Page', icon: Globe },
    { id: 'candidates', label: 'Candidate Discovery', icon: UserCheck },
    { id: 'team', label: 'Team & Roles', icon: Users },
  ];

  const handleNavClick = (id: string) => {
    onSelectSection(id);
    setMobileOpen(false);
  };

  return (
    <div className="admin-layout">
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="admin-mobile-backdrop"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Employer Sidebar */}
      <aside className={`admin-sidebar ${mobileOpen ? 'open' : ''}`}>
        <div className="admin-sidebar-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="admin-badge-indicator" style={{ background: 'rgba(99, 102, 241, 0.1)', color: 'var(--accent-primary)', borderColor: 'rgba(99, 102, 241, 0.2)' }}>
              <Building2 size={14} /> Pilot Mama Employer
            </span>
          </div>
          {mobileOpen && (
            <button
              style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              onClick={() => setMobileOpen(false)}
            >
              <X size={20} />
            </button>
          )}
        </div>

        {orgName && (
          <div style={{ padding: '0 16px 12px', borderBottom: '1px solid var(--border-subtle)', marginBottom: '12px' }}>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {orgName}
            </div>
            {memberRole && (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                <ShieldCheck size={12} color="var(--accent-primary)" />
                <span>{memberRole}</span>
              </div>
            )}
          </div>
        )}

        <nav className="admin-nav-list">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                className={`admin-nav-item ${isActive ? 'active' : ''}`}
                onClick={() => handleNavClick(item.id)}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="admin-sidebar-footer">
          <button
            className="admin-exit-btn"
            onClick={onExitEmployer}
          >
            <ArrowLeft size={16} />
            <span>Switch to Candidate View</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="admin-main-viewport">
        <header className="admin-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              className="admin-menu-toggle"
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={20} />
            </button>
            <h2 className="admin-topbar-title">Employer Hiring Portal</h2>
          </div>

          <div className="admin-topbar-actions">
            <ThemeToggle />
            <div className="admin-user-profile">
              <span className="admin-user-email">{user?.email}</span>
              <button
                className="admin-logout-btn"
                title="Sign out"
                onClick={() => logout()}
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </header>

        <main className="admin-content-scrollable">
          {children}
        </main>
      </div>
    </div>
  );
};
