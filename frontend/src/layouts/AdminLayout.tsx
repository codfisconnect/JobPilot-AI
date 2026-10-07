import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ThemeToggle } from '../components/theme/ThemeToggle';
import {
  ShieldAlert,
  LayoutDashboard,
  Users,
  FileText,
  Briefcase,
  Send,
  Building2,
  CreditCard,
  Layers,
  Coins,
  Activity,
  LogOut,
  ArrowLeft,
  Menu,
  X
} from 'lucide-react';
import './AdminLayout.css';

interface AdminLayoutProps {
  children: React.ReactNode;
  activeSection: string;
  onSelectSection: (section: string) => void;
  onExitAdmin: () => void;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  children,
  activeSection,
  onSelectSection,
  onExitAdmin
}) => {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
    { id: 'candidates', label: 'Candidates', icon: Users },
    { id: 'resumes', label: 'Resumes', icon: FileText },
    { id: 'jobs', label: 'Jobs', icon: Briefcase },
    { id: 'applications', label: 'Applications', icon: Send },
    { id: 'employers', label: 'Employers', icon: Building2 },
    { id: 'payments', label: 'Payments', icon: CreditCard },
    { id: 'subscriptions', label: 'Subscriptions', icon: Layers },
    { id: 'credits', label: 'Credits & Ledger', icon: Coins },
    { id: 'health', label: 'System Health', icon: Activity },
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

      {/* Admin Sidebar */}
      <aside className={`admin-sidebar ${mobileOpen ? 'open' : ''}`}>
        <div className="admin-sidebar-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="admin-badge-indicator">
              <ShieldAlert size={14} /> Admin V1
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
          <div className="admin-user-pill">
            <div className="admin-user-avatar">
              {user?.email?.charAt(0).toUpperCase() || 'A'}
            </div>
            <div className="admin-user-info">
              <div className="admin-user-email">{user?.email || 'admin@pilotmama.com'}</div>
              <div className="admin-user-role">Platform Superadmin</div>
            </div>
          </div>

          <button className="admin-exit-btn" onClick={onExitAdmin}>
            <ArrowLeft size={14} /> Return to App
          </button>
        </div>
      </aside>

      {/* Main Administrative Viewport */}
      <div className="admin-main-wrap">
        <header className="admin-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              className="admin-mobile-menu-btn"
              style={{
                display: 'none',
                background: 'none',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer'
              }}
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={20} />
            </button>
            <h2 className="admin-topbar-title">
              Pilot Mama Admin Platform
            </h2>
          </div>

          <div className="admin-topbar-actions">
            <ThemeToggle />
            <button
              onClick={() => logout()}
              title="Sign Out"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                color: '#f87171',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '0.8rem',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              <LogOut size={14} /> Exit
            </button>
          </div>
        </header>

        <main className="admin-content-viewport">
          {children}
        </main>
      </div>
    </div>
  );
};
