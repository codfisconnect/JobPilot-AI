import React, { useEffect, useState } from 'react';
import { apiClient } from '../../api/client';
import { Search, Loader2 } from 'lucide-react';
import './AdminPages.css';

export const AdminJobs: React.FC = () => {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const loadJobs = async (targetPage = 1, searchQuery = search, statusFilter = status) => {
    try {
      setLoading(true);
      const res = await apiClient.getAdminJobs({
        page: targetPage,
        pageSize: 15,
        search: searchQuery || undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined
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
  }, [status]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadJobs(1, search, status);
  };

  return (
    <div className="admin-page-container">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Canonical Job Opportunities</h1>
          <p className="admin-page-desc">All canonical jobs discovered and ingested into the platform.</p>
        </div>
      </div>

      <div className="admin-table-container">
        <div className="admin-table-controls">
          <form onSubmit={handleSearch} className="admin-search-input-wrap">
            <Search className="admin-search-icon" size={16} />
            <input
              type="text"
              className="admin-search-input"
              placeholder="Search job title, company, or location..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </form>

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

          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Total: {totalCount} jobs
          </span>
        </div>

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px', gap: '12px' }}>
            <Loader2 className="animate-spin text-primary" size={24} />
            <span>Loading jobs...</span>
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
                  <th>Applications</th>
                  <th>Status</th>
                  <th>First Seen</th>
                </tr>
              </thead>
              <tbody>
                {jobs.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                      No jobs found matching criteria.
                    </td>
                  </tr>
                ) : (
                  jobs.map(j => (
                    <tr key={j.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{j.title}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{j.employmentType}</div>
                      </td>
                      <td>{j.companyName}</td>
                      <td>
                        <div>{j.location || 'Not Specified'}</div>
                        <div style={{ fontSize: '0.75rem', color: '#818cf8' }}>{j.remoteType}</div>
                      </td>
                      <td>
                        <span className="admin-badge info">{j.sourceType}</span>
                      </td>
                      <td>{j.applicationCount}</td>
                      <td>
                        <span className={`admin-badge ${j.status === 'ACTIVE' ? 'success' : 'danger'}`}>
                          {j.status}
                        </span>
                      </td>
                      <td>{new Date(j.firstSeenAt).toLocaleDateString()}</td>
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
              onClick={() => loadJobs(page - 1)}
            >
              Previous
            </button>
            <button
              className="admin-pg-btn"
              disabled={page >= totalPages}
              onClick={() => loadJobs(page + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
