import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { PilotMamaLogo } from '../components/branding/PilotMamaLogo';
import {
  LayoutDashboard,
  User,
  Briefcase,
  FileText,
  Send,
  Headphones,
  Settings,
  Sparkles,
  Users,
  GraduationCap,
  LogOut,
  LogIn
} from 'lucide-react';
import './Sidebar.css';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  isMobileOpen = false,
  onCloseMobile
}) => {
  const { activeCandidate, candidates, setActiveCandidate } = useApp();
  const { user, logout } = useAuth();

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'profile', label: 'My Profile', icon: User },
    { id: 'jobs', label: 'Jobs & Matching', icon: Briefcase },
    { id: 'resumes', label: 'Resume Studio', icon: FileText },
    { id: 'applications', label: 'Applications', icon: Send },
    { id: 'interview', label: 'Interview Prep', icon: Headphones },
    { id: 'learning', label: 'Learning Academy', icon: GraduationCap },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const handleItemClick = (id: string) => {
    onSelectTab(id);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isMobileOpen && (
        <div
          className="sidebar-backdrop"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside className={`app-sidebar ${isMobileOpen ? 'sidebar-mobile-open' : ''}`}>
        {/* Brand */}
        <div className="sidebar-brand">
          <PilotMamaLogo variant="full" size="md" className="sidebar-logo-brand" />
          {onCloseMobile && (
            <button
              type="button"
              className="sidebar-close-mobile-btn"
              onClick={onCloseMobile}
              aria-label="Close navigation sidebar"
            >
              ✕
            </button>
          )}
        </div>

      {/* Candidate Selector Switcher (Demo Mode) */}
      <div className="demo-switcher-box">
        <div className="switcher-header">
          <Users size={14} />
          <span>Active Profile</span>
        </div>
        <select
          className="switcher-select"
          value={activeCandidate?.id || ''}
          onChange={e => {
            const found = candidates.find(c => c.id === e.target.value);
            if (found) setActiveCandidate(found);
          }}
        >
          {candidates.map(c => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.targetRoles[0] || 'Profile'})
            </option>
          ))}
        </select>
        {activeCandidate?.isDemo && (
          <span className="demo-badge">Demo Mode Active</span>
        )}
      </div>

      {/* Nav Menu */}
      <nav className="sidebar-nav">
        {menuItems.map(item => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              className={`nav-item ${isActive ? 'nav-item-active' : ''}`}
              onClick={() => handleItemClick(item.id)}
            >
              <Icon size={18} className="nav-icon" />
              <span className="nav-label">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Footer Info & Auth */}
      <div className="sidebar-footer">
        <div className="footer-card">
          <p className="footer-title">Pilot Mama Copilot</p>
          <p className="footer-sub">Smart Matching & Tailored Resumes</p>
        </div>

        {user ? (
          <div className="sidebar-user-section" style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                {user.candidateProfile?.fullName || user.email.split('@')[0]}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {user.role}
              </div>
            </div>
            <button
              onClick={() => logout()}
              title="Sign Out"
              aria-label="Sign Out"
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '6px', borderRadius: 'var(--radius-sm)', display: 'inline-flex', alignItems: 'center' }}
            >
              <LogOut size={16} />
            </button>
          </div>
        ) : (
          <div style={{ marginTop: '0.75rem' }}>
            <button
              onClick={() => handleItemClick('auth')}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px', fontSize: '0.8125rem', fontWeight: 600, background: 'var(--bg-surface-hover)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-md)', color: 'var(--accent-primary)', cursor: 'pointer' }}
            >
              <LogIn size={15} />
              <span>Sign In / Register</span>
            </button>
          </div>
        )}
      </div>
    </aside>
    </>
  );
};
