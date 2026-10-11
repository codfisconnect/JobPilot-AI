import React, { useEffect, useState } from 'react';
import { apiClient } from '../../api/client';
import { Search, Loader2, ArrowLeft, ExternalLink, ShieldCheck } from 'lucide-react';
import './AdminPages.css';

interface AdminCandidatesProps {
  onSelectCandidateId?: (id: string) => void;
}

export const AdminCandidates: React.FC<AdminCandidatesProps> = ({ onSelectCandidateId }) => {
  const [candidates, setCandidates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedCandidate, setSelectedCandidate] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadCandidates = async (targetPage = 1, searchQuery = search) => {
    try {
      setLoading(true);
      const res = await apiClient.getAdminCandidates({
        page: targetPage,
        pageSize: 15,
        search: searchQuery || undefined
      });
      setCandidates(res.data || []);
      if (res.pagination) {
        setPage(res.pagination.page);
        setTotalPages(res.pagination.totalPages);
        setTotalCount(res.pagination.total);
      }
    } catch (err: any) {
      console.error('Failed to load admin candidates:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCandidates(1);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadCandidates(1, search);
  };

  const handleInspect = async (userId: string) => {
    try {
      setDetailLoading(true);
      const detail = await apiClient.getAdminCandidateById(userId);
      setSelectedCandidate(detail);
    } catch (err: any) {
      alert(`Could not load candidate details: ${err.message}`);
    } finally {
      setDetailLoading(false);
    }
  };

  if (selectedCandidate) {
    const cp = selectedCandidate.candidateProfile;
    return (
      <div className="admin-page-container">
        <button
          onClick={() => setSelectedCandidate(null)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: '#818cf8', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600, padding: 0 }}
        >
          <ArrowLeft size={16} /> Back to Candidates List
        </button>

        <div className="admin-candidate-detail-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>{cp?.fullName || selectedCandidate.email}</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{selectedCandidate.email} • ID: {selectedCandidate.id}</p>
              {cp?.headline && <p style={{ color: '#818cf8', fontWeight: 600, marginTop: '4px' }}>{cp.headline}</p>}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <span className={`admin-badge ${selectedCandidate.isActive ? 'success' : 'danger'}`}>
                {selectedCandidate.isActive ? 'Active User' : 'Inactive'}
              </span>
              <span className="admin-badge info">
                {selectedCandidate.subscriptions?.[0]?.plan?.name || 'Free Tier'}
              </span>
            </div>
          </div>

          <div className="admin-detail-grid">
            {/* Resumes */}
            <div className="admin-detail-section">
              <div className="admin-detail-heading">Resumes ({cp?.resumes?.length || 0})</div>
              {cp?.resumes?.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No resumes uploaded.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {cp?.resumes?.map((r: any) => (
                    <div key={r.id} style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{r.title || r.originalFileName}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Status: {r.status} • {r.versions?.length || 0} versions</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Applications */}
            <div className="admin-detail-section">
              <div className="admin-detail-heading">Applications Pipeline ({selectedCandidate.applications?.length || 0})</div>
              {selectedCandidate.applications?.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No job applications filed yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {selectedCandidate.applications?.map((a: any) => (
                    <div key={a.id} style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{a.job?.title} at {a.job?.company?.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Stage: {a.status} • Applied {new Date(a.createdAt).toLocaleDateString()}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Skills & Experience */}
            <div className="admin-detail-section">
              <div className="admin-detail-heading">Experience & Skills</div>
              <div style={{ fontSize: '0.85rem' }}>
                <strong>Work History:</strong> {cp?.experiences?.length || 0} positions logged
              </div>
              <div style={{ fontSize: '0.85rem' }}>
                <strong>Education:</strong> {cp?.educations?.length || 0} degrees
              </div>
              <div style={{ fontSize: '0.85rem' }}>
                <strong>Verified Skills:</strong> {cp?.skills?.length || 0} skills
              </div>
            </div>

            {/* Credits & Ledger */}
            <div className="admin-detail-section">
              <div className="admin-detail-heading">Credits & Financials</div>
              <div style={{ fontSize: '0.85rem' }}>
                <strong>Wallet Balance:</strong> {selectedCandidate.creditWallet?.balance || 0} credits
              </div>
              <div style={{ fontSize: '0.85rem' }}>
                <strong>Lifetime Granted:</strong> {selectedCandidate.creditWallet?.lifetimeGranted || 0}
              </div>
              <div style={{ fontSize: '0.85rem' }}>
                <strong>Lifetime Consumed:</strong> {selectedCandidate.creditWallet?.lifetimeConsumed || 0}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page-container">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Candidates Directory</h1>
          <p className="admin-page-desc">Comprehensive database of registered candidate accounts and their vault states.</p>
        </div>
      </div>

      <div className="admin-table-container">
        <div className="admin-table-controls">
          <form onSubmit={handleSearch} className="admin-search-input-wrap">
            <Search className="admin-search-icon" size={16} />
            <input
              type="text"
              className="admin-search-input"
              placeholder="Search candidate name or email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </form>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Total: {totalCount} candidates
          </span>
        </div>

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px', gap: '12px' }}>
            <Loader2 className="animate-spin text-primary" size={24} />
            <span>Loading candidates...</span>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="admin-data-table">
              <thead>
                <tr>
                  <th>Candidate</th>
                  <th>Joined</th>
                  <th>Resumes</th>
                  <th>Applications</th>
                  <th>Subscription</th>
                  <th>Credits</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {candidates.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                      No candidates found matching query.
                    </td>
                  </tr>
                ) : (
                  candidates.map(c => (
                    <tr key={c.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{c.fullName}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c.email}</div>
                      </td>
                      <td>{new Date(c.createdAt).toLocaleDateString()}</td>
                      <td>
                        <span className="admin-badge info">{c.resumeCount} Resumes</span>
                      </td>
                      <td>{c.applicationCount} Apps</td>
                      <td>
                        <span className={`admin-badge ${c.subscriptionStatus === 'ACTIVE' ? 'success' : 'warning'}`}>
                          {c.subscriptionPlan}
                        </span>
                      </td>
                      <td>{c.creditBalance} cr</td>
                      <td>
                        <span className={`admin-badge ${c.isActive ? 'success' : 'danger'}`}>
                          {c.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <button
                          className="admin-pg-btn"
                          disabled={detailLoading}
                          onClick={() => handleInspect(c.id)}
                        >
                          View Detail
                        </button>
                      </td>
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
              onClick={() => loadCandidates(page - 1)}
            >
              Previous
            </button>
            <button
              className="admin-pg-btn"
              disabled={page >= totalPages}
              onClick={() => loadCandidates(page + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
