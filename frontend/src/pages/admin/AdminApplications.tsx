import React, { useEffect, useState } from 'react';
import { apiClient } from '../../api/client';
import { Search, Loader2 } from 'lucide-react';
import './AdminPages.css';

export const AdminApplications: React.FC = () => {
  const [apps, setApps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const loadApps = async (targetPage = 1, searchQuery = search, statusFilter = status) => {
    try {
      setLoading(true);
      const res = await apiClient.getAdminApplications({
        page: targetPage,
        pageSize: 15,
        search: searchQuery || undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined
      });
      setApps(res.data || []);
      if (res.pagination) {
        setPage(res.pagination.page);
        setTotalPages(res.pagination.totalPages);
        setTotalCount(res.pagination.total);
      }
    } catch (err: any) {
      console.error('Failed to load admin applications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApps(1);
  }, [status]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadApps(1, search, status);
  };

  return (
    <div className="admin-page-container">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Candidate Applications Pipeline</h1>
          <p className="admin-page-desc">All candidate submissions and recruitment pipeline stages.</p>
        </div>
      </div>

      <div className="admin-table-container">
        <div className="admin-table-controls">
          <form onSubmit={handleSearch} className="admin-search-input-wrap">
            <Search className="admin-search-icon" size={16} />
            <input
              type="text"
              className="admin-search-input"
              placeholder="Search candidate, job, or company..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </form>

          <select
            className="admin-filter-select"
            value={status}
            onChange={e => setStatus(e.target.value)}
          >
            <option value="ALL">All Stages</option>
            <option value="SAVED">SAVED</option>
            <option value="APPLIED">APPLIED</option>
            <option value="HR_SCREEN">HR_SCREEN</option>
            <option value="TECHNICAL">TECHNICAL</option>
            <option value="OFFER">OFFER</option>
            <option value="REJECTED">REJECTED</option>
          </select>

          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Total: {totalCount} applications
          </span>
        </div>

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px', gap: '12px' }}>
            <Loader2 className="animate-spin text-primary" size={24} />
            <span>Loading applications...</span>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="admin-data-table">
              <thead>
                <tr>
                  <th>Candidate</th>
                  <th>Job Position</th>
                  <th>Company</th>
                  <th>Resume Version</th>
                  <th>Status Stage</th>
                  <th>Applied / Created Date</th>
                </tr>
              </thead>
              <tbody>
                {apps.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                      No applications found matching criteria.
                    </td>
                  </tr>
                ) : (
                  apps.map(a => (
                    <tr key={a.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{a.candidateName}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{a.candidateEmail}</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{a.jobTitle}</div>
                      </td>
                      <td>{a.companyName}</td>
                      <td>
                        <span className="admin-badge info">{a.resumeVersionTitle}</span>
                      </td>
                      <td>
                        <span className={`admin-badge ${a.status === 'OFFER' ? 'success' : a.status === 'REJECTED' ? 'danger' : 'warning'}`}>
                          {a.status}
                        </span>
                      </td>
                      <td>{new Date(a.appliedAt || a.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="admin-pagination-bar">
          <span>Page {page} of {totalPages || 1}</span>
          <div className="admin-pagination-btns">
            <button
              className="admin-pg-btn"
              disabled={page <= 1}
              onClick={() => loadApps(page - 1)}
            >
              Previous
            </button>
            <button
              className="admin-pg-btn"
              disabled={page >= totalPages}
              onClick={() => loadApps(page + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
