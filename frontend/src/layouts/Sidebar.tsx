import { useApp } from '../context/AppContext';
import {
  LayoutDashboard,
  User,
  Briefcase,
  FileText,
  Send,
  Headphones,
  Settings,
  Sparkles,
  Users
} from 'lucide-react';
import './Sidebar.css';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onSelectTab }) => {
  const { activeCandidate, candidates, setActiveCandidate } = useApp();

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'profile', label: 'My Profile', icon: User },
    { id: 'jobs', label: 'Jobs & Matching', icon: Briefcase },
    { id: 'resumes', label: 'Resume Studio', icon: FileText },
    { id: 'applications', label: 'Applications', icon: Send },
    { id: 'interview', label: 'Interview Prep', icon: Headphones },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="app-sidebar">
      {/* Brand */}
      <div className="sidebar-brand">
        <div className="brand-logo">
          <Sparkles className="brand-icon" size={22} />
        </div>
        <div className="brand-info">
          <h2 className="brand-name">JobPilot AI</h2>
          <span className="brand-tag">Candidate Copilot</span>
        </div>
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
              onClick={() => onSelectTab(item.id)}
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
          <p className="footer-title">JobPilot v1.0 Prototype</p>
          <p className="footer-sub">Built with Local SQLite & Gemini AI</p>
        </div>
      </div>
    </aside>
  );
};
