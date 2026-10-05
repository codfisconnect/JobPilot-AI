import React from 'react';
import { useApp } from '../context/AppContext';
import { Button } from '../components/common/Button';
import { ThemeToggle } from '../components/theme/ThemeToggle';
import { PilotMamaLogo } from '../components/branding/PilotMamaLogo';
import { Upload } from 'lucide-react';
import './TopBar.css';

interface TopBarProps {
  onOpenUpload: () => void;
  onToggleMobileMenu?: () => void;
  isMobileMenuOpen?: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({
  onOpenUpload,
  onToggleMobileMenu,
  isMobileMenuOpen
}) => {
  const { activeCandidate } = useApp();

  return (
    <header className="app-topbar">
      <div className="topbar-left">
        {onToggleMobileMenu && (
          <button
            type="button"
            className="mobile-menu-toggle-btn"
            onClick={onToggleMobileMenu}
            aria-label={isMobileMenuOpen ? 'Close Navigation Menu' : 'Open Navigation Menu'}
            aria-expanded={isMobileMenuOpen}
          >
            <span className={`hamburger-bar ${isMobileMenuOpen ? 'open' : ''}`} />
            <span className={`hamburger-bar ${isMobileMenuOpen ? 'open' : ''}`} />
            <span className={`hamburger-bar ${isMobileMenuOpen ? 'open' : ''}`} />
          </button>
        )}
        <div className="topbar-mobile-brand">
          <PilotMamaLogo variant="icon" size="sm" />
        </div>
        <div className="topbar-title-wrap">
          <h1 className="topbar-title">Pilot Mama</h1>
          <p className="topbar-sub">
            <span className="highlight-name">{activeCandidate?.name || 'No Profile'}</span>
            {activeCandidate && (
              <span className="meta-details">
                {` • ${activeCandidate.yearsOfExperience}y exp • ${activeCandidate.targetRoles[0] || ''}`}
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="topbar-actions">
        <ThemeToggle />
        <Button
          variant="secondary"
          size="sm"
          icon={<Upload size={15} />}
          onClick={onOpenUpload}
          className="topbar-upload-btn"
        >
          <span className="btn-label-desktop">Upload Resume</span>
          <span className="btn-label-mobile">Upload</span>
        </Button>
      </div>
    </header>
  );
};

