import React, { useState, useEffect, useRef } from 'react';
import { apiClient } from '../../api/client';
import {
  Layers,
  ArrowLeft,
  Upload,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Loader2,
  RefreshCw,
  Search,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  FileText,
  StopCircle,
  Check
} from 'lucide-react';
import './AdminPages.css';
import { normalizeApiError, NormalizedError } from '../../utils/errorUtils';

interface BulkJobSourcesPageProps {
  onBackToSources: () => void;
  onViewJobs?: (companyName?: string) => void;
}

export const BulkJobSourcesPage: React.FC<BulkJobSourcesPageProps> = ({ onBackToSources, onViewJobs }) => {
  // Input State
  const [inputText, setInputText] = useState('');
  const [concurrency, setConcurrency] = useState(4);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Validation Preview State
  const [validating, setValidating] = useState(false);
  const [previewResult, setPreviewResult] = useState<any | null>(null);
  const [validationError, setValidationError] = useState<NormalizedError | null>(null);

  // Execution / Active Bulk Job State
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [activeJob, setActiveJob] = useState<any | null>(null);
  const [activeItems, setActiveItems] = useState<any[]>([]);
  const [startingDiscovery, setStartingDiscovery] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Detail Modal State
  const [selectedItemDetail, setSelectedItemDetail] = useState<any | null>(null);

  // History Tab / Previous Runs State
  const [historyRuns, setHistoryRuns] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [activeTab, setActiveTab] = useState<'create' | 'history'>('create');

  // Polling for Active Job
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    const pollJobStatus = async () => {
      if (!activeJobId) return;

      try {
        const [jobRes, itemsRes] = await Promise.all([
          apiClient.getBulkJobSourceJob(activeJobId),
          apiClient.getBulkJobSourceItems(activeJobId)
        ]);

        if (jobRes?.job) {
          setActiveJob(jobRes.job);
        }
        if (itemsRes?.items) {
          setActiveItems(itemsRes.items);
        }

        // If job reached terminal state, stop polling
        if (
          jobRes?.job?.status === 'COMPLETED' ||
          jobRes?.job?.status === 'PARTIAL' ||
          jobRes?.job?.status === 'FAILED' ||
          jobRes?.job?.status === 'CANCELLED'
        ) {
          return;
        }

        timer = setTimeout(pollJobStatus, 2500);
      } catch (err: any) {
        console.error('Error polling bulk job:', err);
        timer = setTimeout(pollJobStatus, 5000);
      }
    };

    if (activeJobId) {
      pollJobStatus();
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [activeJobId]);

  const loadHistory = async () => {
    try {
      setLoadingHistory(true);
      const res = await apiClient.getBulkJobSourcesHistory(1, 25);
      if (res?.imports) {
        setHistoryRuns(res.imports);
      }
    } catch (err: any) {
      console.error('Failed to load bulk history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleValidate = async () => {
    setValidationError(null);
    setActionError(null);

    const urls = inputText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    if (urls.length === 0) {
      setValidationError({
        code: 'VALIDATION_EMPTY',
        message: 'Please paste at least one URL before validating.'
      });
      return;
    }

    if (urls.length > 100) {
      setValidationError({
        code: 'LIMIT_EXCEEDED',
        message: 'Maximum 100 sources per batch allowed.'
      });
      return;
    }

    try {
      setValidating(true);
      const res = await apiClient.validateBulkJobSources({ urls });
      if (res?.preview) {
        setPreviewResult(res.preview);
      }
    } catch (err: any) {
      const norm = normalizeApiError(err, 'Failed to validate URLs');
      setValidationError(norm);
    } finally {
      setValidating(false);
    }
  };

  const handleStartBulkDiscovery = async () => {
    if (!previewResult) {
      await handleValidate();
    }

    const urls = (previewResult?.items || [])
      .filter((it: any) => it.isValid && !it.isDuplicateInBatch && !it.isAlreadyConnected)
      .map((it: any) => it.rawUrl);

    if (urls.length === 0) {
      setActionError('No new valid sources available to onboard in this batch.');
      return;
    }

    try {
      setStartingDiscovery(true);
      setActionError(null);

      const res = await apiClient.startBulkJobSources({
        urls: inputText
          .split('\n')
          .map(line => line.trim())
          .filter(line => line.length > 0),
        maxConcurrency: concurrency
      });

      if (res?.bulkJobId) {
        setActiveJobId(res.bulkJobId);
      }
    } catch (err: any) {
      const norm = normalizeApiError(err, 'Failed to start bulk discovery');
      setActionError(norm.message);
    } finally {
      setStartingDiscovery(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = event => {
      const text = (event.target?.result as string) || '';
      let extractedUrls: string[] = [];

      if (file.name.endsWith('.csv')) {
        // Simple CSV parser: first column or header "url"
        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        if (lines.length > 0) {
          const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
          const urlIndex = headers.indexOf('url') !== -1 ? headers.indexOf('url') : 0;
          const startIndex = headers.includes('url') ? 1 : 0;

          for (let i = startIndex; i < lines.length; i++) {
            const cols = lines[i].split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
            if (cols[urlIndex]) extractedUrls.push(cols[urlIndex]);
          }
        }
      } else {
        // Plain TXT: one URL per line
        extractedUrls = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      }

      setInputText(extractedUrls.join('\n'));
      setPreviewResult(null);
      setValidationError(null);
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCancelPending = async () => {
    if (!activeJobId) return;
    try {
      await apiClient.cancelBulkJobSourceJob(activeJobId);
      const res = await apiClient.getBulkJobSourceJob(activeJobId);
      if (res?.job) setActiveJob(res.job);
    } catch (err: any) {
      const norm = normalizeApiError(err, 'Failed to cancel bulk job');
      setActionError(norm.message);
    }
  };

  const handleRetryItem = async (itemId: string) => {
    if (!activeJobId) return;
    try {
      await apiClient.retryBulkJobSourceItem(activeJobId, itemId);
      const [jobRes, itemsRes] = await Promise.all([
        apiClient.getBulkJobSourceJob(activeJobId),
        apiClient.getBulkJobSourceItems(activeJobId)
      ]);
      if (jobRes?.job) setActiveJob(jobRes.job);
      if (itemsRes?.items) setActiveItems(itemsRes.items);
    } catch (err: any) {
      const norm = normalizeApiError(err, 'Failed to retry item');
      setActionError(norm.message);
    }
  };

  return (
    <div className="admin-page-container">
      {/* Navigation Header */}
      <div className="admin-page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={onBackToSources}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--border-subtle, #334155)',
              color: 'var(--text-primary, #f8fafc)',
              borderRadius: '8px',
              padding: '8px 12px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.875rem'
            }}
          >
            <ArrowLeft size={16} /> Back to Job Sources
          </button>
          <div>
            <h1 className="admin-page-title">Bulk Job Source Onboarding</h1>
            <p className="admin-page-desc">
              Onboard multiple employer career portals at once. Autonomous discovery, universal pagination, and canonical ingestion.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setActiveTab('create')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'create' ? 'var(--accent-primary, #6366f1)' : 'rgba(255,255,255,0.05)',
              color: '#fff',
              fontWeight: 600,
              fontSize: '0.875rem',
              cursor: 'pointer'
            }}
          >
            New Batch
          </button>
          <button
            onClick={() => {
              setActiveTab('history');
              loadHistory();
            }}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'history' ? 'var(--accent-primary, #6366f1)' : 'rgba(255,255,255,0.05)',
              color: '#fff',
              fontWeight: 600,
              fontSize: '0.875rem',
              cursor: 'pointer'
            }}
          >
            Batch History
          </button>
        </div>
      </div>

      {actionError && (
        <div style={{ padding: '12px 16px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', color: '#f87171', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertTriangle size={18} />
          <span>{actionError}</span>
        </div>
      )}

      {/* VIEW: BATCH HISTORY */}
      {activeTab === 'history' && (
        <div className="admin-metric-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>Recent Bulk Import Runs</h2>
            <button
              onClick={loadHistory}
              disabled={loadingHistory}
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid var(--border-subtle, #334155)',
                color: 'var(--text-primary)',
                padding: '6px 12px',
                borderRadius: '6px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer'
              }}
            >
              <RefreshCw size={14} className={loadingHistory ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>

          {loadingHistory ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
              <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 8px' }} />
              <p>Loading history runs...</p>
            </div>
          ) : historyRuns.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '32px' }}>
              No bulk import runs recorded yet.
            </p>
          ) : (
            <div className="admin-table-container">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Total Sources</th>
                    <th>Completed</th>
                    <th>Partial</th>
                    <th>Failed</th>
                    <th>Jobs Discovered</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {historyRuns.map(run => (
                    <tr key={run.id}>
                      <td>{new Date(run.createdAt).toLocaleString()}</td>
                      <td>
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            background:
                              run.status === 'COMPLETED'
                                ? 'rgba(74, 222, 128, 0.15)'
                                : run.status === 'PARTIAL'
                                ? 'rgba(250, 204, 21, 0.15)'
                                : run.status === 'RUNNING'
                                ? 'rgba(99, 102, 241, 0.15)'
                                : 'rgba(239, 68, 68, 0.15)',
                            color:
                              run.status === 'COMPLETED'
                                ? '#4ade80'
                                : run.status === 'PARTIAL'
                                ? '#facc15'
                                : run.status === 'RUNNING'
                                ? '#818cf8'
                                : '#f87171'
                          }}
                        >
                          {run.status}
                        </span>
                      </td>
                      <td>{run.totalSources}</td>
                      <td>{run.completedSources}</td>
                      <td>{run.partialSources}</td>
                      <td>{run.failedSources}</td>
                      <td><strong>{run.totalJobsDiscovered}</strong></td>
                      <td>
                        <button
                          onClick={() => {
                            setActiveJobId(run.id);
                            setActiveTab('create');
                          }}
                          style={{
                            background: 'rgba(255,255,255,0.06)',
                            border: '1px solid var(--border-subtle)',
                            color: 'var(--text-primary)',
                            padding: '4px 10px',
                            borderRadius: '6px',
                            fontSize: '0.8rem',
                            cursor: 'pointer'
                          }}
                        >
                          View Dashboard
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* VIEW: CREATE / MONITOR ACTIVE RUN */}
      {activeTab === 'create' && (
        <>
          {/* Active Job Progress Dashboard */}
          {activeJobId && activeJob && (
            <div
              className="admin-metric-card"
              style={{
                padding: '24px',
                background: 'var(--bg-surface, #1e293b)',
                border: '1px solid var(--border-subtle, #334155)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>
                      Bulk Discovery Dashboard
                    </h2>
                    <span
                      style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        background:
                          activeJob.status === 'COMPLETED'
                            ? 'rgba(74, 222, 128, 0.15)'
                            : activeJob.status === 'PARTIAL'
                            ? 'rgba(250, 204, 21, 0.15)'
                            : activeJob.status === 'RUNNING'
                            ? 'rgba(99, 102, 241, 0.15)'
                            : 'rgba(239, 68, 68, 0.15)',
                        color:
                          activeJob.status === 'COMPLETED'
                            ? '#4ade80'
                            : activeJob.status === 'PARTIAL'
                            ? '#facc15'
                            : activeJob.status === 'RUNNING'
                            ? '#818cf8'
                            : '#f87171'
                      }}
                    >
                      {activeJob.status}
                    </span>
                  </div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '4px' }}>
                    Job ID: <code>{activeJob.id}</code> • Started {new Date(activeJob.createdAt).toLocaleTimeString()}
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  {activeJob.status === 'RUNNING' && (
                    <button
                      onClick={handleCancelPending}
                      style={{
                        background: 'rgba(239, 68, 68, 0.15)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        color: '#f87171',
                        padding: '8px 14px',
                        borderRadius: '8px',
                        fontWeight: 600,
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <StopCircle size={16} /> Cancel Pending
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setActiveJobId(null);
                      setActiveJob(null);
                      setActiveItems([]);
                      setPreviewResult(null);
                    }}
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-primary)',
                      padding: '8px 14px',
                      borderRadius: '8px',
                      fontWeight: 600,
                      fontSize: '0.85rem',
                      cursor: 'pointer'
                    }}
                  >
                    Start New Batch
                  </button>
                </div>
              </div>

              {/* Progress Summary Cards */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                  gap: '12px',
                  marginTop: '16px'
                }}
              >
                <div style={{ padding: '14px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Total Sources</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>{activeJob.totalSources}</div>
                </div>
                <div style={{ padding: '14px', background: 'rgba(74, 222, 128, 0.08)', borderRadius: '8px', borderLeft: '3px solid #4ade80' }}>
                  <div style={{ fontSize: '0.8rem', color: '#4ade80' }}>✓ Completed</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#4ade80' }}>{activeJob.completedSources}</div>
                </div>
                <div style={{ padding: '14px', background: 'rgba(250, 204, 21, 0.08)', borderRadius: '8px', borderLeft: '3px solid #facc15' }}>
                  <div style={{ fontSize: '0.8rem', color: '#facc15' }}>⚡ Partial</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#facc15' }}>{activeJob.partialSources}</div>
                </div>
                <div style={{ padding: '14px', background: 'rgba(99, 102, 241, 0.08)', borderRadius: '8px', borderLeft: '3px solid #818cf8' }}>
                  <div style={{ fontSize: '0.8rem', color: '#818cf8' }}>→ Running</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#818cf8' }}>{activeJob.runningSources}</div>
                </div>
                <div style={{ padding: '14px', background: 'rgba(148, 163, 184, 0.08)', borderRadius: '8px', borderLeft: '3px solid #94a3b8' }}>
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>◌ Queued</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#94a3b8' }}>{activeJob.queuedSources}</div>
                </div>
                <div style={{ padding: '14px', background: 'rgba(239, 68, 68, 0.08)', borderRadius: '8px', borderLeft: '3px solid #f87171' }}>
                  <div style={{ fontSize: '0.8rem', color: '#f87171' }}>✕ Failed</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f87171' }}>{activeJob.failedSources}</div>
                </div>
              </div>

              {/* Progress Bar */}
              <div style={{ marginTop: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '6px' }}>
                  <span>
                    Batch Progress: <strong>{activeJob.completedSources + activeJob.partialSources + activeJob.failedSources} / {activeJob.totalSources}</strong>
                  </span>
                  <span>
                    Discovered Jobs: <strong>{activeJob.totalJobsDiscovered}</strong> (Created: {activeJob.totalJobsCreated}, Updated: {activeJob.totalJobsUpdated})
                  </span>
                </div>
                <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      background: 'var(--accent-primary, #6366f1)',
                      width: `${Math.round(((activeJob.completedSources + activeJob.partialSources + activeJob.failedSources) / Math.max(1, activeJob.totalSources)) * 100)}%`,
                      transition: 'width 0.4s ease'
                    }}
                  />
                </div>
              </div>

              {/* Real-time Sources Table */}
              <div style={{ marginTop: '24px' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '12px' }}>
                  Per-Source Processing Pipeline
                </h3>
                <div className="admin-table-container">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Company</th>
                        <th>URL</th>
                        <th>Strategy</th>
                        <th>Jobs Discovered</th>
                        <th>Completeness</th>
                        <th>Health</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeItems.map(item => (
                        <tr key={item.id}>
                          <td>
                            <strong>{item.companyName || item.companyHint || 'Resolving...'}</strong>
                          </td>
                          <td style={{ maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <a
                              href={item.normalizedUrl || item.sourceUrl}
                              target="_blank"
                              rel="noreferrer"
                              style={{ color: 'var(--accent-primary, #818cf8)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            >
                              <span>{item.sourceUrl}</span>
                              <ExternalLink size={12} />
                            </a>
                          </td>
                          <td>
                            <code style={{ fontSize: '0.75rem', padding: '2px 6px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px' }}>
                              {item.discoveryStrategy || '—'}
                            </code>
                          </td>
                          <td>
                            {item.jobsDiscovered > 0 ? (
                              <span>
                                <strong>{item.jobsDiscovered}</strong>
                                {item.sourceTotal ? ` / ${item.sourceTotal}` : ''}
                              </span>
                            ) : (
                              '0'
                            )}
                          </td>
                          <td>
                            {item.completeness ? (
                              <span
                                style={{
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  background:
                                    item.completeness === 'COMPLETE'
                                      ? 'rgba(74, 222, 128, 0.15)'
                                      : item.completeness === 'PARTIAL'
                                      ? 'rgba(250, 204, 21, 0.15)'
                                      : 'rgba(148, 163, 184, 0.15)',
                                  color:
                                    item.completeness === 'COMPLETE'
                                      ? '#4ade80'
                                      : item.completeness === 'PARTIAL'
                                      ? '#facc15'
                                      : '#94a3b8'
                                }}
                              >
                                {item.completeness}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td>
                            {item.healthStatus ? (
                              <span
                                style={{
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  color: item.healthStatus === 'HEALTHY' ? '#4ade80' : '#facc15'
                                }}
                              >
                                {item.healthStatus}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '3px 8px',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                background:
                                  item.status === 'COMPLETED'
                                    ? 'rgba(74, 222, 128, 0.15)'
                                    : item.status === 'PARTIAL'
                                    ? 'rgba(250, 204, 21, 0.15)'
                                    : item.status === 'DISCOVERING' || item.status === 'PAGINATING'
                                    ? 'rgba(99, 102, 241, 0.15)'
                                    : item.status === 'FAILED'
                                    ? 'rgba(239, 68, 68, 0.15)'
                                    : 'rgba(148, 163, 184, 0.1)',
                                color:
                                  item.status === 'COMPLETED'
                                    ? '#4ade80'
                                    : item.status === 'PARTIAL'
                                    ? '#facc15'
                                    : item.status === 'DISCOVERING' || item.status === 'PAGINATING'
                                    ? '#818cf8'
                                    : item.status === 'FAILED'
                                    ? '#f87171'
                                    : '#94a3b8'
                              }}
                            >
                              {(item.status === 'DISCOVERING' || item.status === 'PAGINATING') && (
                                <Loader2 size={12} className="animate-spin" />
                              )}
                              {item.status}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button
                                onClick={() => setSelectedItemDetail(item)}
                                style={{
                                  background: 'rgba(255,255,255,0.06)',
                                  border: '1px solid var(--border-subtle)',
                                  color: 'var(--text-primary)',
                                  padding: '3px 8px',
                                  borderRadius: '4px',
                                  fontSize: '0.75rem',
                                  cursor: 'pointer'
                                }}
                              >
                                Details
                              </button>
                              {(item.status === 'FAILED' || item.status === 'PARTIAL') && (
                                <button
                                  onClick={() => handleRetryItem(item.id)}
                                  style={{
                                    background: 'rgba(99, 102, 241, 0.15)',
                                    border: '1px solid rgba(99, 102, 241, 0.3)',
                                    color: '#818cf8',
                                    padding: '3px 8px',
                                    borderRadius: '4px',
                                    fontSize: '0.75rem',
                                    cursor: 'pointer'
                                  }}
                                >
                                  Retry
                                </button>
                              )}
                              {item.jobsDiscovered > 0 && onViewJobs && (
                                <button
                                  onClick={() => onViewJobs(item.companyName)}
                                  style={{
                                    background: 'rgba(74, 222, 128, 0.15)',
                                    border: '1px solid rgba(74, 222, 128, 0.3)',
                                    color: '#4ade80',
                                    padding: '3px 8px',
                                    borderRadius: '4px',
                                    fontSize: '0.75rem',
                                    cursor: 'pointer'
                                  }}
                                >
                                  View Jobs
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Form Card: Paste or Upload URLs */}
          {!activeJobId && (
            <div className="admin-metric-card" style={{ padding: '24px', background: 'var(--bg-surface, #1e293b)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Layers size={22} style={{ color: 'var(--accent-primary, #6366f1)' }} />
                  <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>Add Multiple Career URLs</h2>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".txt,.csv"
                    style={{ display: 'none' }}
                    onChange={handleFileUpload}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid var(--border-subtle, #334155)',
                      color: 'var(--text-primary)',
                      padding: '8px 14px',
                      borderRadius: '8px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontSize: '0.85rem'
                    }}
                  >
                    <Upload size={16} /> Upload TXT / CSV
                  </button>
                </div>
              </div>

              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary, #94a3b8)', marginBottom: '16px' }}>
                Paste one career or jobs page URL per line. Blank lines are ignored and whitespace is trimmed automatically.
                SPA hash fragments and functional query parameters (e.g. Hexaware, SAP SuccessFactors) are safely retained.
              </p>

              <textarea
                rows={8}
                placeholder={`https://careers.caterpillar.com/en/jobs/
https://jobs.hexaware.com/#en/sites/CX_1/jobs
https://raintechsoftware.com/careers#openings
https://career44.sapsf.com/career?company=mavericsys&career_ns=job_listing_summary&navBarLevel=JOB_SEARCH
https://www.virtusa.com/careers/job-search/global/en`}
                value={inputText}
                onChange={e => {
                  setInputText(e.target.value);
                  setPreviewResult(null);
                }}
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-subtle, #334155)',
                  background: 'rgba(0, 0, 0, 0.25)',
                  color: 'var(--text-primary, #f8fafc)',
                  fontFamily: 'monospace',
                  fontSize: '0.9rem',
                  lineHeight: 1.5,
                  resize: 'vertical'
                }}
              />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  <span>Worker Concurrency:</span>
                  <select
                    value={concurrency}
                    onChange={e => setConcurrency(parseInt(e.target.value, 10))}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      background: 'rgba(0,0,0,0.3)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-subtle)'
                    }}
                  >
                    <option value={2}>2 concurrent</option>
                    <option value={4}>4 concurrent (Recommended)</option>
                    <option value={6}>6 concurrent</option>
                    <option value={8}>8 concurrent</option>
                  </select>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={handleValidate}
                    disabled={validating || !inputText.trim()}
                    style={{
                      padding: '10px 20px',
                      borderRadius: '8px',
                      background: 'rgba(255, 255, 255, 0.08)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-subtle)',
                      fontWeight: 600,
                      cursor: validating || !inputText.trim() ? 'not-allowed' : 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    {validating ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                    <span>Validate URLs</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleStartBulkDiscovery}
                    disabled={startingDiscovery || validating || !inputText.trim()}
                    style={{
                      padding: '10px 24px',
                      borderRadius: '8px',
                      background: 'var(--accent-primary, #6366f1)',
                      color: '#fff',
                      border: 'none',
                      fontWeight: 600,
                      cursor: startingDiscovery || !inputText.trim() ? 'not-allowed' : 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      opacity: startingDiscovery || !inputText.trim() ? 0.7 : 1
                    }}
                  >
                    {startingDiscovery ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                    <span>Start Bulk Discovery</span>
                  </button>
                </div>
              </div>

              {validationError && (
                <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', color: '#f87171', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertTriangle size={18} />
                  <span>{validationError.message}</span>
                </div>
              )}
            </div>
          )}

          {/* Validation Preview Card */}
          {previewResult && !activeJobId && (
            <div className="admin-metric-card" style={{ padding: '24px', background: 'var(--bg-surface, #1e293b)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Validation Preview</h3>
                <div style={{ display: 'flex', gap: '8px', fontSize: '0.85rem' }}>
                  <span style={{ padding: '4px 8px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px' }}>
                    Total: <strong>{previewResult.totalInput}</strong>
                  </span>
                  <span style={{ padding: '4px 8px', background: 'rgba(74, 222, 128, 0.15)', color: '#4ade80', borderRadius: '4px' }}>
                    New Sources: <strong>{previewResult.newSourcesCount}</strong>
                  </span>
                  <span style={{ padding: '4px 8px', background: 'rgba(250, 204, 21, 0.15)', color: '#facc15', borderRadius: '4px' }}>
                    Duplicates: <strong>{previewResult.duplicateCount}</strong>
                  </span>
                  <span style={{ padding: '4px 8px', background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', borderRadius: '4px' }}>
                    Already Connected: <strong>{previewResult.alreadyConnectedCount}</strong>
                  </span>
                  {previewResult.invalidCount > 0 && (
                    <span style={{ padding: '4px 8px', background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', borderRadius: '4px' }}>
                      Invalid: <strong>{previewResult.invalidCount}</strong>
                    </span>
                  )}
                </div>
              </div>

              <div className="admin-table-container">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Submitted URL</th>
                      <th>Detected Domain</th>
                      <th>Valid?</th>
                      <th>Status & Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewResult.items.map((it: any, idx: number) => (
                      <tr key={idx}>
                        <td style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <code>{it.rawUrl}</code>
                        </td>
                        <td>{it.domain || '—'}</td>
                        <td>
                          {it.isValid ? (
                            <span style={{ color: '#4ade80', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem' }}>
                              <CheckCircle2 size={16} /> Valid
                            </span>
                          ) : (
                            <span style={{ color: '#f87171', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem' }}>
                              <XCircle size={16} /> {it.validationError || 'Invalid'}
                            </span>
                          )}
                        </td>
                        <td>
                          {it.isAlreadyConnected ? (
                            <span style={{ padding: '3px 8px', borderRadius: '4px', background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', fontSize: '0.75rem', fontWeight: 600 }}>
                              Already Connected ({it.existingSourceName})
                            </span>
                          ) : it.isDuplicateInBatch ? (
                            <span style={{ padding: '3px 8px', borderRadius: '4px', background: 'rgba(250, 204, 21, 0.15)', color: '#facc15', fontSize: '0.75rem', fontWeight: 600 }}>
                              Duplicate in Batch (Skipped)
                            </span>
                          ) : it.isValid ? (
                            <span style={{ padding: '3px 8px', borderRadius: '4px', background: 'rgba(74, 222, 128, 0.15)', color: '#4ade80', fontSize: '0.75rem', fontWeight: 600 }}>
                              Ready to Discover
                            </span>
                          ) : (
                            <span style={{ padding: '3px 8px', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', fontSize: '0.75rem', fontWeight: 600 }}>
                              Will be rejected
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setPreviewResult(null)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleStartBulkDiscovery}
                  disabled={startingDiscovery || previewResult.newSourcesCount === 0}
                  style={{
                    padding: '8px 20px',
                    borderRadius: '8px',
                    background: 'var(--accent-primary, #6366f1)',
                    color: '#fff',
                    border: 'none',
                    fontWeight: 600,
                    cursor: startingDiscovery || previewResult.newSourcesCount === 0 ? 'not-allowed' : 'pointer'
                  }}
                >
                  Start Discovery ({previewResult.newSourcesCount} Sources)
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Item Details Modal */}
      {selectedItemDetail && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: 'var(--bg-surface, #1e293b)', border: '1px solid var(--border-subtle, #334155)', borderRadius: '12px', padding: '24px', maxWidth: '640px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>
                {selectedItemDetail.companyName || selectedItemDetail.companyHint || 'Source Details'}
              </h3>
              <button
                onClick={() => setSelectedItemDetail(null)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1.2rem' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.875rem' }}>
              <div>
                <strong style={{ color: 'var(--text-secondary)' }}>Source URL:</strong>
                <div style={{ wordBreak: 'break-all', marginTop: '2px' }}><code>{selectedItemDetail.sourceUrl}</code></div>
              </div>
              {selectedItemDetail.normalizedUrl && (
                <div>
                  <strong style={{ color: 'var(--text-secondary)' }}>Normalized Discovery URL:</strong>
                  <div style={{ wordBreak: 'break-all', marginTop: '2px' }}><code>{selectedItemDetail.normalizedUrl}</code></div>
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <strong style={{ color: 'var(--text-secondary)' }}>Status:</strong>
                  <div>{selectedItemDetail.status}</div>
                </div>
                <div>
                  <strong style={{ color: 'var(--text-secondary)' }}>Discovery Strategy:</strong>
                  <div>{selectedItemDetail.discoveryStrategy || '—'}</div>
                </div>
                <div>
                  <strong style={{ color: 'var(--text-secondary)' }}>Jobs Discovered:</strong>
                  <div>{selectedItemDetail.jobsDiscovered} (Total: {selectedItemDetail.sourceTotal ?? 'Unknown'})</div>
                </div>
                <div>
                  <strong style={{ color: 'var(--text-secondary)' }}>Completeness:</strong>
                  <div>{selectedItemDetail.completeness || 'UNKNOWN'}</div>
                </div>
                <div>
                  <strong style={{ color: 'var(--text-secondary)' }}>Created / Updated:</strong>
                  <div>{selectedItemDetail.jobsCreated} created / {selectedItemDetail.jobsUpdated} updated</div>
                </div>
                <div>
                  <strong style={{ color: 'var(--text-secondary)' }}>Health Status:</strong>
                  <div>{selectedItemDetail.healthStatus || '—'}</div>
                </div>
              </div>

              {selectedItemDetail.errorMessage && (
                <div style={{ padding: '10px 14px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', color: '#f87171' }}>
                  <strong>Error ({selectedItemDetail.errorCode || 'FAILED'}):</strong>
                  <p style={{ margin: '4px 0 0' }}>{selectedItemDetail.errorMessage}</p>
                </div>
              )}
            </div>

            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              {(selectedItemDetail.status === 'FAILED' || selectedItemDetail.status === 'PARTIAL') && (
                <button
                  onClick={() => {
                    handleRetryItem(selectedItemDetail.id);
                    setSelectedItemDetail(null);
                  }}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    background: 'var(--accent-primary, #6366f1)',
                    color: '#fff',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: 600
                  }}
                >
                  Retry Discovery
                </button>
              )}
              <button
                onClick={() => setSelectedItemDetail(null)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer'
                }}
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
