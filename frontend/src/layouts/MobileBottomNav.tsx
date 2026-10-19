import React from 'react';
import {
  LayoutDashboard,
  Briefcase,
  Send,
  GraduationCap,
  Menu
} from 'lucide-react';
import './MobileBottomNav.css';

interface MobileBottomNavProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  onOpenMobileMenu: () => void;
  isMobileMenuOpen: boolean;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentTab,
  onSelectTab,
  onOpenMobileMenu,
  isMobileMenuOpen
}) => {
  const navItems = [
    { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
    { id: 'jobs', label: 'Jobs', icon: Briefcase },
    { id: 'applications', label: 'Apps', icon: Send },
    { id: 'career', label: 'Career', icon: GraduationCap }
  ];

  return (
    <nav className="mobile-bottom-nav" aria-label="Mobile Bottom Navigation">
      {navItems.map(item => {
        const Icon = item.icon;
        const isActive = currentTab === item.id && !isMobileMenuOpen;
        return (
          <button
            key={item.id}
            type="button"
            className={`mobile-bottom-nav-item ${isActive ? 'active' : ''}`}
            onClick={() => onSelectTab(item.id)}
            aria-label={item.label}
            aria-current={isActive ? 'page' : undefined}
          >
            <div className="mobile-nav-icon-wrap">
              {isActive && <span className="mobile-nav-active-pill" />}
              <Icon size={20} />
            </div>
            <span className="mobile-nav-label">{item.label}</span>
          </button>
        );
      })}

      {/* Menu / Drawer Toggle */}
      <button
        type="button"
        className={`mobile-bottom-nav-item ${isMobileMenuOpen ? 'active' : ''}`}
        onClick={onOpenMobileMenu}
        aria-label="More navigation options"
        aria-expanded={isMobileMenuOpen}
      >
        <div className="mobile-nav-icon-wrap">
          {isMobileMenuOpen && <span className="mobile-nav-active-pill" />}
          <Menu size={20} />
        </div>
        <span className="mobile-nav-label">Menu</span>
      </button>
    </nav>
  );
};
