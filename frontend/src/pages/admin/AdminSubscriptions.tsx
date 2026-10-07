import React, { useEffect, useState } from 'react';
import { apiClient } from '../../api/client';
import { Search, Loader2 } from 'lucide-react';
import './AdminPages.css';

export const AdminSubscriptions: React.FC = () => {
  const [subs, setSubs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const loadSubs = async (targetPage = 1, searchQuery = search, statusFilter = status) => {
    try {
      setLoading(true);
      const res = await apiClient.getAdminSubscriptions({
        page: targetPage,
        pageSize: 15,
        search: searchQuery || undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined
      });
      setSubs(res.data || []);
      if (res.pagination) {
        setPage(res.pagination.page);
        setTotalPages(res.pagination.totalPages);
        setTotalCount(res.pagination.total);
      }
    } catch (err: any) {
      console.error('Failed to load admin subscriptions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubs(1);
  }, [status]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadSubs(1, search, status);
  };

  return (
    <div className="admin-page-container">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Active Subscriptions</h1>
          <p className="admin-page-desc">Recurring billing memberships and plan entitlements.</p>
        </div>
      </div>

      <div className="admin-table-container">
        <div className="admin-table-controls">
          <form onSubmit={handleSearch} className="admin-search-input-wrap">
            <Search className="admin-search-icon" size={16} />
            <input
              type="text"
              className="admin-search-input"
              placeholder="Search subscriber email..."
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
            <option value="PAST_DUE">PAST_DUE</option>
            <option value="CANCELED">CANCELED</option>
            <option value="EXPIRED">EXPIRED</option>
          </select>

          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Total: {totalCount} subscriptions
          </span>
        </div>

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px', gap: '12px' }}>
            <Loader2 className="animate-spin text-primary" size={24} />
            <span>Loading subscriptions...</span>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="admin-data-table">
              <thead>
                <tr>
                  <th>Subscriber</th>
                  <th>Plan Tier</th>
                  <th>Billing Interval</th>
                  <th>Credit Wallet</th>
                  <th>Status</th>
                  <th>Current Period End</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {subs.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                      No subscriptions found matching query.
                    </td>
                  </tr>
                ) : (
                  subs.map(s => (
                    <tr key={s.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{s.userName}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{s.userEmail}</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{s.planName}</div>
                        <div style={{ fontSize: '0.75rem', color: '#818cf8' }}>{s.planCode}</div>
                      </td>
                      <td>{s.interval}</td>
                      <td>{s.creditBalance} cr</td>
                      <td>
                        <span className={`admin-badge ${s.status === 'ACTIVE' ? 'success' : 'danger'}`}>
                          {s.status}
                        </span>
                      </td>
                      <td>{s.currentPeriodEnd ? new Date(s.currentPeriodEnd).toLocaleDateString() : 'Continuous'}</td>
                      <td>{new Date(s.createdAt).toLocaleDateString()}</td>
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
              onClick={() => loadSubs(page - 1)}
            >
              Previous
            </button>
            <button
              className="admin-pg-btn"
              disabled={page >= totalPages}
              onClick={() => loadSubs(page + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
