import React, { useEffect, useState } from 'react';
import { apiClient } from '../../api/client';
import {
  Users,
  FileText,
  Briefcase,
  Send,
  Building2,
  Layers,
  CreditCard,
  Coins,
  TrendingUp,
  Loader2,
  AlertCircle
} from 'lucide-react';
import './AdminPages.css';

export const AdminDashboardOverview: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
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
    }
    load();
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px', gap: '12px' }}>
        <Loader2 className="animate-spin text-primary" size={32} />
        <span>Loading production database metrics...</span>
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

  return (
    <div className="admin-page-container">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Executive Platform Overview</h1>
          <p className="admin-page-desc">Real-time statistics directly queried from the PostgreSQL production database.</p>
        </div>
      </div>

      <div className="admin-grid-metrics">
        {/* Candidates */}
        <div className="admin-metric-card">
          <div className="admin-metric-top">
            <span className="admin-metric-lbl">Total Candidates</span>
            <div className="admin-metric-icon" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8' }}>
              <Users size={20} />
            </div>
          </div>
          <div className="admin-metric-val">{data?.totalCandidates || 0}</div>
          <div className="admin-metric-sub">
            <TrendingUp size={14} style={{ color: '#34d399' }} />
            <span>+{data?.candidatesToday || 0} today • +{data?.candidatesThisWeek || 0} this week</span>
          </div>
        </div>

        {/* Resumes */}
        <div className="admin-metric-card">
          <div className="admin-metric-top">
            <span className="admin-metric-lbl">Candidates with Resumes</span>
            <div className="admin-metric-icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>
              <FileText size={20} />
            </div>
          </div>
          <div className="admin-metric-val">{data?.candidatesWithResumes || 0}</div>
          <div className="admin-metric-sub">
            <span>Verified candidate profile vaults</span>
          </div>
        </div>

        {/* Active Jobs */}
        <div className="admin-metric-card">
          <div className="admin-metric-top">
            <span className="admin-metric-lbl">Active Jobs</span>
            <div className="admin-metric-icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' }}>
              <Briefcase size={20} />
            </div>
          </div>
          <div className="admin-metric-val">{data?.totalActiveJobs || 0}</div>
          <div className="admin-metric-sub">
            <span>Aggregated canonical opportunities</span>
          </div>
        </div>

        {/* Applications */}
        <div className="admin-metric-card">
          <div className="admin-metric-top">
            <span className="admin-metric-lbl">Total Applications</span>
            <div className="admin-metric-icon" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc' }}>
              <Send size={20} />
            </div>
          </div>
          <div className="admin-metric-val">{data?.totalApplications || 0}</div>
          <div className="admin-metric-sub">
            <span>Submissions tracked across candidates</span>
          </div>
        </div>

        {/* Employers */}
        <div className="admin-metric-card">
          <div className="admin-metric-top">
            <span className="admin-metric-lbl">Employer Organizations</span>
            <div className="admin-metric-icon" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' }}>
              <Building2 size={20} />
            </div>
          </div>
          <div className="admin-metric-val">{data?.totalEmployers || 0}</div>
          <div className="admin-metric-sub">
            <span>Recruiters & hiring companies</span>
          </div>
        </div>

        {/* Subscriptions */}
        <div className="admin-metric-card">
          <div className="admin-metric-top">
            <span className="admin-metric-lbl">Active Subscriptions</span>
            <div className="admin-metric-icon" style={{ background: 'rgba(236, 72, 153, 0.15)', color: '#f472b6' }}>
              <Layers size={20} />
            </div>
          </div>
          <div className="admin-metric-val">{data?.activeSubscriptions || 0}</div>
          <div className="admin-metric-sub">
            <span>Paying tier subscribers</span>
          </div>
        </div>

        {/* Revenue */}
        <div className="admin-metric-card">
          <div className="admin-metric-top">
            <span className="admin-metric-lbl">Total Settled Revenue</span>
            <div className="admin-metric-icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>
              <CreditCard size={20} />
            </div>
          </div>
          <div className="admin-metric-val">
            ₹{((data?.paymentsSummary?.totalRevenue || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="admin-metric-sub">
            <span>{data?.paymentsSummary?.successfulPaymentsCount || 0} captured transactions</span>
          </div>
        </div>

        {/* Credits */}
        <div className="admin-metric-card">
          <div className="admin-metric-top">
            <span className="admin-metric-lbl">Credit Pool In Circulation</span>
            <div className="admin-metric-icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' }}>
              <Coins size={20} />
            </div>
          </div>
          <div className="admin-metric-val">
            {(data?.creditsSummary?.totalBalance || 0).toLocaleString()}
          </div>
          <div className="admin-metric-sub">
            <span>{data?.creditsSummary?.lifetimeConsumed || 0} consumed lifetime</span>
          </div>
        </div>
      </div>
    </div>
  );
};
