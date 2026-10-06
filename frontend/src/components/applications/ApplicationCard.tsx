import React from 'react';
import { ApplicationItem } from '../../types/applications';
import { ApplicationStatusBadge } from './ApplicationStatusBadge';
import {
  Building2,
  MapPin,
  Calendar,
  ExternalLink,
  FileCheck,
  ChevronRight,
  Clock,
  MessageSquare,
  Bell
} from 'lucide-react';
import './ApplicationCard.css';

interface ApplicationCardProps {
  application: ApplicationItem;
  onClick: () => void;
  onStatusClick: (e: React.MouseEvent) => void;
}

export const ApplicationCard: React.FC<ApplicationCardProps> = ({
  application,
  onClick,
  onStatusClick
}) => {
  const { job, resumeVersion, status, appliedAt, createdAt, notes, reminders, _count } = application;

  const notesCount = notes ? notes.length : (_count?.notes || 0);
  const remindersCount = reminders ? reminders.length : (_count?.reminders || 0);

  const displayDate = appliedAt
    ? `Applied ${new Date(appliedAt).toLocaleDateString()}`
    : `Added ${new Date(createdAt).toLocaleDateString()}`;

  return (
    <div className="app-card" onClick={onClick}>
      <div className="app-card-header">
        <div className="app-card-company-row">
          <div className="app-company-icon">
            <Building2 size={20} />
          </div>
          <div>
            <h4 className="app-job-title">{job?.title || 'Unknown Role'}</h4>
            <span className="app-company-name">{job?.company?.name || 'Company'}</span>
          </div>
        </div>

        <div onClick={onStatusClick} title="Click to update status">
          <ApplicationStatusBadge status={status} size="md" />
        </div>
      </div>

      <div className="app-card-details">
        {job?.location && (
          <div className="app-detail-item">
            <MapPin size={14} />
            <span>{job.location}</span>
          </div>
        )}
        <div className="app-detail-item">
          <Clock size={14} />
          <span>{displayDate}</span>
        </div>
        {resumeVersion && (
          <div className="app-detail-item resume-tag" title="Attached Resume Version">
            <FileCheck size={14} />
            <span>{resumeVersion.versionName || resumeVersion.title || 'Tailored Resume'}</span>
            {resumeVersion.atsScore !== null && resumeVersion.atsScore !== undefined && (
              <span className="ats-pill">{resumeVersion.atsScore}% ATS</span>
            )}
          </div>
        )}
      </div>

      <div className="app-card-footer">
        <div className="app-meta-counts">
          {notesCount > 0 && (
            <span className="meta-pill" title={`${notesCount} notes`}>
              <MessageSquare size={13} /> {notesCount}
            </span>
          )}
          {remindersCount > 0 && (
            <span className="meta-pill" title={`${remindersCount} reminders`}>
              <Bell size={13} /> {remindersCount}
            </span>
          )}
        </div>

        <div className="app-view-link">
          <span>View Details</span>
          <ChevronRight size={16} />
        </div>
      </div>
    </div>
  );
};
