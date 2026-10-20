import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  Check,
  RotateCw,
  X,
  Play
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
  const [inputRevision, setInputRevision] = useState(0);
  const [concurrency, setConcurrency] = useState(4);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Derived lightweight URL parse (always live, never stale)
  const parsedUrls = useMemo(() => {
    return inputText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
  }, [inputText]);

  // Validation Preview State
  const [validating, setValidating] = useState(false);
  const [previewResult, setPreviewResult] = useState<any | null>(null);
  const [previewRevision, setPreviewRevision] = useState<number>(-1);
  const [validationError, setValidationError] = useState<NormalizedError | null>(null);

  // Is the validation result current or stale?
  const isValidationCurrent = previewResult !== null && previewRevision === inputRevision;
  const isValidationStale = previewResult !== null && previewRevision !== inputRevision;

  // Execution / Active Bulk Job State
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [activeJob, setActiveJob] = useState<any | null>(null);
  const [activeItems, setActiveItems] = useState<any[]>([]);
  const [startingDiscovery, setStartingDiscovery] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Filter / Search for active items
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Detail Modal State
  const [selectedItemDetail, setSelectedItemDetail] = useState<any | null>(null);

  // History Tab / Previous Runs State
  const [historyRuns, setHistoryRuns] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [activeTab, setActiveTab] = useState<'create' | 'history'>('create');

  // Load history on mount or tab change
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

  useEffect(() => {
    loadHistory();
  }, []);

  // Polling for Active Job
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let isSubscribed = true;

    const pollJobStatus = async () => {
      if (!activeJobId) return;

      try {
        const [jobRes, itemsRes] = await Promise.all([
          apiClient.getBulkJobSourceJob(activeJobId),
          apiClient.getBulkJobSourceItems(activeJobId)
        ]);

        if (!isSubscribed) return;

        if (jobRes?.job) {
          setActiveJob(jobRes.job);
        }
        if (itemsRes?.items) {
          setActiveItems(itemsRes.items);
        }

        // If job reached terminal state, stop fast polling
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
        if (isSubscribed) {
          timer = setTimeout(pollJobStatus, 5000);
        }
      }
    };

    if (activeJobId) {
      pollJobStatus();
    }

    return () => {
      isSubscribed = false;
      if (timer) clearTimeout(timer);
    };
  }, [activeJobId]);

  // Handle Textarea change
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    setInputRevision(prev => prev + 1);
    setValidationError(null);
    setActionError(null);
    setActionSuccess(null);
  };

  // Perform validation
  const handleValidate = async () => {
    setValidationError(null);
    setActionError(null);
    setActionSuccess(null);

    const urls = parsedUrls;
    const currentRev = inputRevision;

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
        message: `Maximum 100 sources per batch allowed. You entered ${urls.length}.`
      });
      return;
    }

    try {
      setValidating(true);
      const res = await apiClient.validateBulkJobSources({ urls });
      if (res?.preview) {
        setPreviewResult(res.preview);
        setPreviewRevision(currentRev);
      }
    } catch (err: any) {
      const norm = normalizeApiError(err, 'Failed to validate URLs');
      setValidationError(norm);
    } finally {
      setValidating(false);
    }
  };

  // Safe Start Bulk Discovery: Works directly from raw input, validating automatically if needed
  const handleStartBulkDiscovery = async () => {
    setActionError(null);
    setActionSuccess(null);

    const urls = parsedUrls;

    if (urls.length === 0) {
      setActionError('No career URLs entered.');
      return;
    }

    if (urls.length > 100) {
      setActionError(`Maximum 100 sources per batch allowed. ${urls.length} entered.`);
      return;
    }

    try {
      setStartingDiscovery(true);

      const res = await apiClient.startBulkJobSources({
        urls,
        maxConcurrency: concurrency
      });

      if (res?.bulkJobId) {
        setActiveJobId(res.bulkJobId);
        // Clear input immediately so admin can paste another batch
        setInputText('');
        setInputRevision(prev => prev + 1);
        setPreviewResult(null);
        setPreviewRevision(-1);
        setActionSuccess(`Bulk discovery batch started with ${res.accepted || urls.length} accepted source(s).`);
        // Refresh history
        loadHistory();
      } else {
        setActionError('Failed to initialize bulk discovery batch.');
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
        extractedUrls = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      }

      setInputText(extractedUrls.join('\n'));
      setInputRevision(prev => prev + 1);
      setPreviewResult(null);
      setPreviewRevision(-1);
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

  // Filtered active items
  const filteredItems = useMemo(() => {
    return activeItems.filter(item => {
      if (statusFilter !== 'ALL' && item.status !== statusFilter) {
        return false;
      }
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const name = (item.companyName || item.companyHint || '').toLowerCase();
        const url = (item.sourceUrl || '').toLowerCase();
        const strat = (item.discoveryStrategy || '').toLowerCase();
        return name.includes(term) || url.includes(term) || strat.includes(term);
      }
      return true;
    });
  }, [activeItems, statusFilter, searchTerm]);

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
            Console & Active
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
            Batch History ({historyRuns.length})
          </button>
        </div>
      </div>

      {actionError && (
        <div style={{ padding: '12px 16px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', color: '#f87171', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <AlertTriangle size={18} />
          <span>{actionError}</span>
        </div>
      )}

      {actionSuccess && (
        <div style={{ padding: '12px 16px', background: 'rgba(74, 222, 128, 0.1)', border: '1px solid rgba(74, 222, 128, 0.25)', borderRadius: '8px', color: '#4ade80', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <CheckCircle2 size={18} />
          <span>{actionSuccess}</span>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
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
                      Active Bulk Pipeline Dashboard
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
                    Batch ID: <code>{activeJob.id}</code> • Started {new Date(activeJob.createdAt).toLocaleTimeString()}
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
                    Hide Dashboard
                  </button>
                </div>
              </div>

              {/* Progress Summary Cards */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                  gap: '12px',
                  marginTop: '16px'
                }}
              >
                <div style={{ padding: '14px', background: 'var(--bg-surface-hover)', border: '1px solid var(--border-subtle)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Total Sources</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>{activeJob.totalSources}</div>
                </div>
                <div style={{ padding: '14px', background: 'var(--color-success-bg, rgba(74,222,128,0.1))', borderRadius: '8px', borderLeft: '3px solid #4ade80' }}>
                  <div style={{ fontSize: '0.8rem', color: '#4ade80' }}>✓ Completed</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#4ade80' }}>{activeJob.completedSources}</div>
                </div>
                <div style={{ padding: '14px', background: 'var(--color-warning-bg, rgba(250,204,21,0.1))', borderRadius: '8px', borderLeft: '3px solid #facc15' }}>
                  <div style={{ fontSize: '0.8rem', color: '#facc15' }}>⚡ Partial</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#facc15' }}>{activeJob.partialSources}</div>
                </div>
                <div style={{ padding: '14px', background: 'rgba(99, 102, 241, 0.12)', borderRadius: '8px', borderLeft: '3px solid #818cf8' }}>
                  <div style={{ fontSize: '0.8rem', color: '#818cf8' }}>→ Running</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#818cf8' }}>{activeJob.runningSources}</div>
                </div>
                <div style={{ padding: '14px', background: 'var(--bg-surface-hover)', borderRadius: '8px', borderLeft: '3px solid #94a3b8' }}>
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>◌ Queued</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#94a3b8' }}>{activeJob.queuedSources}</div>
                </div>
                <div style={{ padding: '14px', background: 'var(--color-danger-bg, rgba(239,68,68,0.1))', borderRadius: '8px', borderLeft: '3px solid #f87171' }}>
                  <div style={{ fontSize: '0.8rem', color: '#f87171' }}>✕ Failed</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f87171' }}>{activeJob.failedSources}</div>
                </div>
              </div>

              {/* Progress Bar */}
              <div style={{ marginTop: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>
                  <span>
                    Batch Progress: <strong>{activeJob.completedSources + activeJob.partialSources + activeJob.failedSources} / {activeJob.totalSources}</strong>
                  </span>
                  <span>
                    Discovered Jobs: <strong>{activeJob.totalJobsDiscovered}</strong> (Created: {activeJob.totalJobsCreated}, Updated: {activeJob.totalJobsUpdated})
                  </span>
                </div>
                <div style={{ width: '100%', height: '8px', background: 'var(--border-subtle)', borderRadius: '4px', overflow: 'hidden' }}>
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

              {/* Filters & Search */}
              <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Filter:</span>
                  {['ALL', 'DISCOVERING', 'QUEUED', 'COMPLETED', 'PARTIAL', 'FAILED'].map(st => (
                    <button
                      key={st}
                      onClick={() => setStatusFilter(st)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        border: '1px solid var(--border-subtle)',
                        background: statusFilter === st ? 'var(--accent-primary, #6366f1)' : 'rgba(255,255,255,0.05)',
                        color: statusFilter === st ? '#fff' : 'var(--text-secondary)',
                        cursor: 'pointer'
                      }}
                    >
                      {st}
                    </button>
                  ))}
                </div>

                <div style={{ position: 'relative', width: '220px' }}>
                  <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    placeholder="Search sources..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '6px 10px 6px 30px',
                      borderRadius: '6px',
                      background: 'var(--bg-canvas)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-primary)',
                      fontSize: '0.8rem'
                    }}
                  />
                </div>
              </div>

              {/* Real-time Sources Table */}
              <div style={{ marginTop: '16px' }}>
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
                      {filteredItems.length === 0 ? (
                        <tr>
                          <td colSpan={8} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                            No sources match the selected filter.
                          </td>
                        </tr>
                      ) : (
                        filteredItems.map(item => (
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
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Form Card: ALWAYS ACTIVE & NON-BLOCKING FOR NEW INPUT */}
          <div className="admin-metric-card" style={{ padding: '24px', background: 'var(--bg-surface, #1e293b)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Layers size={22} style={{ color: 'var(--accent-primary, #6366f1)' }} />
                <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>
                  Add Multiple Career URLs
                </h2>
                {parsedUrls.length > 0 && (
                  <span style={{ fontSize: '0.8rem', padding: '2px 8px', background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', borderRadius: '12px', fontWeight: 600 }}>
                    {parsedUrls.length} {parsedUrls.length === 1 ? 'URL' : 'URLs'} entered
                  </span>
                )}
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
              onChange={handleTextChange}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '8px',
                border: isValidationStale ? '1px dashed #facc15' : '1px solid var(--border-subtle)',
                background: 'var(--bg-canvas)',
                color: 'var(--text-primary)',
                fontFamily: 'monospace',
                fontSize: '0.9rem',
                lineHeight: 1.5,
                resize: 'vertical'
              }}
            />

            {/* Stale Validation Warning */}
            {isValidationStale && (
              <div style={{ marginTop: '8px', fontSize: '0.8rem', color: '#facc15', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AlertTriangle size={14} />
                <span>Input changed since last validation preview. Starting discovery will automatically validate the current input.</span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                <span>Worker Concurrency:</span>
                <select
                  value={concurrency}
                  onChange={e => setConcurrency(parseInt(e.target.value, 10))}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    background: 'var(--bg-canvas)',
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
                  disabled={validating || parsedUrls.length === 0}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.08)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-subtle)',
                    fontWeight: 600,
                    cursor: validating || parsedUrls.length === 0 ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    opacity: parsedUrls.length === 0 ? 0.6 : 1
                  }}
                >
                  {validating ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                  <span>Validate URLs</span>
                </button>

                <button
                  type="button"
                  onClick={handleStartBulkDiscovery}
                  disabled={startingDiscovery || parsedUrls.length === 0}
                  style={{
                    padding: '10px 24px',
                    borderRadius: '8px',
                    background: 'var(--accent-primary, #6366f1)',
                    color: '#fff',
                    border: 'none',
                    fontWeight: 600,
                    cursor: startingDiscovery || parsedUrls.length === 0 ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    opacity: startingDiscovery || parsedUrls.length === 0 ? 0.6 : 1
                  }}
                >
                  {startingDiscovery ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                  <span>
                    {isValidationCurrent && previewResult?.newSourcesCount > 0
                      ? `Start ${previewResult.newSourcesCount} Sources`
                      : parsedUrls.length > 0
                      ? `Start Bulk Discovery (${parsedUrls.length})`
                      : 'Start Bulk Discovery'}
                  </span>
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

          {/* Validation Preview Card (Only shown if validation matches current revision) */}
          {isValidationCurrent && (
            <div className="admin-metric-card" style={{ padding: '24px', background: 'var(--bg-surface, #1e293b)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
                  Validation Preview ({previewResult.totalInput} total)
                </h3>
                <div style={{ display: 'flex', gap: '8px', fontSize: '0.85rem', flexWrap: 'wrap' }}>
                  <span style={{ padding: '4px 8px', background: 'rgba(74, 222, 128, 0.15)', color: '#4ade80', borderRadius: '4px', fontWeight: 600 }}>
                    ✓ {previewResult.newSourcesCount} new valid
                  </span>
                  {previewResult.alreadyConnectedCount > 0 && (
                    <span style={{ padding: '4px 8px', background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', borderRadius: '4px', fontWeight: 600 }}>
                      ↻ {previewResult.alreadyConnectedCount} already connected
                    </span>
                  )}
                  {previewResult.duplicateCount > 0 && (
                    <span style={{ padding: '4px 8px', background: 'rgba(250, 204, 21, 0.15)', color: '#facc15', borderRadius: '4px', fontWeight: 600 }}>
                      ⚠ {previewResult.duplicateCount} duplicate
                    </span>
                  )}
                  {previewResult.invalidCount > 0 && (
                    <span style={{ padding: '4px 8px', background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', borderRadius: '4px', fontWeight: 600 }}>
                      ✕ {previewResult.invalidCount} invalid
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
                  Dismiss Preview
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
                    cursor: startingDiscovery || previewResult.newSourcesCount === 0 ? 'not-allowed' : 'pointer',
                    opacity: startingDiscovery || previewResult.newSourcesCount === 0 ? 0.6 : 1
                  }}
                >
                  Start Discovery ({previewResult.newSourcesCount} Sources)
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Item Details Modal */}
      {selectedItemDetail && (
        <div style={{ position: 'fixed', inset: 0, background: 'var(--bg-overlay, rgba(0,0,0,0.7))', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '24px', maxWidth: '640px', width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                {selectedItemDetail.companyName || selectedItemDetail.companyHint || 'Source Details'}
              </h3>
              <button
                onClick={() => setSelectedItemDetail(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem' }}
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
