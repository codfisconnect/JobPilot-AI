import React, { useEffect, useState } from 'react';
import { apiClient } from '../../api/client';
import {
  Globe,
  Plus,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  Sliders,
  Trash2,
  Briefcase,
  Building,
  Radio,
  Search,
  Check,
  Eye,
  X,
  Code
} from 'lucide-react';
import './AdminPages.css';

interface AdminJobSourcesProps {
  onViewJobs?: (companyName?: string) => void;
  preselectedSourceId?: string;
}

export const AdminJobSources: React.FC<AdminJobSourcesProps> = ({ onViewJobs, preselectedSourceId }) => {
  const [sources, setSources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Discovery Form State
  const [urlInput, setUrlInput] = useState('');
  const [discovering, setDiscovering] = useState(false);
  const [discoveryStep, setDiscoveryStep] = useState(0);
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);
  const [discoverySuccess, setDiscoverySuccess] = useState<any | null>(null);

  // Discovery step labels matching requirement
  const discoverySteps = [
    'Validating URL & SSRF safeguards',
    'Fetching careers page',
    'Detecting job source & endpoints',
    'Finding jobs endpoint',
    'Analyzing job schema & data arrays',
    'Identifying canonical company',
    'Building deterministic field mapping',
    'Syncing and normalizing jobs into PostgreSQL',
    'Completed'
  ];

  // Sync Progress State
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncStep, setSyncStep] = useState<string | null>(null);
  const [syncModalResult, setSyncModalResult] = useState<any | null>(null);

  // Detail Modal / View State
  const [selectedSourceDetail, setSelectedSourceDetail] = useState<any | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Manual / Advanced Configuration Override
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [manualEndpoint, setManualEndpoint] = useState('');

  const [actionError, setActionError] = useState<string | null>(null);

  const loadSources = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getAdminJobSources();
      setSources(data || []);
    } catch (err: any) {
      console.error('Failed to load job sources:', err);
      setActionError(err.message || 'Failed to load job sources');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSources();
  }, []);

  useEffect(() => {
    if (preselectedSourceId) {
      handleOpenDetail(preselectedSourceId);
    }
  }, [preselectedSourceId]);

  const handleDiscover = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;

    try {
      setDiscovering(true);
      setDiscoveryError(null);
      setDiscoverySuccess(null);
      setDiscoveryStep(0);

      // Animate progress states smoothly
      const interval = setInterval(() => {
        setDiscoveryStep(prev => (prev < discoverySteps.length - 2 ? prev + 1 : prev));
      }, 700);

      const res = await apiClient.discoverJobSource(urlInput.trim());

      clearInterval(interval);
      setDiscoveryStep(discoverySteps.length - 1);
      setDiscoverySuccess(res);
      setUrlInput('');
      await loadSources();
    } catch (err: any) {
      setDiscoveryError(err.message || 'Could not find a structured jobs feed on this page.');
    } finally {
      setDiscovering(false);
    }
  };

  const handleSyncNow = async (id: string) => {
    try {
      setSyncingId(id);
      setActionError(null);
      setSyncStep('Fetching source...');
      
      const stepTimer1 = setTimeout(() => setSyncStep('Normalizing jobs & calculating hashes...'), 400);
      const stepTimer2 = setTimeout(() => setSyncStep('Deduplicating & persisting to PostgreSQL...'), 800);
      const stepTimer3 = setTimeout(() => setSyncStep('Finalizing ingestion metrics...'), 1200);

      const res = await apiClient.syncAdminJobSource(id);

      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      clearTimeout(stepTimer3);

      setSyncModalResult(res.sync);
      await loadSources();
    } catch (err: any) {
      setActionError(err.message || 'Failed to sync source');
    } finally {
      setSyncingId(null);
      setSyncStep(null);
    }
  };

  const handleOpenDetail = async (id: string) => {
    try {
      setLoadingDetail(true);
      const detail = await apiClient.getAdminJobSourceById(id);
      setSelectedSourceDetail(detail.data || detail);
    } catch (err: any) {
      setActionError('Failed to load job source detail: ' + err.message);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleToggleEnable = async (source: any) => {
    try {
      await apiClient.updateAdminJobSource(source.id, { enabled: !source.enabled });
      await loadSources();
    } catch (err: any) {
      setActionError(err.message || 'Failed to update source');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to remove this job source configuration?')) return;
    try {
      await apiClient.deleteAdminJobSource(id);
      await loadSources();
    } catch (err: any) {
      setActionError(err.message || 'Failed to delete source');
    }
  };

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
          <h1 className="admin-page-title">Universal Job Sources</h1>
          <p className="admin-page-desc">
            Autonomous job source onboarding. Provide any careers page URL, and Pilot Mama discovers APIs, maps fields, and ingests canonical jobs.
          </p>
        </div>
      </div>

      {actionError && (
        <div style={{ padding: '12px 16px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', color: '#f87171', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertTriangle size={18} />
          <span>{actionError}</span>
        </div>
      )}

      {/* Sync Outcome Modal */}
      {syncModalResult && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: 'var(--bg-surface, #1e293b)', border: '1px solid var(--border-subtle, #334155)', borderRadius: '12px', padding: '24px', maxWidth: '420px', width: '100%', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#4ade80', fontWeight: 700 }}>
                <CheckCircle2 size={20} />
                <span>Sync Completed Successfully</span>
              </div>
              <button onClick={() => setSyncModalResult(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.9rem', marginBottom: '20px' }}>
              <div style={{ padding: '10px', background: 'rgba(255,255,255,0.04)', borderRadius: '8px' }}><strong>Created:</strong> {syncModalResult.created}</div>
              <div style={{ padding: '10px', background: 'rgba(255,255,255,0.04)', borderRadius: '8px' }}><strong>Updated:</strong> {syncModalResult.updated}</div>
              <div style={{ padding: '10px', background: 'rgba(255,255,255,0.04)', borderRadius: '8px' }}><strong>Skipped:</strong> {syncModalResult.skipped}</div>
              <div style={{ padding: '10px', background: 'rgba(255,255,255,0.04)', borderRadius: '8px' }}><strong>Failed:</strong> {syncModalResult.failed}</div>
            </div>
            <button
              onClick={() => setSyncModalResult(null)}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', background: 'var(--accent-primary, #6366f1)', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer' }}
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* A. Add Job Source Card */}
      <div className="admin-metric-card" style={{ padding: '24px', background: 'var(--bg-surface, #1e293b)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <Radio size={20} style={{ color: 'var(--accent-primary, #6366f1)' }} />
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>Add Job Source</h2>
        </div>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary, #94a3b8)', marginBottom: '16px' }}>
          Enter the company's careers or jobs page URL. The engine handles URL validation, API discovery, schema inference, company resolution, and immediate ingestion.
        </p>

        <form onSubmit={handleDiscover} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 340px' }}>
            <input
              type="url"
              required
              placeholder="https://company.com/careers"
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              disabled={discovering}
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle, #334155)',
                background: 'rgba(0, 0, 0, 0.2)',
                color: 'var(--text-primary, #f8fafc)',
                fontSize: '0.95rem'
              }}
            />
          </div>
          <button
            type="submit"
            disabled={discovering || !urlInput.trim()}
            style={{
              padding: '12px 24px',
              borderRadius: '8px',
              background: 'var(--accent-primary, #6366f1)',
              color: '#fff',
              border: 'none',
              fontWeight: 600,
              fontSize: '0.95rem',
              cursor: discovering ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              opacity: discovering || !urlInput.trim() ? 0.7 : 1
            }}
          >
            {discovering ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>Discovering...</span>
              </>
            ) : (
              <>
                <Search size={18} />
                <span>Discover & Connect</span>
              </>
            )}
          </button>
        </form>

        {/* Live Discovery Progress Stepper */}
        {discovering && (
          <div style={{ marginTop: '20px', padding: '16px', background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.2)', borderRadius: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <Loader2 size={16} className="animate-spin" style={{ color: '#818cf8' }} />
              <span style={{ fontWeight: 600, color: '#818cf8', fontSize: '0.9rem' }}>
                {discoverySteps[discoveryStep]}
              </span>
            </div>
            <div style={{ height: '4px', width: '100%', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  background: 'var(--accent-primary, #6366f1)',
                  width: `${((discoveryStep + 1) / discoverySteps.length) * 100}%`,
                  transition: 'width 0.4s ease'
                }}
              />
            </div>
          </div>
        )}

        {/* Discovery Success Summary Banner */}
        {discoverySuccess && (
          <div style={{ marginTop: '20px', padding: '16px', borderRadius: '8px', background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.25)', color: '#4ade80' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
                <CheckCircle2 size={18} />
                <span>Source Successfully Connected</span>
              </div>
              <button
                onClick={() => onViewJobs?.(discoverySuccess.discovery?.company)}
                style={{ padding: '6px 12px', borderRadius: '6px', background: 'rgba(34, 197, 94, 0.2)', border: 'none', color: '#fff', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
              >
                View Jobs →
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px', fontSize: '0.85rem', color: 'var(--text-primary, #f8fafc)' }}>
              <div><strong>Company:</strong> {discoverySuccess.discovery?.company}</div>
              <div><strong>Source:</strong> {discoverySuccess.discovery?.detectedType}</div>
              <div><strong>Jobs Found:</strong> {discoverySuccess.discovery?.jobCount}</div>
              <div><strong>Created:</strong> {discoverySuccess.sync?.created}</div>
              <div><strong>Updated:</strong> {discoverySuccess.sync?.updated}</div>
              <div><strong>Status:</strong> Healthy</div>
            </div>
          </div>
        )}

        {/* Discovery Failure Banner */}
        {discoveryError && (
          <div style={{ marginTop: '20px', padding: '16px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', color: '#f87171' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, marginBottom: '6px' }}>
              <XCircle size={18} />
              <span>Discovery Notice</span>
            </div>
            <p style={{ margin: '0 0 10px', fontSize: '0.88rem' }}>{discoveryError}</p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setDiscoveryError(null)}
                style={{ padding: '6px 12px', borderRadius: '6px', background: 'rgba(255,255,255,0.08)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '0.8rem' }}
              >
                Dismiss
              </button>
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                style={{ padding: '6px 12px', borderRadius: '6px', background: 'rgba(255,255,255,0.08)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '0.8rem' }}
              >
                Manual Source Configuration
              </button>
            </div>
          </div>
        )}

        {/* Advanced Manual Endpoint Override (Exception path only) */}
        {showAdvanced && (
          <div style={{ marginTop: '20px', padding: '16px', background: 'rgba(0, 0, 0, 0.2)', border: '1px solid var(--border-subtle, #334155)', borderRadius: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Sliders size={16} />
              <h3 style={{ fontSize: '0.95rem', margin: 0 }}>Advanced Configuration Override</h3>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #94a3b8)', marginBottom: '12px' }}>
              If auto-discovery could not extract the endpoint from complex client-side bundles, enter the direct JSON jobs API URL below:
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                type="url"
                placeholder="Direct Jobs API URL (e.g. https://company.com/api/jobs)"
                value={manualEndpoint}
                onChange={e => setManualEndpoint(e.target.value)}
                style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', border: '1px solid #334155', background: '#0f172a', color: '#fff', fontSize: '0.85rem' }}
              />
              <button
                type="button"
                onClick={() => {
                  setUrlInput(manualEndpoint);
                  setShowAdvanced(false);
                }}
                style={{ padding: '8px 16px', borderRadius: '6px', background: 'var(--accent-primary, #6366f1)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '0.85rem' }}
              >
                Use Endpoint
              </button>
            </div>
          </div>
        )}
      </div>

      {/* B. Connected Sources Table */}
      <div className="admin-table-container">
        <div className="admin-table-controls">
          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Connected Sources</h2>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #94a3b8)' }}>
              {sources.length} active autonomous source configurations
            </span>
          </div>

          <button
            onClick={loadSources}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '6px',
              background: 'rgba(255,255,255,0.06)',
              color: 'var(--text-primary, #f8fafc)',
              border: '1px solid var(--border-subtle, #334155)',
              fontSize: '0.85rem',
              cursor: 'pointer'
            }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px', gap: '12px' }}>
            <Loader2 className="animate-spin text-primary" size={24} />
            <span>Loading connected sources...</span>
          </div>
        ) : sources.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-secondary, #94a3b8)' }}>
            <Globe size={40} style={{ opacity: 0.4, marginBottom: '12px' }} />
            <p style={{ margin: 0, fontWeight: 500 }}>No job sources connected yet.</p>
            <p style={{ margin: '4px 0 0', fontSize: '0.85rem' }}>Use the Add Job Source URL form above to connect your first career page.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="admin-data-table">
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Source URL</th>
                  <th>Detected Type</th>
                  <th>Jobs</th>
                  <th>Last Sync</th>
                  <th>Last Successful Sync</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sources.map(src => {
                  const isSyncing = syncingId === src.id;
                  const isHealthy = src.healthStatus === 'HEALTHY';
                  const isFailing = src.healthStatus === 'FAILING';

                  return (
                    <tr key={src.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: '32px', height: '32px', borderRadius: '6px', background: 'rgba(99, 102, 241, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818cf8', fontWeight: 700, fontSize: '0.85rem' }}>
                            {src.company?.name?.[0] || 'C'}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary, #f8fafc)' }}>
                              {src.company?.name || 'Unknown Company'}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #64748b)' }}>
                              {src.company?.officialDomain || 'domain.com'}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td>
                        <a
                          href={src.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--accent-primary, #818cf8)', textDecoration: 'none', fontSize: '0.85rem', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        >
                          <span>{src.sourceUrl}</span>
                          <ExternalLink size={12} />
                        </a>
                      </td>

                      <td>
                        <span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: '4px', background: 'rgba(255,255,255,0.07)', fontSize: '0.78rem', fontWeight: 600, color: '#e2e8f0' }}>
                          {src.sourceType}
                        </span>
                      </td>

                      <td>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary, #f8fafc)' }}>
                          {src.jobsFound || 0}
                        </span>
                      </td>

                      <td>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary, #94a3b8)' }}>
                          {formatRelativeTime(src.lastSyncAt)}
                        </span>
                      </td>

                      <td>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary, #94a3b8)' }}>
                          {formatRelativeTime(src.lastSuccessfulSyncAt)}
                        </span>
                      </td>

                      <td>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '3px 8px',
                          borderRadius: '12px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          background: isHealthy ? 'rgba(34, 197, 94, 0.15)' : isFailing ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                          color: isHealthy ? '#4ade80' : isFailing ? '#f87171' : '#fbbf24'
                        }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'currentColor' }} />
                          {src.healthStatus}
                        </span>
                      </td>

                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <button
                            onClick={() => handleSyncNow(src.id)}
                            disabled={isSyncing}
                            title="Sync Now"
                            style={{
                              padding: '5px 8px',
                              borderRadius: '6px',
                              background: 'rgba(99, 102, 241, 0.15)',
                              color: '#818cf8',
                              border: '1px solid rgba(99, 102, 241, 0.3)',
                              fontSize: '0.78rem',
                              fontWeight: 600,
                              cursor: isSyncing ? 'not-allowed' : 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <RefreshCw size={12} className={isSyncing ? 'animate-spin' : ''} />
                            <span>{isSyncing ? (syncStep || 'Syncing...') : 'Sync Now'}</span>
                          </button>

                          <button
                            onClick={() => onViewJobs?.(src.company?.name)}
                            title="View Jobs"
                            style={{
                              padding: '5px 8px',
                              borderRadius: '6px',
                              background: 'rgba(255, 255, 255, 0.06)',
                              color: 'var(--text-primary, #f8fafc)',
                              border: '1px solid var(--border-subtle, #334155)',
                              fontSize: '0.78rem',
                              cursor: 'pointer'
                            }}
                          >
                            View Jobs
                          </button>

                          <button
                            onClick={() => handleOpenDetail(src.id)}
                            title="View Source Details"
                            style={{
                              padding: '5px 8px',
                              borderRadius: '6px',
                              background: 'rgba(255, 255, 255, 0.06)',
                              color: 'var(--text-secondary, #94a3b8)',
                              border: '1px solid var(--border-subtle, #334155)',
                              fontSize: '0.78rem',
                              cursor: 'pointer'
                            }}
                          >
                            <Eye size={12} />
                          </button>

                          <button
                            onClick={() => handleToggleEnable(src)}
                            title={src.enabled ? 'Disable' : 'Enable'}
                            style={{
                              padding: '5px 8px',
                              borderRadius: '6px',
                              background: 'rgba(255, 255, 255, 0.06)',
                              color: 'var(--text-muted, #64748b)',
                              border: '1px solid var(--border-subtle, #334155)',
                              fontSize: '0.78rem',
                              cursor: 'pointer'
                            }}
                          >
                            {src.enabled ? 'Disable' : 'Enable'}
                          </button>

                          <button
                            onClick={() => handleDelete(src.id)}
                            title="Delete"
                            style={{
                              padding: '5px 7px',
                              borderRadius: '6px',
                              background: 'rgba(239, 68, 68, 0.1)',
                              color: '#f87171',
                              border: '1px solid rgba(239, 68, 68, 0.2)',
                              fontSize: '0.78rem',
                              cursor: 'pointer'
                            }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* C. Source Details Modal (Inspect field mapping, endpoints, and health) */}
      {selectedSourceDetail && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: 'var(--bg-surface, #1e293b)', border: '1px solid var(--border-subtle, #334155)', borderRadius: '12px', padding: '24px', maxWidth: '720px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-primary, #f8fafc)' }}>
                  {selectedSourceDetail.company?.name || 'Job Source Configuration'}
                </h2>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary, #94a3b8)' }}>
                  {selectedSourceDetail.company?.officialDomain || 'domain.com'} • {selectedSourceDetail.sourceType}
                </span>
              </div>
              <button
                onClick={() => setSelectedSourceDetail(null)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* General Properties */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '20px', fontSize: '0.85rem' }}>
              <div><strong>Original Careers URL:</strong> <a href={selectedSourceDetail.sourceUrl} target="_blank" rel="noreferrer" style={{ color: '#818cf8', wordBreak: 'break-all' }}>{selectedSourceDetail.sourceUrl}</a></div>
              <div><strong>Detected Jobs Endpoint:</strong> <span style={{ color: '#cbd5e1', wordBreak: 'break-all' }}>{selectedSourceDetail.jobsEndpoint || 'Direct Page'}</span></div>
              <div><strong>Parser Type:</strong> {selectedSourceDetail.parserType}</div>
              <div><strong>Health Status:</strong> {selectedSourceDetail.healthStatus}</div>
              <div><strong>Jobs Discovered:</strong> {selectedSourceDetail.jobsFound || 0}</div>
              <div><strong>Last Sync:</strong> {formatRelativeTime(selectedSourceDetail.lastSyncAt)}</div>
              <div><strong>Last Successful:</strong> {formatRelativeTime(selectedSourceDetail.lastSuccessfulSyncAt)}</div>
              {selectedSourceDetail.lastSyncError && (
                <div style={{ color: '#f87171' }}><strong>Last Error:</strong> {selectedSourceDetail.lastSyncError}</div>
              )}
            </div>

            {/* Inferred Field Mapping Table */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                <Code size={16} />
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>Active Field Mapping Configuration</h3>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid var(--border-subtle, #334155)', borderRadius: '8px', padding: '12px', fontFamily: 'monospace', fontSize: '0.82rem' }}>
                {selectedSourceDetail.mappingConfig && Object.keys(selectedSourceDetail.mappingConfig).length > 0 ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '8px', alignItems: 'center' }}>
                    {Object.entries(selectedSourceDetail.mappingConfig).map(([canonicalKey, sourceKey]: [string, any]) => (
                      <React.Fragment key={canonicalKey}>
                        <span style={{ color: '#818cf8' }}>{String(sourceKey || '(none)')}</span>
                        <span style={{ color: 'var(--text-muted, #64748b)' }}>→</span>
                        <span style={{ color: '#34d399' }}>{canonicalKey.replace('Field', '')}</span>
                      </React.Fragment>
                    ))}
                  </div>
                ) : (
                  <span style={{ color: 'var(--text-muted)' }}>No custom mapping overrides registered.</span>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => setSelectedSourceDetail(null)}
                style={{ padding: '8px 16px', borderRadius: '8px', background: 'rgba(255,255,255,0.08)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '0.85rem' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
