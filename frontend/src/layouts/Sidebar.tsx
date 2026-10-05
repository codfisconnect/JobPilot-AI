import { useApp } from '../context/AppContext';
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
  GraduationCap
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

      {/* Footer Info */}
      <div className="sidebar-footer">
        <div className="footer-card">
          <p className="footer-title">Pilot Mama Copilot</p>
          <p className="footer-sub">Smart Matching & Tailored Resumes</p>
        </div>
      </div>
    </aside>
    </>
  );
};
