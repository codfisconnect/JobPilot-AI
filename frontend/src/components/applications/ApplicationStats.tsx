import React from 'react';
import { ApplicationStats } from '../../types/applications';
import {
  FileText,
  Send,
  Users,
  Award,
  XCircle,
  TrendingUp,
  Percent
} from 'lucide-react';
import './ApplicationStats.css';

interface ApplicationStatsProps {
  stats: ApplicationStats | null;
  loading?: boolean;
}

export const ApplicationStatsWidget: React.FC<ApplicationStatsProps> = ({ stats, loading }) => {
  if (loading || !stats) {
    return (
      <div className="app-stats-grid">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="app-stat-card skeleton-stat">
            <div className="skeleton-line sm" />
            <div className="skeleton-line lg" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="app-stats-grid">
      <div className="app-stat-card">
        <div className="app-stat-icon-wrapper total">
          <FileText size={20} />
        </div>
        <div className="app-stat-info">
          <span className="app-stat-label">Total Tracked</span>
          <span className="app-stat-value">{stats.total}</span>
        </div>
      </div>

      <div className="app-stat-card">
        <div className="app-stat-icon-wrapper applied">
          <Send size={20} />
        </div>
        <div className="app-stat-info">
          <span className="app-stat-label">Applied</span>
          <span className="app-stat-value">{stats.applied}</span>
        </div>
      </div>

      <div className="app-stat-card">
        <div className="app-stat-icon-wrapper interviews">
          <Users size={20} />
        </div>
        <div className="app-stat-info">
          <span className="app-stat-label">In Interviews</span>
          <span className="app-stat-value">{stats.interviewsTotal}</span>
        </div>
      </div>

      <div className="app-stat-card">
        <div className="app-stat-icon-wrapper offers">
          <Award size={20} />
        </div>
        <div className="app-stat-info">
          <span className="app-stat-label">Offers</span>
          <span className="app-stat-value">{stats.offers}</span>
        </div>
      </div>

      <div className="app-stat-card">
        <div className="app-stat-icon-wrapper conversion">
          <TrendingUp size={20} />
        </div>
        <div className="app-stat-info">
          <span className="app-stat-label">Conversion Rate</span>
          <span className="app-stat-value">{stats.conversionRate}%</span>
        </div>
      </div>

      <div className="app-stat-card">
        <div className="app-stat-icon-wrapper rejected">
          <XCircle size={20} />
        </div>
        <div className="app-stat-info">
          <span className="app-stat-label">Rejected / Closed</span>
          <span className="app-stat-value">{stats.rejected}</span>
        </div>
      </div>
    </div>
  );
};
