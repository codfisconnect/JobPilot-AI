import React, { useEffect, useState } from 'react';
import { apiClient } from '../../api/client';
import {
  Users,
  Briefcase,
  Send,
  Building2,
  Layers,
  CreditCard,
  Coins,
  TrendingUp,
  Loader2,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  Clock,
  ArrowRight
} from 'lucide-react';
import './AdminPages.css';

interface AdminDashboardOverviewProps {
  onNavigateSection?: (section: string) => void;
}

export const AdminDashboardOverview: React.FC<AdminDashboardOverviewProps> = ({ onNavigateSection }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiClient.getAdminDashboard();
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch platform metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '12px' }}>
        <Loader2 className="animate-spin text-primary" size={32} />
        <span style={{ color: 'var(--text-secondary)' }}>Loading production operations metrics...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-page-container">
        <div style={{ padding: '20px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', color: '#f87171', display: 'flex', gap: '12px', alignItems: 'center' }}>
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  const formatRelativeTime = (dateStr?: string) => {
    if (!dateStr) return 'Never';
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div className="admin-page-container">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Operations Command Center</h1>
          <p className="admin-page-desc">
            Real-time platform metrics, job ingestion health, and candidate pipeline statistics from PostgreSQL.
          </p>
        </div>
        <button
          onClick={loadData}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderRadius: '8px',
            background: 'rgba(255, 255, 255, 0.06)',
            color: 'var(--text-primary, #f8fafc)',
            border: '1px solid var(--border-subtle, #334155)',
            fontSize: '0.85rem',
            cursor: 'pointer'
          }}
        >
          <RefreshCw size={14} />
          <span>Refresh Live Data</span>
        </button>
      </div>

      {/* Primary KPI Metrics Grid */}
      <div className="admin-grid-metrics">
        {/* Total Candidates */}
        <div className="admin-metric-card" style={{ cursor: 'pointer' }} onClick={() => onNavigateSection?.('candidates')}>
          <div className="admin-metric-top">
            <span className="admin-metric-lbl">Total Candidates</span>
            <div className="admin-metric-icon" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8' }}>
              <Users size={20} />
            </div>
          </div>
          <div className="admin-metric-val">{data?.totalCandidates ?? 0}</div>
          <div className="admin-metric-sub">
            <TrendingUp size={14} style={{ color: '#34d399' }} />
            <span>+{data?.candidatesToday ?? 0} today • +{data?.candidatesThisWeek ?? 0} this week</span>
          </div>
        </div>

        {/* Active Jobs */}
        <div className="admin-metric-card" style={{ cursor: 'pointer' }} onClick={() => onNavigateSection?.('jobs')}>
          <div className="admin-metric-top">
            <span className="admin-metric-lbl">Active Jobs</span>
            <div className="admin-metric-icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' }}>
              <Briefcase size={20} />
            </div>
          </div>
          <div className="admin-metric-val">{data?.totalActiveJobs ?? 0}</div>
          <div className="admin-metric-sub">
            <span>Aggregated canonical opportunities</span>
          </div>
        </div>

        {/* Connected Job Sources */}
        <div className="admin-metric-card" style={{ cursor: 'pointer' }} onClick={() => onNavigateSection?.('job-sources')}>
          <div className="admin-metric-top">
            <span className="admin-metric-lbl">Connected Job Sources</span>
            <div className="admin-metric-icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>
              <Layers size={20} />
            </div>
          </div>
          <div className="admin-metric-val">{data?.connectedJobSources ?? 0}</div>
          <div className="admin-metric-sub">
            <span style={{ color: '#4ade80' }}>{data?.healthyJobSources ?? 0} healthy</span>
            {data?.failingJobSources ? <span style={{ color: '#f87171', marginLeft: '6px' }}>• {data.failingJobSources} issues</span> : null}
          </div>
        </div>

        {/* Jobs Added & Updated Today */}
        <div className="admin-metric-card" style={{ cursor: 'pointer' }} onClick={() => onNavigateSection?.('jobs')}>
          <div className="admin-metric-top">
            <span className="admin-metric-lbl">Sync Activity Today</span>
            <div className="admin-metric-icon" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8' }}>
              <RefreshCw size={20} />
            </div>
          </div>
          <div className="admin-metric-val">+{data?.jobsAddedToday ?? 0}</div>
          <div className="admin-metric-sub">
            <span>{data?.jobsUpdatedToday ?? 0} updated • {data?.jobsExpiredToday ?? 0} expired</span>
          </div>
        </div>

        {/* Global Synchronization Schedule */}
        <div className="admin-metric-card" style={{ cursor: 'pointer' }} onClick={() => onNavigateSection?.('job-sources')}>
          <div className="admin-metric-top">
            <span className="admin-metric-lbl">Automated Schedule</span>
            <div className="admin-metric-icon" style={{ background: 'rgba(234, 179, 8, 0.15)', color: '#facc15' }}>
              <Clock size={20} />
            </div>
          </div>
          <div className="admin-metric-val" style={{ fontSize: '1.25rem', marginTop: '6px' }}>
            {data?.nextGlobalSync ? formatRelativeTime(data.nextGlobalSync).replace('ago', 'from now') : 'Every 6 hours'}
          </div>
          <div className="admin-metric-sub">
            <span>Last sync: {formatRelativeTime(data?.lastGlobalSync)}</span>
          </div>
        </div>

        {/* Total Applications */}
        <div className="admin-metric-card" style={{ cursor: 'pointer' }} onClick={() => onNavigateSection?.('applications')}>
          <div className="admin-metric-top">
            <span className="admin-metric-lbl">Applications</span>
            <div className="admin-metric-icon" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc' }}>
              <Send size={20} />
            </div>
          </div>
          <div className="admin-metric-val">{data?.totalApplications ?? 0}</div>
          <div className="admin-metric-sub">
            <span>Submissions tracked across candidates</span>
          </div>
        </div>

        {/* Employers */}
        <div className="admin-metric-card" style={{ cursor: 'pointer' }} onClick={() => onNavigateSection?.('employers')}>
          <div className="admin-metric-top">
            <span className="admin-metric-lbl">Employers</span>
            <div className="admin-metric-icon" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' }}>
              <Building2 size={20} />
            </div>
          </div>
          <div className="admin-metric-val">{data?.totalEmployers ?? 0}</div>
          <div className="admin-metric-sub">
            <span>Recruiters & hiring companies</span>
          </div>
        </div>

        {/* Revenue */}
        <div className="admin-metric-card" style={{ cursor: 'pointer' }} onClick={() => onNavigateSection?.('payments')}>
          <div className="admin-metric-top">
            <span className="admin-metric-lbl">Revenue / Payments</span>
            <div className="admin-metric-icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>
              <CreditCard size={20} />
            </div>
          </div>
          <div className="admin-metric-val">
            ₹{((data?.paymentsSummary?.totalRevenue ?? 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="admin-metric-sub">
            <span>{data?.paymentsSummary?.successfulPaymentsCount ?? 0} settled transactions</span>
          </div>
        </div>
      </div>

      {/* Recent Activity Sections */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
        {/* Recent Job Source Syncs */}
        <div className="admin-table-container">
          <div className="admin-table-controls">
            <div>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Recent Job Source Syncs</h2>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #94a3b8)' }}>Automated ingestions</span>
            </div>
            {onNavigateSection && (
              <button
                onClick={() => onNavigateSection('job-sources')}
                style={{ background: 'none', border: 'none', color: '#818cf8', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <span>View all</span>
                <ArrowRight size={14} />
              </button>
            )}
          </div>
          <div style={{ padding: '8px 16px' }}>
            {(!data?.recentActivity?.recentSyncs || data.recentActivity.recentSyncs.length === 0) ? (
              <p style={{ color: 'var(--text-secondary, #94a3b8)', fontSize: '0.85rem', padding: '16px 0' }}>No source sync activity recorded yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '8px 0' }}>
                {data.recentActivity.recentSyncs.map((sync: any) => (
                  <div key={sync.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary, #f8fafc)' }}>{sync.company?.name || 'Company Source'}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted, #64748b)' }}>
                        {sync.jobsFound || 0} jobs found • {sync.sourceType}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        background: sync.healthStatus === 'HEALTHY' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        color: sync.healthStatus === 'HEALTHY' ? '#4ade80' : '#f87171'
                      }}>
                        {sync.healthStatus}
                      </span>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #64748b)', marginTop: '4px' }}>
                        {formatRelativeTime(sync.lastSyncAt)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Applications */}
        <div className="admin-table-container">
          <div className="admin-table-controls">
            <div>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Recent Applications</h2>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #94a3b8)' }}>Candidate submissions</span>
            </div>
            {onNavigateSection && (
              <button
                onClick={() => onNavigateSection('applications')}
                style={{ background: 'none', border: 'none', color: '#818cf8', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <span>View all</span>
                <ArrowRight size={14} />
              </button>
            )}
          </div>
          <div style={{ padding: '8px 16px' }}>
            {(!data?.recentActivity?.recentApplications || data.recentActivity.recentApplications.length === 0) ? (
              <p style={{ color: 'var(--text-secondary, #94a3b8)', fontSize: '0.85rem', padding: '16px 0' }}>No applications submitted yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '8px 0' }}>
                {data.recentActivity.recentApplications.map((app: any) => (
                  <div key={app.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary, #f8fafc)' }}>{app.candidate?.fullName || 'Candidate'}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted, #64748b)' }}>
                        Applied to {app.job?.title || 'Job'} at {app.job?.company?.name || 'Company'}
                      </div>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #64748b)' }}>
                      {formatRelativeTime(app.createdAt)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Candidate Registrations */}
        <div className="admin-table-container">
          <div className="admin-table-controls">
            <div>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Recent Registrations</h2>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #94a3b8)' }}>New candidate signups</span>
            </div>
            {onNavigateSection && (
              <button
                onClick={() => onNavigateSection('candidates')}
                style={{ background: 'none', border: 'none', color: '#818cf8', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <span>View all</span>
                <ArrowRight size={14} />
              </button>
            )}
          </div>
          <div style={{ padding: '8px 16px' }}>
            {(!data?.recentActivity?.recentRegistrations || data.recentActivity.recentRegistrations.length === 0) ? (
              <p style={{ color: 'var(--text-secondary, #94a3b8)', fontSize: '0.85rem', padding: '16px 0' }}>No candidate registrations recorded yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '8px 0' }}>
                {data.recentActivity.recentRegistrations.map((user: any) => (
                  <div key={user.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary, #f8fafc)' }}>
                        {user.candidateProfile?.fullName || 'Incomplete Profile'}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted, #64748b)' }}>
                        {user.email}
                      </div>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #64748b)' }}>
                      {formatRelativeTime(user.createdAt)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
