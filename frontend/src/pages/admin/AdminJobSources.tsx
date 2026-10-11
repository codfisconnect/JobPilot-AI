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
  Check
} from 'lucide-react';
import './AdminPages.css';

export const AdminJobSources: React.FC = () => {
  const [sources, setSources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Discovery Form State
  const [urlInput, setUrlInput] = useState('');
  const [discovering, setDiscovering] = useState(false);
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);
  const [discoverySuccess, setDiscoverySuccess] = useState<any | null>(null);

  // Manual / Advanced configuration drawer
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [manualEndpoint, setManualEndpoint] = useState('');

  // Action states
  const [syncingId, setSyncingId] = useState<string | null>(null);
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

  const handleDiscover = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;

    try {
      setDiscovering(true);
      setDiscoveryError(null);
      setDiscoverySuccess(null);

      const res = await apiClient.discoverJobSource(urlInput.trim());

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
      await apiClient.syncAdminJobSource(id);
      await loadSources();
    } catch (err: any) {
      setActionError(err.message || 'Failed to sync source');
    } finally {
      setSyncingId(null);
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
    if (mins < 60) return `${mins} min${mins > 1 ? 's' : ''} ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} hr${hours > 1 ? 's' : ''} ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  };

  return (
    <div className="admin-page-container">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Universal Job Sources & Onboarding</h1>
          <p className="admin-page-desc">
            Connect any company careers or jobs page with a single URL. Pilot Mama automatically discovers endpoints, maps schemas, and synchronizes jobs.
          </p>
        </div>
      </div>

      {actionError && (
        <div style={{ padding: '12px 16px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', color: '#f87171', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertTriangle size={18} />
          <span>{actionError}</span>
        </div>
      )}

      {/* A. Add Job Source Card */}
      <div className="admin-metric-card" style={{ padding: '24px', background: 'var(--bg-surface, #1e293b)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <Radio size={20} style={{ color: 'var(--accent-primary, #6366f1)' }} />
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>Add Job Source</h2>
        </div>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary, #94a3b8)', marginBottom: '16px' }}>
          Enter the company's careers or jobs URL. The backend will inspect the page, detect APIs or JSON feeds, infer the schema, and import jobs immediately.
        </p>

        <form onSubmit={handleDiscover} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 340px', position: 'relative' }}>
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
                <span>Discovering & Connecting...</span>
              </>
            ) : (
              <>
                <Search size={18} />
                <span>Discover & Connect</span>
              </>
            )}
          </button>
        </form>

        {/* Discovery Success Banner */}
        {discoverySuccess && (
          <div style={{ marginTop: '20px', padding: '16px', borderRadius: '8px', background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.25)', color: '#4ade80' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, marginBottom: '6px' }}>
              <CheckCircle2 size={18} />
              <span>Job Source Connected Successfully!</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px', marginTop: '10px', fontSize: '0.85rem', color: 'var(--text-primary, #f8fafc)' }}>
              <div><strong>Company:</strong> {discoverySuccess.discovery?.company}</div>
              <div><strong>Detected Source:</strong> {discoverySuccess.discovery?.detectedType}</div>
              <div><strong>Jobs Discovered:</strong> {discoverySuccess.discovery?.jobCount}</div>
              <div><strong>Jobs Created:</strong> {discoverySuccess.sync?.created}</div>
              <div><strong>Jobs Updated:</strong> {discoverySuccess.sync?.updated}</div>
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

        {/* Fallback Manual / Advanced Configuration */}
        {showAdvanced && (
          <div style={{ marginTop: '20px', padding: '16px', background: 'rgba(0, 0, 0, 0.2)', border: '1px solid var(--border-subtle, #334155)', borderRadius: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <Sliders size={16} />
              <h3 style={{ fontSize: '0.95rem', margin: 0 }}>Advanced Source Configuration (Exception Path)</h3>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #94a3b8)', marginBottom: '12px' }}>
              If auto-discovery could not detect a feed automatically, you may specify the direct JSON endpoint URL below.
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                type="url"
                placeholder="Direct Jobs JSON Endpoint (e.g. https://company.com/api/jobs)"
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

      {/* B. Connected Job Sources Table */}
      <div className="admin-table-container">
        <div className="admin-table-controls">
          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Connected Job Sources</h2>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #94a3b8)' }}>
              Active universal connectors ({sources.length} sources)
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
            <p style={{ margin: '4px 0 0', fontSize: '0.85rem' }}>Use the "Add Job Source" form above to connect your first career page URL.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="admin-data-table">
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Source URL</th>
                  <th>Detected Source</th>
                  <th>Jobs Imported</th>
                  <th>Last Sync</th>
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
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--accent-primary, #818cf8)', textDecoration: 'none', fontSize: '0.85rem', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
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
                          {src.jobsFound || 0} jobs
                        </span>
                      </td>

                      <td>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary, #94a3b8)' }}>
                          {formatRelativeTime(src.lastSyncAt)}
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button
                            onClick={() => handleSyncNow(src.id)}
                            disabled={isSyncing}
                            title="Sync Now"
                            style={{
                              padding: '6px 10px',
                              borderRadius: '6px',
                              background: 'rgba(99, 102, 241, 0.15)',
                              color: '#818cf8',
                              border: '1px solid rgba(99, 102, 241, 0.3)',
                              fontSize: '0.8rem',
                              fontWeight: 600,
                              cursor: isSyncing ? 'not-allowed' : 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <RefreshCw size={13} className={isSyncing ? 'animate-spin' : ''} />
                            <span>Sync Now</span>
                          </button>

                          <button
                            onClick={() => handleToggleEnable(src)}
                            title={src.enabled ? 'Disable Source' : 'Enable Source'}
                            style={{
                              padding: '6px 10px',
                              borderRadius: '6px',
                              background: 'rgba(255, 255, 255, 0.06)',
                              color: 'var(--text-secondary, #94a3b8)',
                              border: '1px solid var(--border-subtle, #334155)',
                              fontSize: '0.8rem',
                              cursor: 'pointer'
                            }}
                          >
                            {src.enabled ? 'Disable' : 'Enable'}
                          </button>

                          <button
                            onClick={() => handleDelete(src.id)}
                            title="Remove Source"
                            style={{
                              padding: '6px 8px',
                              borderRadius: '6px',
                              background: 'rgba(239, 68, 68, 0.1)',
                              color: '#f87171',
                              border: '1px solid rgba(239, 68, 68, 0.2)',
                              fontSize: '0.8rem',
                              cursor: 'pointer'
                            }}
                          >
                            <Trash2 size={13} />
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
    </div>
  );
};
