import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Circle,
  Sparkles,
  AlertCircle,
  RefreshCw,
  ArrowRight
} from 'lucide-react';
import {
  DashboardReadiness,
  ROTATING_VALUE_MESSAGES
} from './dashboardWelcome.types';
import './CandidateDashboardWelcome.css';

interface CandidateDashboardWelcomeProps {
  readiness: DashboardReadiness;
  onRetry: () => void;
  onContinueAnyway?: () => void;
}

export const CandidateDashboardWelcome: React.FC<CandidateDashboardWelcomeProps> = ({
  readiness,
  onRetry,
  onContinueAnyway
}) => {
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [isMounted, setIsMounted] = useState(true);

  // Rotate helpful product messages every 3.2 seconds while loading
  useEffect(() => {
    if (readiness.isReady || readiness.error) return;

    const timer = setInterval(() => {
      setCurrentMessageIndex(prev => (prev + 1) % ROTATING_VALUE_MESSAGES.length);
    }, 3200);

    return () => clearInterval(timer);
  }, [readiness.isReady, readiness.error]);

  // Handle smooth exit transition when genuine readiness is reached
  useEffect(() => {
    if (readiness.isReady && !readiness.error) {
      setIsFadingOut(true);
      const exitTimer = setTimeout(() => {
        setIsMounted(false);
      }, 500); // 450ms animation + 50ms buffer
      return () => clearTimeout(exitTimer);
    } else {
      setIsFadingOut(false);
      setIsMounted(true);
    }
  }, [readiness.isReady, readiness.error]);

  if (!isMounted) {
    return null;
  }

  const activeMessage = ROTATING_VALUE_MESSAGES[currentMessageIndex];

  return (
    <div
      className={`pilot-welcome-overlay ${isFadingOut ? 'fading-out' : ''}`}
      role="status"
      aria-live="polite"
    >
      <div className="pilot-welcome-card">
        {/* Brand Badge */}
        <div className="welcome-badge-row">
          <div className="welcome-brand-badge">
            <Sparkles className="welcome-brand-icon" />
            <span>Your AI Career Companion</span>
          </div>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>
            Pilot Mama
          </span>
        </div>

        {/* Primary Header */}
        <div className="welcome-header">
          <h1 className="welcome-title">Welcome to Pilot Mama</h1>
          <p className="welcome-subtitle">Your career, one step ahead.</p>
          <p className="welcome-copy">
            Discover relevant jobs, build stronger resumes, identify skill gaps,
            prepare for interviews, and manage your applications — all in one place.
          </p>
        </div>

        {/* Real Readiness Checklist */}
        <div className="welcome-checklist-section">
          <div className="welcome-checklist-header">
            <span>Workspace Preparation</span>
            {!readiness.error && (
              <span className="welcome-checklist-status-active">
                <Clock size={13} className="welcome-spinner" />
                <span>
                  {readiness.isReady ? 'Ready' : 'Preparing your personalized dashboard…'}
                </span>
              </span>
            )}
          </div>

          <div className="welcome-checklist-grid">
            {/* 1. Profile */}
            <div className={`checklist-item ${readiness.profile ? 'ready' : 'pending'}`}>
              {readiness.profile ? (
                <CheckCircle2 className="checklist-icon ready" />
              ) : (
                <Clock className="checklist-icon loading welcome-spinner" />
              )}
              <span>Profile</span>
            </div>

            {/* 2. Resume */}
            <div className={`checklist-item ${readiness.resume ? 'ready' : 'pending'}`}>
              {readiness.resume ? (
                <CheckCircle2 className="checklist-icon ready" />
              ) : (
                <Circle className="checklist-icon pending" />
              )}
              <span>Resume</span>
            </div>

            {/* 3. Job Recommendations */}
            <div className={`checklist-item ${readiness.jobs ? 'ready' : 'pending'}`}>
              {readiness.jobs ? (
                <CheckCircle2 className="checklist-icon ready" />
              ) : (
                <Circle className="checklist-icon pending" />
              )}
              <span>Job recommendations</span>
            </div>

            {/* 4. Career Intelligence */}
            <div className={`checklist-item ${readiness.careerIntelligence ? 'ready' : 'pending'}`}>
              {readiness.careerIntelligence ? (
                <CheckCircle2 className="checklist-icon ready" />
              ) : (
                <Circle className="checklist-icon pending" />
              )}
              <span>Career intelligence</span>
            </div>
          </div>
        </div>

        {/* Recoverable Error State */}
        {readiness.error ? (
          <div className="welcome-error-card">
            <div className="welcome-error-header">
              <AlertCircle size={18} />
              <span>Your dashboard could not be fully prepared.</span>
            </div>
            <p className="welcome-error-text">
              Some career data is taking longer than expected to initialize. You can retry or proceed directly to your workspace.
            </p>
            <div className="welcome-error-actions">
              <button
                type="button"
                className="welcome-retry-btn"
                onClick={onRetry}
              >
                <RefreshCw size={14} />
                <span>Retry</span>
              </button>
              {onContinueAnyway && (
                <button
                  type="button"
                  className="welcome-continue-btn"
                  onClick={onContinueAnyway}
                >
                  <span>Continue</span>
                  <ArrowRight size={14} style={{ display: 'inline', marginLeft: '4px' }} />
                </button>
              )}
            </div>
          </div>
        ) : (
          /* Rotating Product Value Message */
          <div className="welcome-rotating-message">
            <div className="rotating-msg-title">{activeMessage.title}</div>
            <div className="rotating-msg-desc">{activeMessage.description}</div>
          </div>
        )}
      </div>
    </div>
  );
};
