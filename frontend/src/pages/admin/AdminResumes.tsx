import React, { useEffect, useState } from 'react';
import { apiClient } from '../../api/client';
import { Search, Loader2 } from 'lucide-react';
import './AdminPages.css';

export const AdminResumes: React.FC = () => {
  const [resumes, setResumes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const loadResumes = async (targetPage = 1, searchQuery = search, statusFilter = status) => {
    try {
      setLoading(true);
      const res = await apiClient.getAdminResumes({
        page: targetPage,
        pageSize: 15,
        search: searchQuery || undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined
      });
      setResumes(res.data || []);
      if (res.pagination) {
        setPage(res.pagination.page);
        setTotalPages(res.pagination.totalPages);
        setTotalCount(res.pagination.total);
      }
    } catch (err: any) {
      console.error('Failed to load admin resumes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadResumes(1);
  }, [status]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadResumes(1, search, status);
  };

  return (
    <div className="admin-page-container">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Resume Documents Vault</h1>
          <p className="admin-page-desc">Candidate resume files, parsed canonical records, and version snapshots.</p>
        </div>
      </div>

      <div className="admin-table-container">
        <div className="admin-table-controls">
          <form onSubmit={handleSearch} className="admin-search-input-wrap">
            <Search className="admin-search-icon" size={16} />
            <input
              type="text"
              className="admin-search-input"
              placeholder="Search resume title or candidate..."
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
            <option value="UPLOADED">UPLOADED</option>
            <option value="PARSED">PARSED</option>
            <option value="PARSE_REVIEW_REQUIRED">PARSE_REVIEW_REQUIRED</option>
            <option value="ARCHIVED">ARCHIVED</option>
            <option value="FAILED">FAILED</option>
          </select>

          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Total: {totalCount} documents
          </span>
        </div>

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px', gap: '12px' }}>
            <Loader2 className="animate-spin text-primary" size={24} />
            <span>Loading resumes...</span>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="admin-data-table">
              <thead>
                <tr>
                  <th>Title / File</th>
                  <th>Candidate</th>
                  <th>Status</th>
                  <th>Versions</th>
                  <th>File Size</th>
                  <th>Uploaded Date</th>
                </tr>
              </thead>
              <tbody>
                {resumes.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                      No resumes found matching query.
                    </td>
                  </tr>
                ) : (
                  resumes.map(r => (
                    <tr key={r.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{r.title}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{r.originalFileName}</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{r.candidateName}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{r.candidateEmail}</div>
                      </td>
                      <td>
                        <span className={`admin-badge ${r.status === 'PARSED' ? 'success' : r.status === 'FAILED' ? 'danger' : 'warning'}`}>
                          {r.status}
                        </span>
                      </td>
                      <td>{r.versionCount} versions</td>
                      <td>{r.fileSize ? `${Math.round(r.fileSize / 1024)} KB` : 'N/A'}</td>
                      <td>{new Date(r.uploadedAt).toLocaleDateString()}</td>
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
              onClick={() => loadResumes(page - 1)}
            >
              Previous
            </button>
            <button
              className="admin-pg-btn"
              disabled={page >= totalPages}
              onClick={() => loadResumes(page + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
