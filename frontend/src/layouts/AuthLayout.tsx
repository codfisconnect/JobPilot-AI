import React from 'react';
import { PilotMamaLogo } from '../components/branding/PilotMamaLogo';
import { ThemeToggle } from '../components/theme/ThemeToggle';
import './AuthLayout.css';

interface AuthLayoutProps {
  children: React.ReactNode;
  onNavigateHome?: () => void;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({ children, onNavigateHome }) => {
  return (
    <div className="auth-layout-root">
      {/* Public Auth Header with Brand & Theme Switcher */}
      <header className="auth-layout-header">
        <button
          type="button"
          className="auth-layout-brand"
          onClick={onNavigateHome}
          title="Pilot Mama Home"
          aria-label="Pilot Mama Home"
        >
          <PilotMamaLogo variant="full" size="md" />
        </button>

        <div className="auth-layout-actions">
          <ThemeToggle />
        </div>
      </header>

      {/* Main Viewport Centered Content Area */}
      <main className="auth-layout-main">
        <div className="auth-layout-container">
          {children}
        </div>
      </main>

      {/* Clean Minimalist Legal / Security Footer */}
      <footer className="auth-layout-footer">
        <div className="auth-layout-footer-inner">
          <span className="auth-footer-copy">© 2026 Pilot Mama Inc. All rights reserved.</span>
          <div className="auth-footer-links">
            <span className="auth-footer-badge">🔒 Bank-Grade AES-256 Auth</span>
            <span className="auth-footer-dot">•</span>
            <span>Zero-Fabrication Career AI</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
