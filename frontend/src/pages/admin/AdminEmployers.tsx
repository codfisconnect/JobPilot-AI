import React, { useEffect, useState } from 'react';
import { apiClient } from '../../api/client';
import { Search, Loader2 } from 'lucide-react';
import './AdminPages.css';

export const AdminEmployers: React.FC = () => {
  const [employers, setEmployers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const loadEmployers = async (targetPage = 1, searchQuery = search) => {
    try {
      setLoading(true);
      const res = await apiClient.getAdminEmployers({
        page: targetPage,
        pageSize: 15,
        search: searchQuery || undefined
      });
      setEmployers(res.data || []);
      if (res.pagination) {
        setPage(res.pagination.page);
        setTotalPages(res.pagination.totalPages);
        setTotalCount(res.pagination.total);
      }
    } catch (err: any) {
      console.error('Failed to load admin employers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEmployers(1);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadEmployers(1, search);
  };

  return (
    <div className="admin-page-container">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Employer Organizations</h1>
          <p className="admin-page-desc">Registered recruiter and enterprise hiring workspaces.</p>
        </div>
      </div>

      <div className="admin-table-container">
        <div className="admin-table-controls">
          <form onSubmit={handleSearch} className="admin-search-input-wrap">
            <Search className="admin-search-icon" size={16} />
            <input
              type="text"
              className="admin-search-input"
              placeholder="Search employer organization or domain..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </form>

          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Total: {totalCount} organizations
          </span>
        </div>

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px', gap: '12px' }}>
            <Loader2 className="animate-spin text-primary" size={24} />
            <span>Loading employers...</span>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="admin-data-table">
              <thead>
                <tr>
                  <th>Organization</th>
                  <th>Domain / URL</th>
                  <th>Industry</th>
                  <th>Team Members</th>
                  <th>Posted Jobs</th>
                  <th>Verification</th>
                  <th>Registered</th>
                </tr>
              </thead>
              <tbody>
                {employers.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                      No employers found matching criteria.
                    </td>
                  </tr>
                ) : (
                  employers.map(e => (
                    <tr key={e.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{e.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Contact: {e.primaryContact}</div>
                      </td>
                      <td>{e.domain || 'N/A'}</td>
                      <td>{e.industry || 'General'}</td>
                      <td>{e.memberCount} members</td>
                      <td>
                        <span className="admin-badge info">{e.jobCount} Jobs</span>
                      </td>
                      <td>
                        <span className={`admin-badge ${e.verificationStatus === 'VERIFIED' ? 'success' : 'warning'}`}>
                          {e.verificationStatus}
                        </span>
                      </td>
                      <td>{new Date(e.createdAt).toLocaleDateString()}</td>
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
              onClick={() => loadEmployers(page - 1)}
            >
              Previous
            </button>
            <button
              className="admin-pg-btn"
              disabled={page >= totalPages}
              onClick={() => loadEmployers(page + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
