import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { PilotMamaLogo } from '../components/branding/PilotMamaLogo';
import { Mail, Lock, User as UserIcon, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';
import './AuthPage.css';

interface AuthPageProps {
  initialMode?: 'login' | 'register';
  onSuccess?: () => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({ initialMode = 'login', onSuccess }) => {
  const { login, register, error, clearError } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearError();

    if (!email || !email.includes('@')) {
      setLocalError('Please enter a valid email address');
      return;
    }

    if (password.length < 8) {
      setLocalError('Password must be at least 8 characters long');
      return;
    }

    try {
      setIsSubmitting(true);
      if (mode === 'login') {
        await login({ email, password });
      } else {
        await register({ email, password, fullName });
      }
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      setLocalError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const switchMode = (newMode: 'login' | 'register') => {
    setMode(newMode);
    setLocalError(null);
    clearError();
  };

  const activeError = localError || error;

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo-wrap">
            <PilotMamaLogo variant="full" size="md" />
          </div>
          <h2 className="auth-title">
            {mode === 'login' ? 'Welcome Back' : 'Create Your Account'}
          </h2>
          <p className="auth-subtitle">
            {mode === 'login'
              ? 'Log in to access your tailored resumes and application pipeline'
              : 'Join Pilot Mama to navigate your career with zero-fabrication AI'}
          </p>
        </div>

        {activeError && (
          <div className="auth-error-banner" role="alert">
            <AlertCircle size={18} />
            <span>{activeError}</span>
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === 'register' && (
            <div className="auth-field">
              <label className="auth-label" htmlFor="fullName">Full Name</label>
              <div className="auth-input-wrap">
                <UserIcon size={18} className="auth-input-icon" />
                <input
                  id="fullName"
                  type="text"
                  className="auth-input"
                  placeholder="e.g. Alex Morgan"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
            </div>
          )}

          <div className="auth-field">
            <label className="auth-label" htmlFor="email">Email Address</label>
            <div className="auth-input-wrap">
              <Mail size={18} className="auth-input-icon" />
              <input
                id="email"
                type="email"
                required
                className="auth-input"
                placeholder="you@domain.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                disabled={isSubmitting}
                autoComplete="email"
              />
            </div>
          </div>

          <div className="auth-field">
            <label className="auth-label" htmlFor="password">Password</label>
            <div className="auth-input-wrap">
              <Lock size={18} className="auth-input-icon" />
              <input
                id="password"
                type="password"
                required
                className="auth-input"
                placeholder="At least 8 characters"
                value={password}
                onChange={e => setPassword(e.target.value)}
                disabled={isSubmitting}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
            </div>
          </div>

          <button
            type="submit"
            className="auth-submit-btn"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={18} className="spinning" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <span>{mode === 'login' ? 'Sign In' : 'Get Started'}</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        <div className="auth-footer">
          {mode === 'login' ? (
            <p>
              Don't have an account yet?{' '}
              <button
                type="button"
                className="auth-switch-btn"
                onClick={() => switchMode('register')}
              >
                Sign up
              </button>
            </p>
          ) : (
            <p>
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
    </div>
  );
};
