import React, { useEffect, useState } from 'react';
import { apiClient } from '../../api/client';
import { Search, Loader2 } from 'lucide-react';
import './AdminPages.css';

export const AdminCredits: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const loadCredits = async (targetPage = 1, searchQuery = search) => {
    try {
      setLoading(true);
      const res = await apiClient.getAdminCredits({
        page: targetPage,
        pageSize: 15,
        search: searchQuery || undefined
      });
      setData(res.data);
      if (res.pagination) {
        setPage(res.pagination.page);
        setTotalPages(res.pagination.totalPages);
      }
    } catch (err: any) {
      console.error('Failed to load credits:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCredits(1);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadCredits(1, search);
  };

  return (
    <div className="admin-page-container">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Credits & Ledger Tracking</h1>
          <p className="admin-page-desc">Credit wallet balances and historical ledger consumption records.</p>
        </div>
      </div>

      <div className="admin-table-container">
        <div className="admin-table-controls">
          <form onSubmit={handleSearch} className="admin-search-input-wrap">
            <Search className="admin-search-icon" size={16} />
            <input
              type="text"
              className="admin-search-input"
              placeholder="Search user email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </form>
        </div>

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px', gap: '12px' }}>
            <Loader2 className="animate-spin text-primary" size={24} />
            <span>Loading credit ledgers...</span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', padding: '20px' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '12px' }}>Candidate Wallets</h3>
              <div style={{ overflowX: 'auto' }}>
                <table className="admin-data-table">
                  <thead>
                    <tr>
                      <th>Candidate</th>
                      <th>Current Balance</th>
                      <th>Lifetime Granted</th>
                      <th>Lifetime Consumed</th>
                      <th>Last Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.wallets?.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                          No wallets found.
                        </td>
                      </tr>
                    ) : (
                      data?.wallets?.map((w: any) => (
                        <tr key={w.id}>
                          <td>
                            <div style={{ fontWeight: 600 }}>{w.userName}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{w.userEmail}</div>
                          </td>
                          <td>
                            <span style={{ fontWeight: 700, color: '#fbbf24', fontSize: '1rem' }}>
                              {w.balance} cr
                            </span>
                          </td>
                          <td>{w.lifetimeGranted}</td>
                          <td>{w.lifetimeConsumed}</td>
                          <td>{new Date(w.updatedAt).toLocaleDateString()}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '12px' }}>Recent Ledger Activity</h3>
              <div style={{ overflowX: 'auto' }}>
                <table className="admin-data-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Type</th>
                      <th>Amount</th>
                      <th>Balance After</th>
                      <th>Reason</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.recentActivity?.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                          No ledger activity yet.
                        </td>
                      </tr>
                    ) : (
                      data?.recentActivity?.map((l: any) => (
                        <tr key={l.id}>
                          <td>{l.userEmail}</td>
                          <td>
                            <span className={`admin-badge ${l.amount > 0 ? 'success' : 'warning'}`}>
                              {l.type}
                            </span>
                          </td>
                          <td style={{ fontWeight: 700, color: l.amount > 0 ? '#34d399' : '#f87171' }}>
                            {l.amount > 0 ? `+${l.amount}` : l.amount}
                          </td>
                          <td>{l.balanceAfter}</td>
                          <td>{l.reason || 'Operation'}</td>
                          <td>{new Date(l.createdAt).toLocaleDateString()}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
