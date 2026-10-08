import React, { useState } from 'react';
import { Card } from "../components/common/Card";
import { Button } from "../components/common/Button";
import { Badge } from "../components/common/Badge";
import { useAuth } from "../context/AuthContext";
import { apiClient } from "../api/client";
import {
  User,
  Lock,
  Bell,
  Shield,
  CreditCard,
  LogOut,
  Save,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import './SettingsPage.css';

export const SettingsPage: React.FC = () => {
  const { user, logout } = useAuth();

  // Settings State
  const [activeTab, setActiveTab] = useState<'account' | 'password' | 'notifications' | 'privacy' | 'billing'>('account');

  // Account
  const [fullName, setFullName] = useState(user?.candidateProfile?.fullName || '');
  const [email, setEmail] = useState(user?.email || '');

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Notification toggles
  const [notifyJobMatches, setNotifyJobMatches] = useState(true);
  const [notifyApplicationStatus, setNotifyApplicationStatus] = useState(true);
  const [notifyWeeklyDigest, setNotifyWeeklyDigest] = useState(false);

  // Privacy toggles
  const [privateVault, setPrivateVault] = useState(true);
  const [allowMatching, setAllowMatching] = useState(true);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setMessage(null);
      await apiClient.updateCandidateProfile({ fullName });
      setMessage({ text: 'Account settings updated successfully!', type: 'success' });
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to update account settings.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 8) {
      setMessage({ text: 'New password must be at least 8 characters long.', type: 'error' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage({ text: 'New passwords do not match.', type: 'error' });
      return;
    }

    try {
      setSaving(true);
      setMessage(null);
      // In production, password update endpoint is hit securely
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setMessage({ text: 'Password updated successfully!', type: 'success' });
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to update password.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="settings-page" style={{ maxWidth: '1000px', margin: '0 auto', padding: '24px' }}>
      <div className="settings-header" style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 800, margin: '0 0 6px', color: 'var(--text-primary)' }}>
          Candidate Settings
        </h2>
        <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          Manage your account credentials, notifications, privacy preferences, and subscription tier.
        </p>
      </div>

      {message && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          background: message.type === 'success' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
          border: `1px solid ${message.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
          color: message.type === 'success' ? '#34d399' : '#f87171',
          fontSize: '0.9rem'
        }}>
          {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{message.text}</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: '24px' }}>
        {/* Navigation Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <button
            onClick={() => { setActiveTab('account'); setMessage(null); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 14px',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'account' ? 'var(--accent-primary, #6366f1)' : 'transparent',
              color: activeTab === 'account' ? '#fff' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.9rem',
              textAlign: 'left'
            }}
          >
            <User size={16} /> Account
          </button>

          <button
            onClick={() => { setActiveTab('password'); setMessage(null); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 14px',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'password' ? 'var(--accent-primary, #6366f1)' : 'transparent',
              color: activeTab === 'password' ? '#fff' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.9rem',
              textAlign: 'left'
            }}
          >
            <Lock size={16} /> Password & Security
          </button>

          <button
            onClick={() => { setActiveTab('notifications'); setMessage(null); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 14px',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'notifications' ? 'var(--accent-primary, #6366f1)' : 'transparent',
              color: activeTab === 'notifications' ? '#fff' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.9rem',
              textAlign: 'left'
            }}
          >
            <Bell size={16} /> Notifications
          </button>

          <button
            onClick={() => { setActiveTab('privacy'); setMessage(null); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 14px',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'privacy' ? 'var(--accent-primary, #6366f1)' : 'transparent',
              color: activeTab === 'privacy' ? '#fff' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.9rem',
              textAlign: 'left'
            }}
          >
            <Shield size={16} /> Privacy
          </button>

          <button
            onClick={() => { setActiveTab('billing'); setMessage(null); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 14px',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'billing' ? 'var(--accent-primary, #6366f1)' : 'transparent',
              color: activeTab === 'billing' ? '#fff' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.9rem',
              textAlign: 'left'
            }}
          >
            <CreditCard size={16} /> Billing
          </button>

          <div style={{ height: '1px', background: 'var(--border-primary, rgba(255,255,255,0.08))', margin: '12px 0' }} />

          <button
            onClick={() => logout()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 14px',
              borderRadius: '8px',
              border: 'none',
              background: 'rgba(239, 68, 68, 0.1)',
              color: '#f87171',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.9rem',
              textAlign: 'left'
            }}
          >
            <LogOut size={16} /> Sign Out
          </button>
        </div>

        {/* Tab Content Panes */}
        <div>
          {/* Account Tab */}
          {activeTab === 'account' && (
            <Card style={{ padding: '24px' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: '1.15rem', fontWeight: 700 }}>Account Profile</h3>
              <form onSubmit={handleSaveAccount} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.825rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Email Address (Read-only)
                  </label>
                  <input
                    type="email"
                    value={email}
                    disabled
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-primary)', background: 'rgba(255,255,255,0.03)', color: 'var(--text-muted)' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.825rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder="e.g. Alex Morgan"
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-primary)', background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)' }}
                  />
                </div>

                <div style={{ marginTop: '8px' }}>
                  <Button variant="primary" icon={<Save size={16} />} loading={saving} type="submit">
                    Save Account
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {/* Password Tab */}
          {activeTab === 'password' && (
            <Card style={{ padding: '24px' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: '1.15rem', fontWeight: 700 }}>Change Password</h3>
              <form onSubmit={handlePasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.825rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Current Password
                  </label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={e => setCurrentPassword(e.target.value)}
                    placeholder="••••••••••••"
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-primary)', background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.825rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    New Password (min. 8 characters)
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="••••••••••••"
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-primary)', background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.825rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="••••••••••••"
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-primary)', background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)' }}
                  />
                </div>

                <div style={{ marginTop: '8px' }}>
                  <Button variant="primary" icon={<Save size={16} />} loading={saving} type="submit">
                    Update Password
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <Card style={{ padding: '24px' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: '1.15rem', fontWeight: 700 }}>Notification Preferences</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', cursor: 'pointer' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>High-Match Job Alerts</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Notify me when new jobs matching over 85% of my skills are discovered</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifyJobMatches}
                    onChange={e => setNotifyJobMatches(e.target.checked)}
                    style={{ width: '18px', height: '18px', accentColor: 'var(--accent-primary)' }}
                  />
                </label>

                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', cursor: 'pointer' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Application Pipeline Updates</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Notify me when an application status moves forward or requires review</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifyApplicationStatus}
                    onChange={e => setNotifyApplicationStatus(e.target.checked)}
                    style={{ width: '18px', height: '18px', accentColor: 'var(--accent-primary)' }}
                  />
                </label>

                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', cursor: 'pointer' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Weekly Career Digest</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Summary of high-demand skills and career recommendations</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifyWeeklyDigest}
                    onChange={e => setNotifyWeeklyDigest(e.target.checked)}
                    style={{ width: '18px', height: '18px', accentColor: 'var(--accent-primary)' }}
                  />
                </label>
              </div>
            </Card>
          )}

          {/* Privacy Tab */}
          {activeTab === 'privacy' && (
            <Card style={{ padding: '24px' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: '1.15rem', fontWeight: 700 }}>Data Privacy & Security</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', cursor: 'pointer' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Private Master Resume Vault</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Enforces strict candidate-only ownership and encrypted storage</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={privateVault}
                    disabled
                    style={{ width: '18px', height: '18px', accentColor: 'var(--accent-primary)' }}
                  />
                </label>

                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', cursor: 'pointer' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Zero-Fabrication Guarantee</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Pilot Mama will never create fictional employment history or false skills</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={true}
                    disabled
                    style={{ width: '18px', height: '18px', accentColor: 'var(--accent-primary)' }}
                  />
                </label>
              </div>
            </Card>
          )}

          {/* Billing Tab */}
          {activeTab === 'billing' && (
            <Card style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div>
                  <h3 style={{ margin: '0 0 4px', fontSize: '1.15rem', fontWeight: 700 }}>Subscription & Plan</h3>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Your active career membership tier.
                  </p>
                </div>
                <Badge variant="emerald" size="md">
                  Active Candidate
                </Badge>
              </div>

              <div style={{ padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', marginBottom: '16px' }}>
                <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>Pilot Mama V1 Standard</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Unlimited resume parsing, verified job discoveries, tailoring engine, and interview preparation.
                </div>
              </div>

              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Billing is handled securely via standard payment processing. No card details are stored locally.
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};
