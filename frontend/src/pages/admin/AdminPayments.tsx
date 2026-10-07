import React, { useEffect, useState } from 'react';
import { apiClient } from '../../api/client';
import { Search, Loader2 } from 'lucide-react';
import './AdminPages.css';

export const AdminPayments: React.FC = () => {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const loadPayments = async (targetPage = 1, searchQuery = search, statusFilter = status) => {
    try {
      setLoading(true);
      const res = await apiClient.getAdminPayments({
        page: targetPage,
        pageSize: 15,
        search: searchQuery || undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined
      });
      setPayments(res.data || []);
      if (res.pagination) {
        setPage(res.pagination.page);
        setTotalPages(res.pagination.totalPages);
        setTotalCount(res.pagination.total);
      }
    } catch (err: any) {
      console.error('Failed to load admin payments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayments(1);
  }, [status]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadPayments(1, search, status);
  };

  return (
    <div className="admin-page-container">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Billing & Payment Transactions</h1>
          <p className="admin-page-desc">Safe payment records and transaction statuses from payment processors.</p>
        </div>
      </div>

      <div className="admin-table-container">
        <div className="admin-table-controls">
          <form onSubmit={handleSearch} className="admin-search-input-wrap">
            <Search className="admin-search-icon" size={16} />
            <input
              type="text"
              className="admin-search-input"
              placeholder="Search user, payment ID, or order..."
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
            <option value="CAPTURED">CAPTURED</option>
            <option value="AUTHORIZED">AUTHORIZED</option>
            <option value="REFUNDED">REFUNDED</option>
            <option value="FAILED">FAILED</option>
          </select>

          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Total: {totalCount} transactions
          </span>
        </div>

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px', gap: '12px' }}>
            <Loader2 className="animate-spin text-primary" size={24} />
            <span>Loading payments...</span>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="admin-data-table">
              <thead>
                <tr>
                  <th>User / Candidate</th>
                  <th>Amount</th>
                  <th>Plan / Purpose</th>
                  <th>Payment ID</th>
                  <th>Status</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                      No payment records found.
                    </td>
                  </tr>
                ) : (
                  payments.map(p => (
                    <tr key={p.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{p.userName}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.userEmail}</div>
                      </td>
                      <td>
                        <span style={{ fontWeight: 700, color: '#34d399' }}>
                          ₹{(p.amount / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td>{p.planName}</td>
                      <td>
                        <code style={{ fontSize: '0.75rem', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px' }}>
                          {p.paymentId || 'N/A'}
                        </code>
                      </td>
                      <td>
                        <span className={`admin-badge ${p.status === 'CAPTURED' ? 'success' : p.status === 'FAILED' ? 'danger' : 'warning'}`}>
                          {p.status}
                        </span>
                      </td>
                      <td>{new Date(p.createdAt).toLocaleDateString()}</td>
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
              onClick={() => loadPayments(page - 1)}
            >
              Previous
            </button>
            <button
              className="admin-pg-btn"
              disabled={page >= totalPages}
              onClick={() => loadPayments(page + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
