import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { PilotMamaLogo } from '../../components/branding/PilotMamaLogo';
import { ShieldAlert, Lock, Mail, ArrowRight, AlertCircle, Loader2, ArrowLeft } from 'lucide-react';
import './AdminLoginPage.css';

interface AdminLoginPageProps {
  onSuccess: () => void;
  onExit: () => void;
}

export const AdminLoginPage: React.FC<AdminLoginPageProps> = ({ onSuccess, onExit }) => {
  const { login, error, clearError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearError();

    if (!email || !email.includes('@')) {
      setLocalError('Please enter a valid administrator email address');
      return;
    }

    if (!password) {
      setLocalError('Please enter the administrator password');
      return;
    }

    try {
      setIsSubmitting(true);
      const userObj = await login({ email, password });
      if (userObj.role !== 'ADMIN') {
        setLocalError('Access denied: Account does not possess ADMIN privileges.');
        return;
      }
      onSuccess();
    } catch (err: any) {
      setLocalError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeError = localError || error;

  return (
    <div className="admin-login-canvas">
      <div className="admin-login-card">
        <div className="admin-login-header">
          <div className="admin-security-badge">
            <ShieldAlert size={28} className="shield-icon" />
          </div>
          <h1 className="admin-login-title">Private Admin Portal</h1>
          <p className="admin-login-subtitle">
            Restricted access for platform administrators. All activity is logged and cryptographically authenticated.
          </p>
        </div>

        {activeError && (
          <div className="admin-error-callout" role="alert">
            <AlertCircle size={18} />
            <span>{activeError}</span>
          </div>
        )}

        <form className="admin-login-form" onSubmit={handleSubmit}>
          <div className="admin-form-group">
            <label className="admin-label" htmlFor="admin-email">Administrator Email</label>
            <div className="admin-input-wrapper">
              <Mail size={18} className="admin-input-icon" />
              <input
                id="admin-email"
                type="email"
                className="admin-input"
                placeholder="admin@pilotmama.io"
                value={email}
                onChange={e => setEmail(e.target.value)}
                disabled={isSubmitting}
                autoComplete="email"
                required
              />
            </div>
          </div>

          <div className="admin-form-group">
            <label className="admin-label" htmlFor="admin-password">Administrator Password</label>
            <div className="admin-input-wrapper">
              <Lock size={18} className="admin-input-icon" />
              <input
                id="admin-password"
                type="password"
                className="admin-input"
                placeholder="••••••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                disabled={isSubmitting}
                autoComplete="current-password"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="admin-submit-btn"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={18} className="spin" />
                <span>Authenticating...</span>
              </>
            ) : (
              <>
                <span>Authenticate into Admin</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        <div className="admin-login-footer">
          <button type="button" className="admin-back-btn" onClick={onExit}>
            <ArrowLeft size={14} />
            <span>Return to Career Experience</span>
          </button>
        </div>
      </div>
    </div>
  );
};
