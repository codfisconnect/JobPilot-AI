import React from 'react';
import { ApplicationStatus } from '../../types/applications';
import './ApplicationStatusBadge.css';

interface ApplicationStatusBadgeProps {
  status: ApplicationStatus | string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const ApplicationStatusBadge: React.FC<ApplicationStatusBadgeProps> = ({
  status,
  size = 'md',
  className = ''
}) => {
  const getStatusConfig = (s: string) => {
    switch (s) {
      case 'SAVED':
        return { label: 'Saved', colorClass: 'badge-saved' };
      case 'READY_TO_APPLY':
        return { label: 'Ready to Apply', colorClass: 'badge-ready' };
      case 'APPLIED':
        return { label: 'Applied', colorClass: 'badge-applied' };
      case 'ASSESSMENT':
        return { label: 'Assessment', colorClass: 'badge-interview' };
      case 'HR_SCREEN':
        return { label: 'HR Screen', colorClass: 'badge-interview' };
      case 'TECHNICAL':
        return { label: 'Technical Round', colorClass: 'badge-interview' };
      case 'FINAL_ROUND':
        return { label: 'Final Round', colorClass: 'badge-interview' };
      case 'OFFER':
        return { label: 'Offer Received 🎉', colorClass: 'badge-offer' };
      case 'REJECTED':
        return { label: 'Rejected', colorClass: 'badge-rejected' };
      case 'WITHDRAWN':
        return { label: 'Withdrawn', colorClass: 'badge-withdrawn' };
      default:
        return { label: s.replace(/_/g, ' '), colorClass: 'badge-neutral' };
    }
  };

  const { label, colorClass } = getStatusConfig(status);

  return (
    <span className={`app-status-badge ${colorClass} app-status-badge-${size} ${className}`}>
      <span className="app-status-dot" />
      <span className="app-status-label">{label}</span>
    </span>
  );
};
