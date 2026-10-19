import React from 'react';
import { Sparkles, AlertCircle, RefreshCw } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import './PilotMamaLoadingScreen.css';

export interface PilotMamaLoadingScreenProps {
  /**
   * If true, renders a fixed full-viewport overlay.
   * If false, renders an inline card suited for route Suspense fallbacks.
   * Default: true
   */
  fullScreen?: boolean;
  /**
   * Optional custom status text displayed under the dots
   * Default: "Preparing your workspace…"
   */
  statusText?: string;
  /**
   * Error message if a failure occurred
   */
  error?: string | null;
  /**
   * Retry callback when error is present
   */
  onRetry?: () => void;
  /**
   * Fade out trigger before unmounting
   */
  isFadingOut?: boolean;
}

export const PilotMamaLoadingScreen: React.FC<PilotMamaLoadingScreenProps> = ({
  fullScreen = true,
  statusText = 'Preparing your workspace…',
  error = null,
  onRetry,
  isFadingOut = false
}) => {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const containerClass = fullScreen
    ? `pilot-loading-fullscreen ${isFadingOut ? 'fading-out' : ''}`
    : 'pilot-loading-inline';

  const iconSrc = isLight
    ? '/brand/pilot-mama-icon-light.png'
    : '/brand/pilot-mama-icon-dark.png';

  return (
    <div
      className={containerClass}
      role="status"
      aria-busy={!error}
      aria-live="polite"
      aria-label="Pilot Mama Loading"
    >
      {/* 3D Perspective Grid Background Floor */}
      <div className="pilot-loader-grid-container" aria-hidden="true">
        <div className="pilot-loader-horizon" />
        <div className="pilot-loader-grid-floor" />
      </div>

      {/* Floating 3D Card Stage */}
      <div className="pilot-loader-card-stage">
        <div className="pilot-loader-card">
          {/* Glowing Top Neon Accent Line */}
          <div className="pilot-loader-accent-line pilot-loader-accent-top" aria-hidden="true" />

          {/* Top Badge */}
          <div className="pilot-loader-badge">
            <Sparkles size={11} className="pilot-loader-sparkle" />
            <span>AI Career Copilot</span>
          </div>

          {/* Center Brand Identity */}
          <div className="pilot-loader-brand">
            <div className="pilot-loader-logo-ring">
              <img
                src={iconSrc}
                alt="Pilot Mama"
                className="pilot-loader-logo-img"
                loading="eager"
              />
            </div>
            <h2 className="pilot-loader-brand-title">Pilot Mama</h2>
            <p className="pilot-loader-brand-subtitle">Your career, one step ahead.</p>
          </div>

          {/* Bottom Loading Indicator or Error State */}
          <div className="pilot-loader-footer">
            {error ? (
              <div className="pilot-loader-error">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#ef4444' }}>
                  <AlertCircle size={14} />
                  <span className="pilot-loader-error-text">{error}</span>
                </div>
                {onRetry && (
                  <button
                    type="button"
                    className="pilot-loader-retry-btn"
                    onClick={onRetry}
                  >
                    <RefreshCw size={12} style={{ marginRight: 4, display: 'inline' }} />
                    Retry
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="pilot-loader-dots" aria-hidden="true">
                  <span className="pilot-loader-dot" />
                  <span className="pilot-loader-dot" />
                  <span className="pilot-loader-dot" />
                </div>
                <span className="pilot-loader-action-text">{statusText}</span>
              </>
            )}
          </div>

          {/* Glowing Bottom Neon Accent Line */}
          <div className="pilot-loader-accent-line pilot-loader-accent-bottom" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
};
