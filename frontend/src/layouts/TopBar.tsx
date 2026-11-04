import React from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/common/Button';
import { ThemeToggle } from '../components/theme/ThemeToggle';
import { PilotMamaLogo } from '../components/branding/PilotMamaLogo';
import { Upload, LogIn } from 'lucide-react';
import './TopBar.css';

interface TopBarProps {
  onOpenUpload: () => void;
  onNavigateAuth?: () => void;
  onToggleMobileMenu?: () => void;
  isMobileMenuOpen?: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({
  onOpenUpload,
  onNavigateAuth,
  onToggleMobileMenu,
  isMobileMenuOpen
}) => {
  const { activeCandidate } = useApp();
  const { user, isAuthenticated } = useAuth();

  const candidateName = user?.candidateProfile?.fullName || activeCandidate?.name || (user?.email ? user.email.split('@')[0] : null);
  const headline = activeCandidate?.headline || (user?.candidateProfile as any)?.headline || (activeCandidate ? `${activeCandidate.yearsOfExperience}y exp • ${activeCandidate.targetRoles?.[0] || ''}` : null);

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
            {isAuthenticated && user ? (
              <>
                <span className="highlight-name">{candidateName || 'Candidate'}</span>
                {headline && (
                  <span className="meta-details">
                    {` • ${headline}`}
                  </span>
                )}
              </>
            ) : (
              <span className="meta-details">AI Job Application Copilot</span>
            )}
          </p>
        </div>
      </div>

      <div className="topbar-actions">
        <ThemeToggle />
        {isAuthenticated && user ? (
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
        ) : (
          <Button
            variant="primary"
            size="sm"
            icon={<LogIn size={15} />}
            onClick={() => onNavigateAuth?.()}
            className="topbar-login-btn"
          >
            <span>Sign In / Register</span>
          </Button>
        )}
      </div>
    </header>
  );
};
