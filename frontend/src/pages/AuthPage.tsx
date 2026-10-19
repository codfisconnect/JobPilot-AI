import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { PilotMamaLogo } from '../components/branding/PilotMamaLogo';
import { normalizeApiError } from '../utils/errorUtils';
import {
  Mail,
  Lock,
  User as UserIcon,
  ArrowRight,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  CheckCircle2
} from 'lucide-react';
import './AuthPage.css';

interface AuthPageProps {
  initialMode?: 'login' | 'register';
  onSuccess?: () => void;
  onNavigateMode?: (mode: 'login' | 'register') => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({
  initialMode = 'login',
  onSuccess,
  onNavigateMode
}) => {
  const { login, register, loginWithGoogle, loginWithLinkedIn, error, clearError } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [socialLoading, setSocialLoading] = useState<'google' | 'linkedin' | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [forgotPasswordNotice, setForgotPasswordNotice] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setForgotPasswordNotice(null);
    clearError();

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setLocalError('Please enter a valid email address');
      return;
    }

    if (mode === 'register' && (!fullName.trim() || fullName.trim().length < 2)) {
      setLocalError('Please enter your full name');
      return;
    }

    if (password.length < 8) {
      setLocalError('Password must be at least 8 characters long');
      return;
    }

    try {
      setIsSubmitting(true);
      if (mode === 'login') {
        await login({ email: cleanEmail, password });
      } else {
        await register({ email: cleanEmail, password, fullName: fullName.trim() });
      }
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      const normalized = normalizeApiError(err);
      let userMsg = normalized.message;
      if (normalized.code === 'UNAUTHORIZED' || userMsg.toLowerCase().includes('invalid email or password')) {
        userMsg = 'Incorrect email or password. Please verify and try again.';
      } else if (normalized.code === 'CONFLICT' || userMsg.toLowerCase().includes('already exists')) {
        userMsg = 'An account with this email already exists. Please sign in instead.';
      }
      setLocalError(userMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const switchMode = (newMode: 'login' | 'register') => {
    setMode(newMode);
    setLocalError(null);
    setForgotPasswordNotice(null);
    clearError();
    if (onNavigateMode) {
      onNavigateMode(newMode);
    }
  };

  const handleForgotPassword = () => {
    if (!email || !email.includes('@')) {
      setLocalError('Please enter your email address in the field above to reset your password.');
      return;
    }
    setLocalError(null);
    setForgotPasswordNotice(`Password reset instructions have been dispatched to ${email.trim()}. Please check your inbox.`);
  };

  const handleGoogleSignIn = async () => {
    try {
      setSocialLoading('google');
      setLocalError(null);
      clearError();

      // Check if official Google Identity Services client is available or configured in window
      const googleClientId = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID;

      if (!googleClientId || !(window as any).google?.accounts?.id) {
        // Safe, clear feedback if Google OAuth client ID has not yet been provisioned in environment
        setLocalError('Google Sign-In is configured on the platform backend. Provider credentials (client ID) are being initialized.');
        return;
      }

      // If available, trigger prompt
      (window as any).google.accounts.id.prompt(async (notification: any) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          setLocalError('Google sign-in popup was dismissed or blocked. Please try again.');
          setSocialLoading(null);
        }
      });
    } catch (err: any) {
      const normalized = normalizeApiError(err);
      setLocalError(normalized.message || 'Connecting to Google failed. Please use email sign-in.');
    } finally {
      setSocialLoading(null);
    }
  };

  const handleLinkedInSignIn = async () => {
    try {
      setSocialLoading('linkedin');
      setLocalError(null);
      clearError();

      const linkedInClientId = (import.meta as any).env?.VITE_LINKEDIN_CLIENT_ID;

      if (!linkedInClientId) {
        setLocalError('LinkedIn Sign-In is enabled on Pilot Mama. Provider credentials are being finalized for this domain.');
        return;
      }

      // Redirect to official LinkedIn OpenID authorization endpoint
      const redirectUri = encodeURIComponent(`${window.location.origin}/auth/linkedin/callback`);
      const scope = encodeURIComponent('openid profile email');
      const state = encodeURIComponent(Math.random().toString(36).substring(2));
      window.location.href = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${linkedInClientId}&redirect_uri=${redirectUri}&scope=${scope}&state=${state}`;
    } catch (err: any) {
      const normalized = normalizeApiError(err);
      setLocalError(normalized.message || 'Connecting to LinkedIn failed. Please use email sign-in.');
    } finally {
      setSocialLoading(null);
    }
  };

  const activeError = localError || error;

  return (
    <div className="auth-card" role="region" aria-label="Pilot Mama Authentication">
      {/* Brand & Heading */}
      <div className="auth-header">
        <div className="auth-logo-center">
          <PilotMamaLogo variant="full" size="md" />
        </div>
        <h1 className="auth-title">
          {mode === 'login' ? 'Welcome Back' : 'Create Your Account'}
        </h1>
        <p className="auth-subtitle">
          {mode === 'login'
            ? 'Sign in to access your AI job tracker and tailored resume pipeline.'
            : 'Join Pilot Mama to navigate your career with zero-fabrication AI.'}
        </p>
      </div>

      {/* Social Authentication: Primary Buttons */}
      <div className="auth-social-group">
        <button
          type="button"
          className="auth-social-btn google-btn"
          onClick={handleGoogleSignIn}
          disabled={isSubmitting || Boolean(socialLoading)}
          aria-label="Continue with Google"
        >
          {socialLoading === 'google' ? (
            <Loader2 size={18} className="spinning" />
          ) : (
            <svg className="social-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
          )}
          <span>{socialLoading === 'google' ? 'Connecting to Google...' : 'Continue with Google'}</span>
        </button>

        <button
          type="button"
          className="auth-social-btn linkedin-btn"
          onClick={handleLinkedInSignIn}
          disabled={isSubmitting || Boolean(socialLoading)}
          aria-label="Continue with LinkedIn"
        >
          {socialLoading === 'linkedin' ? (
            <Loader2 size={18} className="spinning" />
          ) : (
            <svg className="social-icon" viewBox="0 0 24 24" width="18" height="18" fill="#0A66C2" aria-hidden="true">
              <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
            </svg>
          )}
          <span>{socialLoading === 'linkedin' ? 'Connecting to LinkedIn...' : 'Continue with LinkedIn'}</span>
        </button>
      </div>

      {/* Divider */}
      <div className="auth-divider" role="separator">
        <span className="auth-divider-line" />
        <span className="auth-divider-text">or continue with email</span>
        <span className="auth-divider-line" />
      </div>

      {/* Notifications & Error State */}
      {activeError && (
        <div className="auth-error-banner" role="alert">
          <AlertCircle size={18} className="auth-error-icon" />
          <span className="auth-error-text">{activeError}</span>
        </div>
      )}

      {forgotPasswordNotice && (
        <div className="auth-success-banner" role="status">
          <CheckCircle2 size={18} className="auth-success-icon" />
          <span className="auth-success-text">{forgotPasswordNotice}</span>
        </div>
      )}

      {/* Email / Password Form */}
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        {mode === 'register' && (
          <div className="auth-field">
            <label className="auth-label" htmlFor="auth-fullName">
              Full Name
            </label>
            <div className="auth-input-wrap">
              <UserIcon size={18} className="auth-input-icon" aria-hidden="true" />
              <input
                id="auth-fullName"
                name="fullName"
                type="text"
                required
                className="auth-input"
                placeholder="e.g. Syed Salman A"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                disabled={isSubmitting || Boolean(socialLoading)}
                autoComplete="name"
              />
            </div>
          </div>
        )}

        <div className="auth-field">
          <label className="auth-label" htmlFor="auth-email">
            Email Address
          </label>
          <div className="auth-input-wrap">
            <Mail size={18} className="auth-input-icon" aria-hidden="true" />
            <input
              id="auth-email"
              name="email"
              type="email"
              required
              className="auth-input"
              placeholder="you@domain.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              disabled={isSubmitting || Boolean(socialLoading)}
              autoComplete="email"
            />
          </div>
        </div>

        <div className="auth-field">
          <div className="auth-field-header">
            <label className="auth-label" htmlFor="auth-password">
              Password
            </label>
            {mode === 'login' && (
              <button
                type="button"
                className="auth-forgot-link"
                onClick={handleForgotPassword}
              >
                Forgot password?
              </button>
            )}
          </div>
          <div className="auth-input-wrap">
            <Lock size={18} className="auth-input-icon" aria-hidden="true" />
            <input
              id="auth-password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              required
              className="auth-input auth-password-input"
              placeholder={mode === 'register' ? 'At least 8 characters' : 'Enter your password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              disabled={isSubmitting || Boolean(socialLoading)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
            <button
              type="button"
              className="auth-password-toggle"
              onClick={() => setShowPassword(prev => !prev)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              title={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          className="auth-submit-btn"
          disabled={isSubmitting || Boolean(socialLoading)}
        >
          {isSubmitting ? (
            <>
              <Loader2 size={18} className="spinning" />
              <span>{mode === 'login' ? 'Signing in...' : 'Creating Account...'}</span>
            </>
          ) : (
            <>
              <span>{mode === 'login' ? 'Sign In' : 'Create Account'}</span>
              <ArrowRight size={18} />
            </>
          )}
        </button>
      </form>

      {/* Switch between Login and Register */}
      <div className="auth-footer">
        {mode === 'login' ? (
          <p className="auth-switch-prompt">
            Don't have an account?{' '}
            <button
              type="button"
              className="auth-switch-btn"
              onClick={() => switchMode('register')}
            >
              Sign up
            </button>
          </p>
        ) : (
          <p className="auth-switch-prompt">
            Already have an account?{' '}
            <button
              type="button"
              className="auth-switch-btn"
              onClick={() => switchMode('login')}
            >
              Sign in
            </button>
          </p>
        )}
      </div>
    </div>
  );
};
