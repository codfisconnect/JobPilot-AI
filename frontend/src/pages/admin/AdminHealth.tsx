import React, { useEffect, useState } from 'react';
import { apiClient } from '../../api/client';
import { Activity, Database, Server, Clock, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import './AdminPages.css';

export const AdminHealth: React.FC = () => {
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadHealth = async () => {
    try {
      setLoading(true);
      const res = await apiClient.getAdminHealth();
      setHealth(res);
    } catch (err: any) {
      console.error('Failed to load system health:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHealth();
  }, []);

  return (
    <div className="admin-page-container">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">System & Infrastructure Health</h1>
          <p className="admin-page-desc">Production environment status, database telemetry, and uptime diagnostics.</p>
        </div>
        <button className="admin-pg-btn" onClick={loadHealth} disabled={loading}>
          Refresh Telemetry
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px', gap: '12px' }}>
          <Loader2 className="animate-spin text-primary" size={24} />
          <span>Probing system services...</span>
        </div>
      ) : (
        <div className="admin-grid-metrics">
          <div className="admin-metric-card">
            <div className="admin-metric-top">
              <span className="admin-metric-lbl">Overall Service Status</span>
              <div className="admin-metric-icon" style={{ background: health?.status === 'healthy' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)', color: health?.status === 'healthy' ? '#34d399' : '#f87171' }}>
                {health?.status === 'healthy' ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
              </div>
            </div>
            <div className="admin-metric-val" style={{ textTransform: 'capitalize' }}>
              {health?.status || 'Unknown'}
            </div>
            <div className="admin-metric-sub">
              <span>Environment: {health?.environment}</span>
            </div>
          </div>

          <div className="admin-metric-card">
            <div className="admin-metric-top">
              <span className="admin-metric-lbl">PostgreSQL Database</span>
              <div className="admin-metric-icon" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' }}>
                <Database size={20} />
              </div>
            </div>
            <div className="admin-metric-val">
              {health?.database?.connected ? 'Connected' : 'Disconnected'}
            </div>
            <div className="admin-metric-sub">
              <span>Latency: {health?.database?.latencyMs} ms</span>
            </div>
          </div>

          <div className="admin-metric-card">
            <div className="admin-metric-top">
              <span className="admin-metric-lbl">Process Uptime</span>
              <div className="admin-metric-icon" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc' }}>
                <Clock size={20} />
              </div>
            </div>
            <div className="admin-metric-val">
              {Math.floor((health?.uptimeSeconds || 0) / 60)} mins
            </div>
            <div className="admin-metric-sub">
              <span>{health?.uptimeSeconds || 0} seconds active</span>
            </div>
          </div>

          <div className="admin-metric-card">
            <div className="admin-metric-top">
              <span className="admin-metric-lbl">Node.js Runtime</span>
              <div className="admin-metric-icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' }}>
                <Server size={20} />
              </div>
            </div>
            <div className="admin-metric-val">
              {health?.memoryUsageMb || 0} MB
            </div>
            <div className="admin-metric-sub">
              <span>Node {health?.nodeVersion} (Resident Memory)</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
