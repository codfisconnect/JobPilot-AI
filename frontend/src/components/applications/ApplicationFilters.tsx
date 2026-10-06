import React from 'react';
import { ApplicationStatus } from '../../types/applications';
import { Search, Filter, RefreshCw } from 'lucide-react';
import './ApplicationFilters.css';

interface ApplicationFiltersProps {
  search: string;
  onSearchChange: (search: string) => void;
  status: string;
  onStatusChange: (status: string) => void;
  onRefresh: () => void;
  loading?: boolean;
}

const STATUS_OPTIONS: { label: string; value: string }[] = [
  { label: 'All Statuses', value: 'ALL' },
  { label: 'Saved', value: 'SAVED' },
  { label: 'Ready to Apply', value: 'READY_TO_APPLY' },
  { label: 'Applied', value: 'APPLIED' },
  { label: 'Assessment', value: 'ASSESSMENT' },
  { label: 'HR Screen', value: 'HR_SCREEN' },
  { label: 'Technical', value: 'TECHNICAL' },
  { label: 'Final Round', value: 'FINAL_ROUND' },
  { label: 'Offer', value: 'OFFER' },
  { label: 'Rejected', value: 'REJECTED' },
  { label: 'Withdrawn', value: 'WITHDRAWN' }
];

export const ApplicationFilters: React.FC<ApplicationFiltersProps> = ({
  search,
  onSearchChange,
  status,
  onStatusChange,
  onRefresh,
  loading
}) => {
  return (
    <div className="app-filters-bar">
      <div className="app-search-input-wrapper">
        <Search size={18} className="search-icon" />
        <input
          type="text"
          className="app-search-input"
          placeholder="Search by job title, company, or location..."
          value={search}
          onChange={e => onSearchChange(e.target.value)}
        />
        {search && (
          <button className="clear-search-btn" onClick={() => onSearchChange('')}>
            ✕
          </button>
        )}
      </div>

      <div className="app-filter-actions">
        <div className="app-status-select-wrapper">
          <Filter size={16} className="filter-icon" />
          <select
            className="app-status-select"
            value={status}
            onChange={e => onStatusChange(e.target.value)}
          >
            {STATUS_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <button
          className="app-refresh-btn"
          onClick={onRefresh}
          disabled={loading}
          title="Refresh applications"
        >
          <RefreshCw size={16} className={loading ? 'spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>
    </div>
  );
};
