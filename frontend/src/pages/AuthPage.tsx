import React, { useState, useEffect } from 'react';
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
  CheckCircle2,
  KeyRound,
  ArrowLeft,
  RotateCw
} from 'lucide-react';
import './AuthPage.css';

interface AuthPageProps {
  initialMode?: 'login' | 'register';
  onSuccess?: () => void;
  onNavigateMode?: (mode: 'login' | 'register') => void;
}

type AuthMode = 'login' | 'register' | 'otp_verification' | 'forgot_password';
type LoginMethod = 'otp' | 'password';

export const AuthPage: React.FC<AuthPageProps> = ({
  initialMode = 'login',
  onSuccess,
  onNavigateMode
}) => {
  const {
    login,
    register,
    verifyOtp,
    requestOtp,
    resendOtp,
    resetPassword,
    loginWithGoogle,
    loginWithLinkedIn,
    error,
    clearError
  } = useAuth();

  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [loginMethod, setLoginMethod] = useState<LoginMethod>('otp');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpPurpose, setOtpPurpose] = useState<'SIGNUP' | 'LOGIN' | 'PASSWORD_RESET'>('SIGNUP');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [socialLoading, setSocialLoading] = useState<'google' | 'linkedin' | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Resend cooldown timer
  const [cooldown, setCooldown] = useState<number>(0);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (cooldown > 0) {
      timer = setInterval(() => {
        setCooldown(prev => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [cooldown]);

  const validateEmailFormat = (rawEmail: string): boolean => {
    const clean = rawEmail.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return Boolean(clean && emailRegex.test(clean));
  };

  /**
   * Handle Sign-Up Form Submission
   */
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setSuccessNotice(null);
    clearError();

    const cleanEmail = email.trim().toLowerCase();
    if (!validateEmailFormat(cleanEmail)) {
      setLocalError('Enter a valid email address.');
      return;
    }

    if (!fullName.trim() || fullName.trim().length < 2) {
      setLocalError('Please enter your full name (minimum 2 characters).');
      return;
    }

    if (password.length < 8) {
      setLocalError('Password must be at least 8 characters long.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await register({ email: cleanEmail, password, fullName: fullName.trim() });
      if (res && (res.requiresVerification || (res as any).requiresOtp)) {
        setOtpPurpose('SIGNUP');
        setOtpCode('');
        setCooldown(res.cooldownSeconds || 60);
        setSuccessNotice(res.message || 'Verification code sent to your email.');
        setMode('otp_verification');
      } else if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      const normalized = normalizeApiError(err);
      let userMsg = normalized.message;
      if (normalized.code === 'CONFLICT' || userMsg.toLowerCase().includes('already exists')) {
        userMsg = 'An account already exists with this email. Please sign in.';
        setLocalError(userMsg);
        return;
      }

      // If an existing unverified account already had an active OTP in cooldown:
      if (
        normalized.code === 'TOO_MANY_REQUESTS' ||
        userMsg.toLowerCase().includes('before requesting a new code') ||
        userMsg.toLowerCase().includes('wait')
      ) {
        const remaining = (err as any).details?.remainingSeconds || (err as any).details?.cooldownSeconds || 60;
        setOtpPurpose('SIGNUP');
        setOtpCode('');
        setCooldown(remaining);
        setSuccessNotice('A verification code was recently sent. Please enter the 6-digit code sent to your email.');
        setMode('otp_verification');
        return;
      }

      setLocalError(userMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Handle Passwordless Login (Send OTP)
   */
  const handleSendLoginOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setSuccessNotice(null);
    clearError();

    const cleanEmail = email.trim().toLowerCase();
    if (!validateEmailFormat(cleanEmail)) {
      setLocalError('Enter a valid email address.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await requestOtp({ email: cleanEmail, purpose: 'LOGIN' });
      setOtpPurpose('LOGIN');
      setOtpCode('');
      setCooldown(res.cooldownSeconds || 60);
      setSuccessNotice(res.message || 'Verification code sent to your email.');
      setMode('otp_verification');
    } catch (err: any) {
      const normalized = normalizeApiError(err);
      let userMsg = normalized.message;
      if (
        normalized.code === 'TOO_MANY_REQUESTS' ||
        userMsg.toLowerCase().includes('before requesting a new code') ||
        userMsg.toLowerCase().includes('wait')
      ) {
        const remaining = (err as any).details?.remainingSeconds || (err as any).details?.cooldownSeconds || 60;
        setOtpPurpose('LOGIN');
        setOtpCode('');
        setCooldown(remaining);
        setSuccessNotice('A login code was recently sent. Please enter the 6-digit code sent to your email.');
        setMode('otp_verification');
        return;
      }
      setLocalError(userMsg || 'Unable to send verification code. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Handle Password Login
   */
  const handlePasswordLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setSuccessNotice(null);
    clearError();

    const cleanEmail = email.trim().toLowerCase();
    if (!validateEmailFormat(cleanEmail)) {
      setLocalError('Enter a valid email address.');
      return;
    }

    if (!password) {
      setLocalError('Please enter your password.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await login({ email: cleanEmail, password });

      // If account email is unverified, backend challenges with OTP
      if (res && res.requiresOtp) {
        setOtpPurpose('SIGNUP');
        setOtpCode('');
        setCooldown(res.cooldownSeconds || 60);
        setSuccessNotice('Your email is not yet verified. A 6-digit code has been sent to your inbox.');
        setMode('otp_verification');
        return;
      }

      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      const normalized = normalizeApiError(err);
      let userMsg = normalized.message;
      if (normalized.code === 'UNAUTHORIZED' || userMsg.toLowerCase().includes('invalid email or password')) {
        userMsg = 'Incorrect email or password. Please verify and try again.';
      }
      setLocalError(userMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Handle OTP Verification
   */
  const handleVerifyOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setSuccessNotice(null);
    clearError();

    const cleanCode = otpCode.trim();
    if (!cleanCode || cleanCode.length !== 6 || !/^\d{6}$/.test(cleanCode)) {
      setLocalError('Please enter the 6-digit verification code.');
      return;
    }

    if (otpPurpose === 'PASSWORD_RESET') {
      if (!newPassword || newPassword.length < 8) {
        setLocalError('New password must be at least 8 characters long.');
        return;
      }
    }

    try {
      setIsSubmitting(true);
      if (otpPurpose === 'PASSWORD_RESET') {
        await resetPassword({
          email: email.trim().toLowerCase(),
          code: cleanCode,
          newPassword
        });
        setSuccessNotice('Password reset successful! Please sign in with your new password.');
        setMode('login');
        setLoginMethod('password');
        setPassword('');
        return;
      }

      // SIGNUP or LOGIN verification
      await verifyOtp({
        email: email.trim().toLowerCase(),
        code: cleanCode,
        purpose: otpPurpose
      });

      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      const normalized = normalizeApiError(err);
      let userMsg = normalized.message;
      if (userMsg.toLowerCase().includes('expired')) {
        userMsg = 'That code has expired. Request a new code.';
      } else if (userMsg.toLowerCase().includes('too many attempts')) {
        userMsg = 'Too many attempts. Please request a new code.';
      } else if (userMsg.toLowerCase().includes('incorrect code')) {
        userMsg = 'Incorrect code. Please try again.';
      }
      setLocalError(userMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Resend OTP
   */
  const handleResendOtp = async () => {
    if (cooldown > 0) return;
    setLocalError(null);
    setSuccessNotice(null);
    clearError();

    try {
      setIsSubmitting(true);
      const res = await resendOtp({
        email: email.trim().toLowerCase(),
        purpose: otpPurpose
      });
      setCooldown(res.cooldownSeconds || 60);
      setSuccessNotice('Verification code sent to your email.');
    } catch (err: any) {
      const normalized = normalizeApiError(err);
      if (
        normalized.code === 'TOO_MANY_REQUESTS' ||
        normalized.message.toLowerCase().includes('wait')
      ) {
        const remaining = (err as any).details?.remainingSeconds || (err as any).details?.cooldownSeconds || 60;
        setCooldown(remaining);
        setSuccessNotice(normalized.message);
      } else {
        setLocalError(normalized.message || 'Unable to resend code. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Handle Forgot Password Request
   */
  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setSuccessNotice(null);
    clearError();

    const cleanEmail = email.trim().toLowerCase();
    if (!validateEmailFormat(cleanEmail)) {
      setLocalError('Enter a valid email address.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await requestOtp({ email: cleanEmail, purpose: 'PASSWORD_RESET' });
      setOtpPurpose('PASSWORD_RESET');
      setOtpCode('');
      setNewPassword('');
      setCooldown(res.cooldownSeconds || 60);
      setSuccessNotice('If an account exists with this email, a verification code has been dispatched.');
      setMode('otp_verification');
    } catch (err: any) {
      const normalized = normalizeApiError(err);
      setLocalError(normalized.message || 'Unable to process password reset.');
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Google Sign-In with friendly fallback
   */
  const handleGoogleSignIn = async () => {
    try {
      setSocialLoading('google');
      setLocalError(null);
      clearError();

      const googleClientId = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID;

      // Clean administrator/configuration fallback
      if (!googleClientId || !(window as any).google?.accounts?.id) {
        setLocalError('Google sign-in is temporarily unavailable. Please use email sign-in.');
        return;
      }

      (window as any).google.accounts.id.prompt(async (notification: any) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          setLocalError('Google sign-in popup was dismissed or blocked. Please try again.');
          setSocialLoading(null);
        }
      });
    } catch (err: any) {
      setLocalError('Google sign-in is temporarily unavailable. Please use email sign-in.');
    } finally {
      setSocialLoading(null);
    }
  };

  /**
   * LinkedIn Sign-In with friendly fallback
   */
  const handleLinkedInSignIn = async () => {
    try {
      setSocialLoading('linkedin');
      setLocalError(null);
      clearError();

      const linkedInClientId = (import.meta as any).env?.VITE_LINKEDIN_CLIENT_ID;

      // Clean administrator/configuration fallback
      if (!linkedInClientId) {
        setLocalError('LinkedIn sign-in is temporarily unavailable. Please use email sign-in.');
        return;
      }

      const redirectUri = encodeURIComponent(`${window.location.origin}/auth/linkedin/callback`);
      const scope = encodeURIComponent('openid profile email');
      const state = encodeURIComponent(Math.random().toString(36).substring(2));
      window.location.href = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${linkedInClientId}&redirect_uri=${redirectUri}&scope=${scope}&state=${state}`;
    } catch (err: any) {
      setLocalError('LinkedIn sign-in is temporarily unavailable. Please use email sign-in.');
    } finally {
      setSocialLoading(null);
    }
  };

  const switchMode = (newMode: 'login' | 'register') => {
    setMode(newMode);
    setCooldown(0);
    setLocalError(null);
    setSuccessNotice(null);
    clearError();
    if (onNavigateMode) {
      onNavigateMode(newMode);
    }
  };

  const rawError = localError || error;
  const isCooldownMsg = Boolean(rawError && (rawError.toLowerCase().includes('before requesting a new code') || rawError.toLowerCase().includes('wait')));
  const activeError = (isCooldownMsg && (mode === 'register' || mode === 'login')) ? null : rawError;

  return (
    <div className="auth-card" role="region" aria-label="Pilot Mama Authentication">
      {/* Brand & Heading */}
      <div className="auth-header">
        <div className="auth-logo-center">
          <PilotMamaLogo variant="full" size="md" />
        </div>
        <h1 className="auth-title">
          {mode === 'otp_verification'
            ? 'Verify Your Email'
            : mode === 'forgot_password'
              ? 'Reset Your Password'
              : mode === 'login'
                ? 'Welcome Back'
                : 'Create Your Account'}
        </h1>
        <p className="auth-subtitle">
          {mode === 'otp_verification'
            ? `Enter the 6-digit verification code sent to ${email}`
            : mode === 'forgot_password'
              ? 'Enter your registered email to receive a password reset code.'
              : mode === 'login'
                ? 'Sign in to access your AI job tracker and tailored resume pipeline.'
                : 'Join Pilot Mama to navigate your career with zero-fabrication AI.'}
        </p>
      </div>

      {/* Notifications & Error State */}
      {activeError && (
        <div className="auth-error-banner" role="alert">
          <AlertCircle size={18} className="auth-error-icon" />
          <div className="auth-error-content">
            <span className="auth-error-text">{activeError}</span>
            {activeError.includes('already exists') && (
              <button
                type="button"
                className="auth-error-action-btn"
                onClick={() => {
                  switchMode('login');
                  setLoginMethod('password');
                }}
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      )}

      {successNotice && (
        <div className="auth-success-banner" role="status">
          <CheckCircle2 size={18} className="auth-success-icon" />
          <span className="auth-success-text">{successNotice}</span>
        </div>
      )}

      {/* MODE 1: OTP VERIFICATION */}
      {mode === 'otp_verification' && (
        <form className="auth-form" onSubmit={handleVerifyOtpSubmit} noValidate>
          <div className="auth-field">
            <label className="auth-label" htmlFor="auth-otp">
              6-Digit Verification Code
            </label>
            <div className="auth-input-wrap">
              <KeyRound size={18} className="auth-input-icon" aria-hidden="true" />
              <input
                id="auth-otp"
                name="otp"
                type="text"
                required
                maxLength={6}
                autoFocus
                className="auth-input auth-otp-input"
                placeholder="123456"
                value={otpCode}
                onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                disabled={isSubmitting}
                autoComplete="one-time-code"
              />
            </div>
            <div className="auth-resend-row">
              <span className="auth-resend-text">Didn't receive the code?</span>
              <button
                type="button"
                className="auth-link-btn"
                onClick={handleResendOtp}
                disabled={isSubmitting || cooldown > 0}
                aria-disabled={isSubmitting || cooldown > 0}
              >
                <RotateCw size={13} className={isSubmitting ? 'spinning' : ''} />
                <span>{cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend Code'}</span>
              </button>
            </div>
          </div>

          {otpPurpose === 'PASSWORD_RESET' && (
            <div className="auth-field">
              <label className="auth-label" htmlFor="auth-new-password">
                New Password
              </label>
              <div className="auth-input-wrap">
                <Lock size={18} className="auth-input-icon" aria-hidden="true" />
                <input
                  id="auth-new-password"
                  name="newPassword"
                  type={showPassword ? 'text' : 'password'}
                  required
                  className="auth-input"
                  placeholder="At least 8 characters"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  className="auth-password-toggle"
                  onClick={() => setShowPassword(prev => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
          )}

          <button
            type="submit"
            className="auth-submit-btn"
            disabled={isSubmitting || otpCode.length !== 6}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={18} className="spinning" />
                <span>Verifying...</span>
              </>
            ) : (
              <>
                <span>{otpPurpose === 'PASSWORD_RESET' ? 'Reset Password' : 'Verify & Continue'}</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>

          <button
            type="button"
            className="auth-back-btn"
            onClick={() => {
              setMode(otpPurpose === 'SIGNUP' ? 'register' : 'login');
              setCooldown(0);
              setLocalError(null);
              setSuccessNotice(null);
              setOtpCode('');
            }}
          >
            <ArrowLeft size={14} /> Back to {otpPurpose === 'SIGNUP' ? 'Sign Up' : 'Sign In'}
          </button>
        </form>
      )}

      {/* MODE 2: FORGOT PASSWORD REQUEST */}
      {mode === 'forgot_password' && (
        <form className="auth-form" onSubmit={handleForgotPasswordSubmit} noValidate>
          <div className="auth-field">
            <label className="auth-label" htmlFor="auth-email-forgot">
              Registered Email Address
            </label>
            <div className="auth-input-wrap">
              <Mail size={18} className="auth-input-icon" aria-hidden="true" />
              <input
                id="auth-email-forgot"
                name="email"
                type="email"
                required
                className="auth-input"
                placeholder="you@domain.com"
                value={email}
                onChange={e => { setEmail(e.target.value); if (cooldown > 0) setCooldown(0); if (localError) setLocalError(null); }}
                disabled={isSubmitting}
                autoComplete="email"
              />
            </div>
          </div>

          <button
            type="submit"
            className="auth-submit-btn"
            disabled={isSubmitting || !email}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={18} className="spinning" />
                <span>Sending Code...</span>
              </>
            ) : (
              <>
                <span>Send Verification Code</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>

          <button
            type="button"
            className="auth-back-btn"
            onClick={() => {
              setMode('login');
              setLocalError(null);
            }}
          >
            <ArrowLeft size={14} /> Back to Sign In
          </button>
        </form>
      )}

      {/* MODE 3: LOGIN / SIGNUP MAIN */}
      {(mode === 'login' || mode === 'register') && (
        <>
          {/* Social Authentication: Google & LinkedIn */}
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
                  <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                </svg>
              )}
              <span>{socialLoading === 'linkedin' ? 'Connecting to LinkedIn...' : 'Continue with LinkedIn'}</span>
            </button>
          </div>

          {/* Divider */}
          <div className="auth-divider" role="separator">
            <span className="auth-divider-line" />
            <span className="auth-divider-text">
              {mode === 'login' ? 'or continue with email' : 'or sign up with email'}
            </span>
            <span className="auth-divider-line" />
          </div>

          {/* Login Method Sub-Toggle (OTP vs Password) */}
          {mode === 'login' && (
            <div className="auth-method-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={loginMethod === 'otp'}
                className={`auth-method-tab ${loginMethod === 'otp' ? 'active' : ''}`}
                onClick={() => setLoginMethod('otp')}
              >
                Email Code (Passwordless)
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={loginMethod === 'password'}
                className={`auth-method-tab ${loginMethod === 'password' ? 'active' : ''}`}
                onClick={() => setLoginMethod('password')}
              >
                Password
              </button>
            </div>
          )}

          {/* Form */}
          <form
            className="auth-form"
            onSubmit={
              mode === 'register'
                ? handleRegisterSubmit
                : loginMethod === 'otp'
                  ? handleSendLoginOtp
                  : handlePasswordLoginSubmit
            }
            noValidate
          >
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
                    onChange={e => { setFullName(e.target.value); if (localError) setLocalError(null); }}
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

            {(mode === 'register' || loginMethod === 'password') && (
              <div className="auth-field">
                <div className="auth-field-header">
                  <label className="auth-label" htmlFor="auth-password">
                    Password
                  </label>
                  {mode === 'login' && loginMethod === 'password' && (
                    <button
                      type="button"
                      className="auth-forgot-link"
                      onClick={() => {
                        setMode('forgot_password');
                        setLocalError(null);
                      }}
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
                    onChange={e => { setPassword(e.target.value); if (localError) setLocalError(null); }}
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
            )}

            <button
              type="submit"
              className="auth-submit-btn"
              disabled={isSubmitting || Boolean(socialLoading)}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={18} className="spinning" />
                  <span>
                    {mode === 'register'
                      ? 'Creating Account...'
                      : loginMethod === 'otp'
                        ? 'Sending Code...'
                        : 'Signing in...'}
                  </span>
                </>
              ) : (
                <>
                  <span>
                    {mode === 'register'
                      ? 'Create Account'
                      : loginMethod === 'otp'
                        ? 'Send Verification Code'
                        : 'Sign In'}
                  </span>
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
        </>
      )}
    </div>
  );
};
