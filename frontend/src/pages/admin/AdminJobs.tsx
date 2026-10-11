import React, { useEffect, useState } from 'react';
import { apiClient } from '../../api/client';
import {
  Search,
  Loader2,
  Filter,
  RefreshCw,
  ExternalLink,
  Briefcase,
  MapPin,
  Clock,
  Building,
  DollarSign,
  X,
  Eye,
  CheckCircle2
} from 'lucide-react';
import './AdminPages.css';

interface AdminJobsProps {
  initialCompanyFilter?: string;
}

export const AdminJobs: React.FC<AdminJobsProps> = ({ initialCompanyFilter }) => {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [companyFilter, setCompanyFilter] = useState(initialCompanyFilter || '');
  const [sourceFilter, setSourceFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Job Detail Modal State
  const [selectedJob, setSelectedJob] = useState<any | null>(null);
  const [loadingJobDetail, setLoadingJobDetail] = useState(false);

  const loadJobs = async (
    targetPage = 1,
    searchQuery = search,
    statusFilter = status,
    company = companyFilter,
    source = sourceFilter
  ) => {
    try {
      setLoading(true);
      const res = await apiClient.getAdminJobs({
        page: targetPage,
        pageSize: 15,
        search: searchQuery || undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        company: company || undefined,
        source: source || undefined
      });
      setJobs(res.data || []);
      if (res.pagination) {
        setPage(res.pagination.page);
        setTotalPages(res.pagination.totalPages);
        setTotalCount(res.pagination.total);
      }
    } catch (err: any) {
      console.error('Failed to load admin jobs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJobs(1);
  }, [status, companyFilter, sourceFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadJobs(1, search, status, companyFilter, sourceFilter);
  };

  const handleViewJobDetail = async (jobId: string) => {
    try {
      setLoadingJobDetail(true);
      const res = await apiClient.getAdminJobDetail(jobId);
      setSelectedJob(res.data || res);
    } catch (err: any) {
      console.error('Failed to load job detail:', err);
    } finally {
      setLoadingJobDetail(false);
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
          <h1 className="admin-page-title">Canonical Job Opportunities</h1>
          <p className="admin-page-desc">
            All jobs discovered, normalized, and persisted into the PostgreSQL production database.
          </p>
        </div>
      </div>

      <div className="admin-table-container">
        <div className="admin-table-controls">
          <form onSubmit={handleSearch} className="admin-search-input-wrap">
            <Search className="admin-search-icon" size={16} />
            <input
              type="text"
              className="admin-search-input"
              placeholder="Search title, company, or location..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </form>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <select
              className="admin-filter-select"
              value={status}
              onChange={e => setStatus(e.target.value)}
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="EXPIRED">EXPIRED</option>
              <option value="CLOSED">CLOSED</option>
            </select>

            <input
              type="text"
              placeholder="Filter by company..."
              value={companyFilter}
              onChange={e => setCompanyFilter(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle, #334155)',
                background: '#0f172a',
                color: 'var(--text-primary, #f8fafc)',
                fontSize: '0.85rem',
                minWidth: '150px'
              }}
            />

            <input
              type="text"
              placeholder="Filter by source..."
              value={sourceFilter}
              onChange={e => setSourceFilter(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle, #334155)',
                background: '#0f172a',
                color: 'var(--text-primary, #f8fafc)',
                fontSize: '0.85rem',
                minWidth: '140px'
              }}
            />

            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Total: {totalCount} jobs
            </span>
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px', gap: '12px' }}>
            <Loader2 className="animate-spin text-primary" size={24} />
            <span>Loading canonical jobs...</span>
          </div>
        ) : jobs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-secondary, #94a3b8)' }}>
            <Briefcase size={36} style={{ opacity: 0.4, marginBottom: '8px' }} />
            <p style={{ margin: 0 }}>No canonical jobs matching the current filters.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="admin-data-table">
              <thead>
                <tr>
                  <th>Job Title</th>
                  <th>Company</th>
                  <th>Location / Mode</th>
                  <th>Source</th>
                  <th>Experience</th>
                  <th>Salary</th>
                  <th>Status</th>
                  <th>Posted</th>
                  <th>Last Synced</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map(job => (
                  <tr key={job.id} style={{ cursor: 'pointer' }} onClick={() => handleViewJobDetail(job.id)}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary, #f8fafc)' }}>
                        {job.title}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #64748b)' }}>
                        {job.externalJobId || 'ID: ' + job.id.slice(0, 8)}
                      </div>
                    </td>

                    <td>
                      <span style={{ fontWeight: 500, color: '#e2e8f0' }}>{job.companyName}</span>
                    </td>

                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', color: 'var(--text-secondary, #94a3b8)' }}>
                        <MapPin size={12} />
                        <span>{job.location || 'Not specified'}</span>
                      </div>
                      <span style={{ fontSize: '0.72rem', color: '#818cf8', fontWeight: 600 }}>
                        {job.remoteType || 'ONSITE'}
                      </span>
                    </td>

                    <td>
                      <span style={{ padding: '2px 6px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', fontSize: '0.75rem', fontWeight: 600 }}>
                        {job.sourceType}
                      </span>
                    </td>

                    <td>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary, #94a3b8)' }}>
                        {job.experienceMin !== null && job.experienceMin !== undefined
                          ? `${job.experienceMin}${job.experienceMax ? `-${job.experienceMax}` : '+'} yrs`
                          : 'Not specified'}
                      </span>
                    </td>

                    <td>
                      <span style={{ fontSize: '0.85rem', color: '#4ade80' }}>
                        {job.salaryMin
                          ? `${job.salaryCurrency || '₹'} ${job.salaryMin.toLocaleString()}${job.salaryMax ? ` - ${job.salaryMax.toLocaleString()}` : ''}`
                          : 'Confidential'}
                      </span>
                    </td>

                    <td>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: '12px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        background: job.status === 'ACTIVE' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        color: job.status === 'ACTIVE' ? '#4ade80' : '#f87171'
                      }}>
                        {job.status}
                      </span>
                    </td>

                    <td>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted, #64748b)' }}>
                        {formatRelativeTime(job.postedAt || job.createdAt)}
                      </span>
                    </td>

                    <td>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted, #64748b)' }}>
                        {formatRelativeTime(job.lastSeenAt)}
                      </span>
                    </td>

                    <td>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewJobDetail(job.id);
                        }}
                        style={{ padding: '4px 8px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-subtle, #334155)', color: '#fff', fontSize: '0.78rem', cursor: 'pointer' }}
                      >
                        <Eye size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderTop: '1px solid var(--border-subtle, #334155)', fontSize: '0.85rem' }}>
          <span style={{ color: 'var(--text-secondary, #94a3b8)' }}>Page {page} of {totalPages}</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              disabled={page <= 1}
              onClick={() => loadJobs(page - 1)}
              style={{ padding: '6px 12px', borderRadius: '6px', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-subtle, #334155)', color: '#fff', cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? 0.5 : 1 }}
            >
              Previous
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => loadJobs(page + 1)}
              style={{ padding: '6px 12px', borderRadius: '6px', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-subtle, #334155)', color: '#fff', cursor: page >= totalPages ? 'not-allowed' : 'pointer', opacity: page >= totalPages ? 0.5 : 1 }}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Complete Normalized Job Detail Modal */}
      {selectedJob && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: 'var(--bg-surface, #1e293b)', border: '1px solid var(--border-subtle, #334155)', borderRadius: '12px', padding: '24px', maxWidth: '750px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px' }}>
              <div>
                <span style={{ padding: '2px 8px', borderRadius: '4px', background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', fontSize: '0.75rem', fontWeight: 700 }}>
                  {selectedJob.externalJobId || 'ID: ' + selectedJob.id}
                </span>
                <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: '6px 0 2px', color: 'var(--text-primary, #f8fafc)' }}>
                  {selectedJob.title}
                </h2>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary, #94a3b8)' }}>
                  {selectedJob.company?.name} • {selectedJob.location || 'Remote/Hybrid'} • {selectedJob.employmentType}
                </div>
              </div>
              <button onClick={() => setSelectedJob(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '20px', fontSize: '0.85rem' }}>
              <div><strong>Source Type:</strong> {selectedJob.sourceType}</div>
              <div><strong>Application URL:</strong> <a href={selectedJob.applicationUrl || selectedJob.sourceUrl} target="_blank" rel="noreferrer" style={{ color: '#818cf8' }}>Link <ExternalLink size={12} style={{ display: 'inline' }} /></a></div>
              <div><strong>Experience:</strong> {selectedJob.experienceMin ?? 0} to {selectedJob.experienceMax ?? 'N/A'} yrs</div>
              <div><strong>Salary:</strong> {selectedJob.salaryMin ? `${selectedJob.salaryCurrency || '₹'} ${selectedJob.salaryMin}` : 'Confidential'}</div>
              <div><strong>Work Mode:</strong> {selectedJob.remoteType}</div>
              <div><strong>Status:</strong> {selectedJob.status}</div>
            </div>

            {selectedJob.description && (
              <div style={{ marginBottom: '16px' }}>
                <h4 style={{ fontSize: '0.9rem', color: 'var(--text-primary, #f8fafc)', marginBottom: '6px' }}>Role Description</h4>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary, #94a3b8)', lineHeight: 1.5, background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px' }}>
                  {selectedJob.description}
                </p>
              </div>
            )}

            {selectedJob.responsibilities && selectedJob.responsibilities.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <h4 style={{ fontSize: '0.9rem', color: 'var(--text-primary, #f8fafc)', marginBottom: '6px' }}>Responsibilities</h4>
                <ul style={{ fontSize: '0.85rem', color: 'var(--text-secondary, #94a3b8)', paddingLeft: '20px', lineHeight: 1.5 }}>
                  {selectedJob.responsibilities.map((r: string, idx: number) => (
                    <li key={idx}>{r}</li>
                  ))}
                </ul>
              </div>
            )}

            {selectedJob.skills && selectedJob.skills.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ fontSize: '0.9rem', color: 'var(--text-primary, #f8fafc)', marginBottom: '8px' }}>Normalized Skills</h4>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {selectedJob.skills.map((s: any, idx: number) => (
                    <span key={idx} style={{ padding: '3px 8px', borderRadius: '6px', background: s.skillType === 'REQUIRED' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(16, 185, 129, 0.15)', color: s.skillType === 'REQUIRED' ? '#818cf8' : '#34d399', fontSize: '0.78rem', fontWeight: 600 }}>
                      {s.skill?.name || s.name || 'Skill'} ({s.skillType})
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setSelectedJob(null)} style={{ padding: '8px 16px', borderRadius: '8px', background: 'var(--accent-primary, #6366f1)', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer' }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
